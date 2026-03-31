const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const fixturesRoot = path.join(repoRoot, 'test', 'fixtures', 'claude');
const runtimePath = path.join(repoRoot, 'test', 'fixtures', 'lib', 'runtime.js');
const cssPath = path.join(repoRoot, 'test', 'fixtures', 'lib', 'fixture.css');
const fontsRoot = path.join(repoRoot, 'test', 'fixtures', 'lib', 'fonts');

let fixtureCache = null;

function normalizeFixture(fixtureDir, entryName) {
  const meta = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'meta.json'), 'utf8'));
  const bootPath = path.join(fixtureDir, 'boot.js');
  const sourcePath = path.join(fixtureDir, 'sanitized-source.html');

  if (!meta?.id || meta.id !== entryName) {
    throw new Error(`Fixture ${entryName} must declare a matching meta.id`);
  }

  if (!meta.route || typeof meta.route !== 'string') {
    throw new Error(`Fixture ${entryName} must declare a route`);
  }

  if (!['seed', 'sanitized_html'].includes(meta.sourceMode)) {
    throw new Error(`Fixture ${entryName} must declare sourceMode "seed" or "sanitized_html"`);
  }

  if (typeof meta.helpers?.mutable !== 'boolean') {
    throw new Error(`Fixture ${entryName} must declare helpers.mutable`);
  }

  if (meta.sourceMode === 'sanitized_html' && !fs.existsSync(sourcePath)) {
    throw new Error(`Sanitized fixture ${entryName} is missing sanitized-source.html`);
  }

  if (meta.sourceMode === 'sanitized_html' && meta.helpers.mutable !== false) {
    throw new Error(`Sanitized fixture ${entryName} must be read-only`);
  }

  if (meta.sourceMode === 'seed' && !meta.seedProfile) {
    throw new Error(`Seed fixture ${entryName} must declare seedProfile`);
  }

  return {
    id: meta.id,
    route: meta.route,
    meta,
    pagePath: path.join(fixtureDir, 'page.html'),
    metaPath: path.join(fixtureDir, 'meta.json'),
    bootPath: fs.existsSync(bootPath) ? bootPath : null,
    sourcePath: fs.existsSync(sourcePath) ? sourcePath : null,
  };
}

function loadFixtures() {
  if (fixtureCache) {
    return fixtureCache;
  }

  const entries = fs.readdirSync(fixturesRoot, { withFileTypes: true });
  const fixtures = entries.filter(entry => entry.isDirectory()).map(entry => {
    const fixtureDir = path.join(fixturesRoot, entry.name);
    return normalizeFixture(fixtureDir, entry.name);
  });

  const seenRoutes = new Map();
  fixtures.forEach(fixture => {
    if (seenRoutes.has(fixture.route)) {
      throw new Error(
        `Duplicate fixture route "${fixture.route}" declared by ${fixture.id} and ${seenRoutes.get(fixture.route)}`
      );
    }
    seenRoutes.set(fixture.route, fixture.id);
  });

  fixtureCache = fixtures;
  return fixtureCache;
}

function getFixtureById(id) {
  return loadFixtures().find(fixture => fixture.id === id) || null;
}

function getFixtureByPath(pathname) {
  return loadFixtures().find(fixture => fixture.route === pathname) || null;
}

function recordViolation(violations, request, reason) {
  violations.push({
    url: request.url(),
    method: request.method(),
    resourceType: request.resourceType(),
    reason,
  });
}

async function fulfillFixtureAsset(route, fixture, url) {
  if (url.pathname === '/favicon.ico') {
    await route.fulfill({
      status: 204,
      contentType: 'image/x-icon',
      body: '',
    });
    return true;
  }

  if (url.pathname === '/__cl_fixture__/runtime.js') {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: fs.readFileSync(runtimePath, 'utf8'),
    });
    return true;
  }

  if (url.pathname === '/__cl_fixture__/fixture.css') {
    await route.fulfill({
      status: 200,
      contentType: 'text/css; charset=utf-8',
      body: fs.readFileSync(cssPath, 'utf8'),
    });
    return true;
  }

  if (url.pathname.startsWith('/__cl_fixture__/fonts/')) {
    const fileName = path.basename(url.pathname);
    const fontPath = path.join(fontsRoot, fileName);
    const exists = fontPath.startsWith(fontsRoot) && fs.existsSync(fontPath);
    await route.fulfill({
      status: exists ? 200 : 404,
      contentType: 'font/ttf',
      body: exists ? fs.readFileSync(fontPath) : '',
    });
    return true;
  }

  if (url.pathname.startsWith('/__cl_fixture__/meta/')) {
    const id = path.basename(url.pathname, '.json');
    const targetFixture = getFixtureById(id);
    await route.fulfill({
      status: targetFixture ? 200 : 404,
      contentType: 'application/json; charset=utf-8',
      body: targetFixture ? fs.readFileSync(targetFixture.metaPath, 'utf8') : '{}',
    });
    return true;
  }

  if (url.pathname.startsWith('/__cl_fixture__/boot/')) {
    const id = path.basename(url.pathname, '.js');
    const targetFixture = getFixtureById(id);
    await route.fulfill({
      status: targetFixture?.bootPath ? 200 : 404,
      contentType: 'application/javascript; charset=utf-8',
      body: targetFixture?.bootPath ? fs.readFileSync(targetFixture.bootPath, 'utf8') : '',
    });
    return true;
  }

  if (url.pathname.startsWith('/__cl_fixture__/source/')) {
    const id = path.basename(url.pathname, '.html');
    const targetFixture = getFixtureById(id);
    await route.fulfill({
      status: targetFixture?.sourcePath ? 200 : 404,
      contentType: 'text/html; charset=utf-8',
      body: targetFixture?.sourcePath ? fs.readFileSync(targetFixture.sourcePath, 'utf8') : '',
    });
    return true;
  }

  if (fixture && route.request().resourceType() === 'document') {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: fs.readFileSync(fixture.pagePath, 'utf8'),
    });
    return true;
  }

  return false;
}

async function installFixtureRoutes(context, violations = []) {
  await context.route(/^https?:\/\//, async route => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.hostname === 'claude.ai') {
      const fixture = getFixtureByPath(url.pathname);
      const handled = await fulfillFixtureAsset(route, fixture, url);
      if (handled) {
        return;
      }

      recordViolation(violations, request, 'unhandled_claude_request');
      await route.abort();
      return;
    }

    recordViolation(violations, request, 'blocked_live_network');
    await route.abort();
  });
}

module.exports = {
  getFixtureById,
  getFixtureByPath,
  installFixtureRoutes,
  loadFixtures,
};
