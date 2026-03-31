import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveChatTarget, resolveOrderedChatTargets } from './lib/chatFixtureConfig.js';
import { sanitizeLiveCaptureHtml } from './lib/sanitizeLiveCapture.js';
import { refreshFixtures } from './refresh-fixtures.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const part = argv[index];
    if (!part.startsWith('--')) {
      continue;
    }
    const key = part.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

async function loadCapture(sourceId) {
  const sourceDir = path.join(repoRoot, 'test', 'fixtures-source', 'claude', sourceId);
  const captureHtml = await fs.readFile(path.join(sourceDir, 'page.html'), 'utf8');
  const captureMeta = JSON.parse(await fs.readFile(path.join(sourceDir, 'capture.json'), 'utf8'));
  return { captureHtml, captureMeta };
}

async function writeSanitizedFixture(spec) {
  const sourceId = spec.sourceId || spec.fixtureId;
  const { captureHtml, captureMeta } = await loadCapture(sourceId);
  const result = sanitizeLiveCaptureHtml({
    captureHtml,
    captureMeta,
    fixtureId: spec.fixtureId,
    route: spec.route,
    pageType: spec.pageType || 'conversation',
    theme: spec.theme,
    features: spec.features,
    notes: spec.notes,
    visual: spec.visual,
  });

  const outputDir = path.join(repoRoot, 'test', 'fixtures', 'claude', spec.fixtureId);
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, 'sanitized-source.html'), result.sourceHtml, 'utf8');
  await fs.writeFile(path.join(outputDir, 'meta.json'), JSON.stringify(result.meta, null, 2), 'utf8');

  return {
    ...result.summary,
    fixtureId: spec.fixtureId,
    sourceId,
  };
}

async function resolveSanitizeSpecs(args) {
  if (args.target) {
    const target = await resolveChatTarget(args.target);
    return [
      {
        fixtureId: target.fixtureId,
        sourceId: target.captureId,
        route: target.route,
        pageType: target.pageType,
        theme: target.theme,
        features: target.features,
        notes: target.notes,
        visual: target.visual,
      },
    ];
  }

  if (!args.id && !args.route) {
    const targets = await resolveOrderedChatTargets();
    return targets.map(target => ({
      fixtureId: target.fixtureId,
      sourceId: target.captureId,
      route: target.route,
      pageType: target.pageType,
      theme: target.theme,
      features: target.features,
      notes: target.notes,
      visual: target.visual,
    }));
  }

  if (!args.id || !args.route) {
    throw new Error(
      'Usage: node scripts/fixtures/sanitize-capture.mjs --target <short|medium|long>\n   or: node scripts/fixtures/sanitize-capture.mjs --id <fixture-id> --route </path> [--source <capture-id>] [--pageType conversation]'
    );
  }

  return [
    {
      fixtureId: args.id,
      sourceId: args.source || args.id,
      route: args.route,
      pageType: args.pageType || 'conversation',
      theme: args.theme,
      features: args.features
        ? String(args.features)
            .split(',')
            .map(item => item.trim())
            .filter(Boolean)
        : ['navigation', 'bookmarks', 'emojiMarkers', 'editHistory'],
      notes: args.notes || 'Sanitized from live Claude capture',
      visual: args.visual === 'true' || args.visual === true,
    },
  ];
}

const args = parseArgs(process.argv);
const specs = await resolveSanitizeSpecs(args);
const results = [];

for (const spec of specs) {
  results.push(await writeSanitizedFixture(spec));
}

await refreshFixtures();

results.forEach(result => {
  console.log(
    `Sanitized ${result.sourceId} -> ${result.fixtureId} (${result.messageCount} messages, ${result.editedMessageCount} edited)`
  );
});
