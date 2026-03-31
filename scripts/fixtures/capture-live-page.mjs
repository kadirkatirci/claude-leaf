import fs from 'node:fs/promises';
import path from 'node:path';
import {
  collectLivePageSnapshot,
  createArtifactRunDir,
  DEFAULT_ARTIFACT_ROOT,
  DEFAULT_BROWSER_PATH,
  DEFAULT_CHROME_USER_DATA_DIR,
  DEFAULT_CLONE_DIR,
  DEFAULT_PROFILE_NAME,
  launchLiveChrome,
  parseArgs,
  parseViewport,
  refreshChromeProfileClone,
  repoRoot,
} from './lib/liveChrome.js';
import { resolveChatTarget } from './lib/chatFixtureConfig.js';

const args = parseArgs(process.argv);
const targetName = args.target;
const targetSpec = targetName ? await resolveChatTarget(targetName) : null;
const fixtureId = args.id || targetSpec?.captureId;
const route = args.route || new URL(targetSpec?.url || '', 'https://claude.ai').pathname;

if (!fixtureId || (!route && !targetSpec)) {
  throw new Error(
    'Usage: node scripts/fixtures/capture-live-page.mjs --target <short|medium|long> [--id <capture-id>] [--viewport 1440x900]\n   or: node scripts/fixtures/capture-live-page.mjs --id <capture-id> --route </path> [--viewport 1440x900]'
  );
}

const viewport = parseViewport(args.viewport);
const outputDir = path.join(repoRoot, 'test', 'fixtures-source', 'claude', fixtureId);
const targetUrl = targetSpec?.url || new URL(route, 'https://claude.ai').toString();
const artifactDir = await createArtifactRunDir({
  rootDir: args['artifact-root'] || DEFAULT_ARTIFACT_ROOT,
  label: `capture-${fixtureId}`,
});

const cloneMetadata = await refreshChromeProfileClone({
  profileName: args['profile-name'] || DEFAULT_PROFILE_NAME,
  chromeUserDataDir: args['chrome-user-data-dir'] || DEFAULT_CHROME_USER_DATA_DIR,
  cloneDir: args['clone-dir'] || DEFAULT_CLONE_DIR,
  browserPath: args['browser-path'] || DEFAULT_BROWSER_PATH,
});

await fs.mkdir(outputDir, { recursive: true });

const liveChrome = await launchLiveChrome({
  cloneDir: cloneMetadata.cloneDir,
  profileDirectory: cloneMetadata.profileDirectory,
  browserPath: cloneMetadata.browserPath,
  artifactDir,
  viewport,
});

const page = liveChrome.context.pages()[0] || (await liveChrome.context.newPage());

try {
  await page.setViewportSize(viewport);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const readiness = await collectLivePageSnapshot(page);
  if (readiness.loginish || readiness.challenge) {
    const reason = readiness.loginish ? 'login screen detected' : 'Cloudflare challenge detected';
    throw new Error(`Live capture aborted for ${targetUrl}: ${reason}`);
  }

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
        targetName: targetName || null,
        route,
        capturedAt: new Date().toISOString(),
        artifactDir,
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
  await liveChrome.close();
}
