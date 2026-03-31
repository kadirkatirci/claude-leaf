import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
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

const SELECTOR_CONTRACTS = [
  'main',
  '[role="main"]',
  'nav[aria-label="Sidebar"]',
  '[data-testid="user-message"]',
  '[data-test-render-count]',
  '.inline-flex.items-center.gap-1',
  'button svg path[d*="M10.3857"]',
  '[data-edit-container-id]',
  '[data-testid="chat-input"]',
  '[data-testid="prompt-input"]',
];

const ALLOWED_ATTRIBUTES = new Set([
  'class',
  'id',
  'role',
  'href',
  'type',
  'placeholder',
  'value',
  'rows',
  'd',
  'viewBox',
  'fill',
  'stroke',
  'width',
  'height',
]);

const ALLOWED_DATA_ATTRIBUTES = new Set([
  'data-testid',
  'data-test-render-count',
  'data-is-streaming',
  'data-dd-action-name',
  'data-state',
  'data-edit-container-id',
]);

function isContractNode(node) {
  return SELECTOR_CONTRACTS.some(selector => {
    try {
      return node.matches(selector);
    } catch {
      return false;
    }
  });
}

function sanitizeTree(root) {
  if (!root) {
    return;
  }

  root.querySelectorAll('script, style, noscript, iframe').forEach(node => node.remove());

  root.querySelectorAll('*').forEach(node => {
    const contractNode = isContractNode(node);
    for (const attribute of [...node.attributes]) {
      const keepAttribute =
        ALLOWED_ATTRIBUTES.has(attribute.name) ||
        attribute.name.startsWith('aria-') ||
        ALLOWED_DATA_ATTRIBUTES.has(attribute.name) ||
        (contractNode && attribute.name === 'class');

      if (!keepAttribute) {
        node.removeAttribute(attribute.name);
        continue;
      }

      if (attribute.name !== 'class' && attribute.value.length > 300) {
        node.removeAttribute(attribute.name);
      }
    }
  });
}

const args = parseArgs(process.argv);
const fixtureId = args.id;
const sourceId = args.source || fixtureId;
const route = args.route;
const pageType = args.pageType || 'conversation';
const theme = args.theme || 'dark';
const notes = args.notes || 'Sanitized from live Claude capture';

if (!fixtureId || !route) {
  throw new Error(
    'Usage: node scripts/fixtures/sanitize-capture.mjs --id <fixture-id> --route </path> [--source <capture-id>] [--pageType conversation]'
  );
}

const sourceDir = path.join(repoRoot, 'test', 'fixtures-source', 'claude', sourceId);
const captureHtml = await fs.readFile(path.join(sourceDir, 'page.html'), 'utf8');
const captureMeta = JSON.parse(await fs.readFile(path.join(sourceDir, 'capture.json'), 'utf8'));

const dom = new JSDOM(captureHtml);
const { document } = dom.window;
const sanitizedMain = document.querySelector('main, [role="main"]')?.cloneNode(true);
const sanitizedSidebar = document.querySelector('nav[aria-label="Sidebar"]')?.cloneNode(true);

const shell = document.implementation.createHTMLDocument('Claude Fixture Sanitized Snapshot');
const root = shell.createElement('div');
root.id = 'claude-fixture-sanitized-root';

if (sanitizedSidebar) {
  sanitizeTree(sanitizedSidebar);
  root.appendChild(sanitizedSidebar);
}

if (sanitizedMain) {
  sanitizeTree(sanitizedMain);
  root.appendChild(sanitizedMain);
}

const outputDir = path.join(repoRoot, 'test', 'fixtures', 'claude', fixtureId);
await fs.mkdir(outputDir, { recursive: true });

await fs.writeFile(path.join(outputDir, 'sanitized-source.html'), root.innerHTML, 'utf8');
await fs.writeFile(
  path.join(outputDir, 'meta.json'),
  JSON.stringify(
    {
      id: fixtureId,
      route,
      pageType,
      theme,
      viewport: captureMeta.viewport || { width: 1440, height: 900 },
      sourceMode: 'sanitized_html',
      helpers: {
        mutable: false,
      },
      features: ['navigation', 'bookmarks', 'emojiMarkers', 'editHistory'],
      seedProfile: '',
      visual: false,
      notes,
    },
    null,
    2
  ),
  'utf8'
);

await refreshFixtures();

console.log(`Sanitized capture ${sourceId} -> test/fixtures/claude/${fixtureId}`);
