import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const fixturesRoot = path.join(repoRoot, 'test', 'fixtures', 'claude');

function renderFixturePage(meta, hasBoot) {
  const bootAttr = hasBoot ? ` data-fixture-boot="/__cl_fixture__/boot/${meta.id}.js"` : '';
  const sourceAttr =
    meta.sourceMode === 'sanitized_html'
      ? ` data-fixture-source="/__cl_fixture__/source/${meta.id}.html"`
      : '';

  return `<!doctype html>
<html lang="en" data-fixture-id="${meta.id}" data-fixture-meta="/__cl_fixture__/meta/${meta.id}.json"${bootAttr}${sourceAttr}>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Claude Fixture - ${meta.id}</title>
    <link rel="stylesheet" href="/__cl_fixture__/fixture.css" />
  </head>
  <body>
    <script src="/__cl_fixture__/runtime.js"></script>
  </body>
</html>
`;
}

function validateMeta(meta, entryName, hasSanitizedSource) {
  if (!meta?.id || meta.id !== entryName) {
    throw new Error(`Fixture ${entryName} must declare a matching meta.id`);
  }

  if (!meta.route || typeof meta.route !== 'string') {
    throw new Error(`Fixture ${entryName} must declare a route`);
  }

  if (!['seed', 'sanitized_html'].includes(meta.sourceMode)) {
    throw new Error(`Fixture ${entryName} must use sourceMode "seed" or "sanitized_html"`);
  }

  if (typeof meta.helpers?.mutable !== 'boolean') {
    throw new Error(`Fixture ${entryName} must declare helpers.mutable`);
  }

  if (meta.sourceMode === 'seed' && !meta.seedProfile) {
    throw new Error(`Seed fixture ${entryName} must declare seedProfile`);
  }

  if (meta.sourceMode === 'sanitized_html') {
    if (!hasSanitizedSource) {
      throw new Error(`Sanitized fixture ${entryName} is missing sanitized-source.html`);
    }
    if (meta.helpers.mutable !== false) {
      throw new Error(`Sanitized fixture ${entryName} must be read-only (helpers.mutable=false)`);
    }
  }
}

export async function refreshFixtures() {
  const fixtureDirs = await fs.readdir(fixturesRoot, { withFileTypes: true });
  const seenRoutes = new Map();

  for (const entry of fixtureDirs) {
    if (!entry.isDirectory()) {
      continue;
    }

    const fixtureDir = path.join(fixturesRoot, entry.name);
    const metaPath = path.join(fixtureDir, 'meta.json');
    const bootPath = path.join(fixtureDir, 'boot.js');
    const sanitizedSourcePath = path.join(fixtureDir, 'sanitized-source.html');

    const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));
    const hasBoot = await fileExists(bootPath);
    const hasSanitizedSource = await fileExists(sanitizedSourcePath);

    validateMeta(meta, entry.name, hasSanitizedSource);

    if (seenRoutes.has(meta.route)) {
      throw new Error(
        `Duplicate fixture route "${meta.route}" declared by ${entry.name} and ${seenRoutes.get(meta.route)}`
      );
    }
    seenRoutes.set(meta.route, entry.name);

    const pageHtml = renderFixturePage(meta, hasBoot);

    await fs.writeFile(path.join(fixtureDir, 'page.html'), pageHtml, 'utf8');
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  await refreshFixtures();
}
