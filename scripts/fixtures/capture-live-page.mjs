import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

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

function parseViewport(rawViewport) {
  if (!rawViewport) {
    return { width: 1440, height: 900 };
  }

  const match = String(rawViewport).match(/^(\d+)x(\d+)$/);
  if (!match) {
    throw new Error(`Invalid viewport: ${rawViewport}. Expected WIDTHxHEIGHT`);
  }

  return {
    width: Number.parseInt(match[1], 10),
    height: Number.parseInt(match[2], 10),
  };
}

const args = parseArgs(process.argv);
const fixtureId = args.id;
const route = args.route;

if (!fixtureId || !route) {
  throw new Error(
    'Usage: node scripts/fixtures/capture-live-page.mjs --id <fixture-id> --route </path> [--viewport 1440x900]'
  );
}

const viewport = parseViewport(args.viewport);
const userDataDir = path.join(repoRoot, '.auth', 'claude-fixture-profile');
const outputDir = path.join(repoRoot, 'test', 'fixtures-source', 'claude', fixtureId);
const targetUrl = new URL(route, 'https://claude.ai').toString();

await fs.mkdir(outputDir, { recursive: true });

const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium',
  headless: false,
  viewport,
});

const page = await context.newPage();

try {
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const capture = await page.evaluate(() => {
    const theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return {
      html: document.documentElement.outerHTML,
      title: document.title,
      url: window.location.href,
      pathname: window.location.pathname,
      colorScheme: theme,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };
  });

  await fs.writeFile(path.join(outputDir, 'page.html'), capture.html, 'utf8');
  await fs.writeFile(
    path.join(outputDir, 'capture.json'),
    JSON.stringify(
      {
        id: fixtureId,
        route,
        capturedAt: new Date().toISOString(),
        ...capture,
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`Captured ${targetUrl} -> ${outputDir}`);
} finally {
  await page.close();
  await context.close();
}
