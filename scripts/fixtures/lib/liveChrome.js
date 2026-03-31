import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const repoRoot = path.resolve(__dirname, '..', '..', '..');
export const DEFAULT_PROFILE_NAME = 'Test';
export const DEFAULT_CHROME_USER_DATA_DIR = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'Google',
  'Chrome'
);
export const DEFAULT_BROWSER_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const DEFAULT_CLONE_DIR = path.join(repoRoot, '.auth', 'chrome-test-live');
export const DEFAULT_ARTIFACT_ROOT = path.join(repoRoot, '.auth', 'live-artifacts');
export const DEFAULT_VIEWPORT = { width: 1440, height: 900 };
export const REQUIRED_CLAUDE_AUTH_SIGNALS = ['sessionKey', 'lastActiveOrg', 'routingHint'];
export const DEFAULT_EXTENSION_NAME = 'Claude Leaf';

const PROFILE_EXCLUDED_SEGMENTS = new Set([
  'Cache',
  'Code Cache',
  'GPUCache',
  'CacheStorage',
  'ScriptCache',
  'blob_storage',
  'VideoDecodeStats',
  'ShaderCache',
  'GrShaderCache',
  'GraphiteDawnCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'BrowserMetrics',
  'Crashpad',
  'OptimizationHints',
  'component_crx_cache',
  'pnacl',
  'Sessions',
]);

export function parseArgs(argv) {
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

export function parseBooleanFlag(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

export function parseViewport(rawViewport) {
  if (!rawViewport) {
    return { ...DEFAULT_VIEWPORT };
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

export function resolveProfileDirectoryFromLocalState(localStateData, profileName) {
  const infoCache = localStateData?.profile?.info_cache || {};

  for (const [directory, info] of Object.entries(infoCache)) {
    if (info?.name === profileName) {
      return directory;
    }
  }

  throw new Error(`Chrome profile "${profileName}" was not found in Local State`);
}

export async function readLocalState(chromeUserDataDir) {
  const localStatePath = path.join(chromeUserDataDir, 'Local State');
  const raw = await fs.readFile(localStatePath, 'utf8');
  return JSON.parse(raw);
}

export function parsePgrepOutput(stdout) {
  return String(stdout || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(/^(\d+)\s+(.+)$/);
      if (!match) {
        return null;
      }
      return {
        pid: Number.parseInt(match[1], 10),
        command: match[2],
      };
    })
    .filter(Boolean);
}

export function listChromeProcesses(execFile = execFileSync) {
  let output = '';

  try {
    output = execFile('pgrep', ['-af', 'Google Chrome|Chrome Helper'], {
      encoding: 'utf8',
    });
  } catch (error) {
    if (typeof error.stdout === 'string') {
      output = error.stdout;
    } else {
      return [];
    }
  }

  const candidates = parsePgrepOutput(output);

  return candidates.filter(candidate => {
    try {
      const command = execFile('ps', ['-p', String(candidate.pid), '-o', 'command='], {
        encoding: 'utf8',
      }).trim();

      return /Google Chrome|Chrome Helper/.test(command);
    } catch {
      return false;
    }
  });
}

export async function listSingletonPaths(chromeUserDataDir) {
  try {
    const entries = await fs.readdir(chromeUserDataDir, { withFileTypes: true });
    return entries
      .filter(entry => entry.name.startsWith('Singleton'))
      .map(entry => path.join(chromeUserDataDir, entry.name));
  } catch {
    return [];
  }
}

export async function assertChromeClosed({
  chromeUserDataDir = DEFAULT_CHROME_USER_DATA_DIR,
  getProcesses = listChromeProcesses,
  getSingletons = listSingletonPaths,
} = {}) {
  const processes = getProcesses();
  const singletonPaths = await getSingletons(chromeUserDataDir);

  if (processes.length === 0 && singletonPaths.length === 0) {
    return { processes, singletonPaths };
  }

  const details = [
    processes.length > 0
      ? `processes=${processes.map(process => `${process.pid}:${process.command}`).join(', ')}`
      : null,
    singletonPaths.length > 0 ? `singletonLocks=${singletonPaths.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  throw new Error(`Google Chrome must be fully closed before cloning the Test profile. ${details}`);
}

export function shouldCopyProfileRelativePath(relativePath) {
  if (!relativePath || relativePath === '.') {
    return true;
  }

  const normalized = relativePath.split(path.sep).join('/');
  const segments = normalized.split('/');
  const basename = segments[segments.length - 1];

  if (basename === 'LOCK' || basename.startsWith('Singleton')) {
    return false;
  }

  if (basename.endsWith('.tmp') || basename.endsWith('.lock')) {
    return false;
  }

  return !segments.some(segment => PROFILE_EXCLUDED_SEGMENTS.has(segment));
}

async function removeIfExists(targetPath) {
  await fs.rm(targetPath, { recursive: true, force: true });
}

export async function cloneChromeProfile({
  chromeUserDataDir = DEFAULT_CHROME_USER_DATA_DIR,
  profileDirectory,
  cloneDir = DEFAULT_CLONE_DIR,
} = {}) {
  if (!profileDirectory) {
    throw new Error('cloneChromeProfile requires profileDirectory');
  }

  const sourceProfileDir = path.join(chromeUserDataDir, profileDirectory);
  const targetProfileDir = path.join(cloneDir, profileDirectory);

  await fs.rm(cloneDir, { recursive: true, force: true });
  await fs.mkdir(cloneDir, { recursive: true });
  await fs.copyFile(
    path.join(chromeUserDataDir, 'Local State'),
    path.join(cloneDir, 'Local State')
  );
  await fs.cp(sourceProfileDir, targetProfileDir, {
    recursive: true,
    filter: sourcePath => {
      const relativePath = path.relative(sourceProfileDir, sourcePath);
      return shouldCopyProfileRelativePath(relativePath);
    },
  });

  await Promise.all([
    removeIfExists(path.join(cloneDir, 'SingletonCookie')),
    removeIfExists(path.join(cloneDir, 'SingletonLock')),
    removeIfExists(path.join(cloneDir, 'SingletonSocket')),
    removeIfExists(path.join(targetProfileDir, 'LOCK')),
  ]);

  return {
    cloneDir,
    profileDirectory,
    targetProfileDir,
  };
}

export function getCloneMetadataPath(cloneDir = DEFAULT_CLONE_DIR) {
  return path.join(cloneDir, 'profile-meta.json');
}

export async function readProfilePreferences({
  cloneDir = DEFAULT_CLONE_DIR,
  profileDirectory,
} = {}) {
  if (!profileDirectory) {
    throw new Error('readProfilePreferences requires profileDirectory');
  }

  const preferencesPath = path.join(cloneDir, profileDirectory, 'Preferences');
  const raw = await fs.readFile(preferencesPath, 'utf8');
  return JSON.parse(raw);
}

function normalizeComparablePath(value) {
  return path.resolve(String(value || '')).replace(/\\/g, '/');
}

export function detectInstalledExtension(
  preferences,
  { extensionPath = repoRoot, extensionName = DEFAULT_EXTENSION_NAME } = {}
) {
  const settings = preferences?.extensions?.settings || {};
  const expectedPath = normalizeComparablePath(extensionPath);

  for (const [id, meta] of Object.entries(settings)) {
    const candidatePath = meta?.path ? normalizeComparablePath(meta.path) : null;
    const manifestName = meta?.manifest?.name || null;
    const pathMatches = candidatePath === expectedPath;
    const nameMatches = manifestName === extensionName;

    if (!pathMatches && !nameMatches) {
      continue;
    }

    const state = meta?.state ?? null;
    const enabled = state === 1 || state === '1';

    return {
      installed: true,
      enabled,
      id,
      path: candidatePath,
      name: manifestName,
      state,
      location: meta?.location ?? null,
    };
  }

  return {
    installed: false,
    enabled: false,
    id: null,
    path: null,
    name: null,
    state: null,
    location: null,
  };
}

export async function getInstalledExtension({
  cloneDir = DEFAULT_CLONE_DIR,
  profileDirectory,
  extensionPath = repoRoot,
  extensionName = DEFAULT_EXTENSION_NAME,
} = {}) {
  const preferences = await readProfilePreferences({ cloneDir, profileDirectory });
  return detectInstalledExtension(preferences, { extensionPath, extensionName });
}

export function readClaudeCookieNames(cookiesDbPath, execFile = execFileSync) {
  const script = `
import json
import sqlite3
import sys

db_path = sys.argv[1]
conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
cur = conn.cursor()
cur.execute(
  "select name from cookies where host_key like '%claude.ai%' or host_key like '%anthropic.com%' order by name"
)
rows = [row[0] for row in cur.fetchall()]
conn.close()
print(json.dumps(rows))
`;

  const raw = execFile('python3', ['-c', script, cookiesDbPath], {
    encoding: 'utf8',
  }).trim();

  return JSON.parse(raw || '[]');
}

export function evaluateAuthSignals(cookieNames) {
  const cookieSet = new Set(cookieNames);
  const missingSignals = REQUIRED_CLAUDE_AUTH_SIGNALS.filter(name => !cookieSet.has(name));

  return {
    cookieNames: [...cookieSet].sort(),
    missingSignals,
    authenticated: missingSignals.length === 0,
  };
}

export function assertClaudeAuthenticated({
  cloneDir = DEFAULT_CLONE_DIR,
  profileDirectory,
  profileName = DEFAULT_PROFILE_NAME,
  execFile = execFileSync,
} = {}) {
  if (!profileDirectory) {
    throw new Error('assertClaudeAuthenticated requires profileDirectory');
  }

  const cookiesDbPath = path.join(cloneDir, profileDirectory, 'Cookies');
  const cookieNames = readClaudeCookieNames(cookiesDbPath, execFile);
  const auth = evaluateAuthSignals(cookieNames);

  if (!auth.authenticated) {
    throw new Error(
      `Chrome "${profileName}" profile is missing Claude auth signals. Missing: ${auth.missingSignals.join(', ')}. Log in to claude.ai in the Test profile and close Chrome before retrying.`
    );
  }

  return auth;
}

export async function writeCloneMetadata(metadata) {
  const metadataPath = getCloneMetadataPath(metadata.cloneDir);
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
  return metadataPath;
}

export async function refreshChromeProfileClone({
  profileName = DEFAULT_PROFILE_NAME,
  chromeUserDataDir = DEFAULT_CHROME_USER_DATA_DIR,
  cloneDir = DEFAULT_CLONE_DIR,
  browserPath = DEFAULT_BROWSER_PATH,
  execFile = execFileSync,
} = {}) {
  await assertChromeClosed({ chromeUserDataDir });

  const localState = await readLocalState(chromeUserDataDir);
  const profileDirectory = resolveProfileDirectoryFromLocalState(localState, profileName);
  await cloneChromeProfile({ chromeUserDataDir, profileDirectory, cloneDir });
  const auth = assertClaudeAuthenticated({
    cloneDir,
    profileDirectory,
    profileName,
    execFile,
  });

  const metadata = {
    profileName,
    profileDirectory,
    chromeUserDataDir,
    cloneDir,
    browserPath,
    refreshedAt: new Date().toISOString(),
    authSignals: auth.cookieNames,
  };

  await writeCloneMetadata(metadata);

  return metadata;
}

export async function createArtifactRunDir({
  rootDir = DEFAULT_ARTIFACT_ROOT,
  label = 'live',
} = {}) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(rootDir, `${timestamp}-${label}-${process.pid}`);
  await fs.mkdir(runDir, { recursive: true });
  return runDir;
}

export function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readLogTail(logPath, maxChars = 4000) {
  if (!(await fileExists(logPath))) {
    return '';
  }

  const raw = await fs.readFile(logPath, 'utf8');
  return raw.slice(-maxChars);
}

async function waitForDebuggerEndpoint({ port, chromeProcess, logPath, timeoutMs = 30_000 }) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (chromeProcess.exitCode !== null) {
      const logTail = await readLogTail(logPath);
      throw new Error(
        `Google Chrome exited before CDP was ready.${logTail ? `\n\n${logTail}` : ''}`
      );
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until Chrome exposes the debugger endpoint.
    }

    await new Promise(resolve => {
      setTimeout(resolve, 250);
    });
  }

  const logTail = await readLogTail(logPath);
  throw new Error(
    `Timed out waiting for Chrome debugger endpoint on port ${port}.${logTail ? `\n\n${logTail}` : ''}`
  );
}

async function stopChromeProcess(chromeProcess) {
  if (!chromeProcess || chromeProcess.exitCode !== null) {
    return;
  }

  const waitForExit = new Promise(resolve => {
    chromeProcess.once('exit', resolve);
  });

  chromeProcess.kill('SIGINT');

  const exitedGracefully = await Promise.race([
    waitForExit.then(() => true),
    new Promise(resolve => {
      setTimeout(() => resolve(false), 2_000);
    }),
  ]);

  if (exitedGracefully) {
    return;
  }

  chromeProcess.kill('SIGTERM');

  const exitedAfterTerm = await Promise.race([
    waitForExit.then(() => true),
    new Promise(resolve => {
      setTimeout(() => resolve(false), 2_000);
    }),
  ]);

  if (!exitedAfterTerm) {
    chromeProcess.kill('SIGKILL');
    await waitForExit;
  }
}

export async function launchLiveChrome({
  cloneDir = DEFAULT_CLONE_DIR,
  profileDirectory,
  browserPath = DEFAULT_BROWSER_PATH,
  artifactDir,
  loadExtensionPath = null,
  viewport = DEFAULT_VIEWPORT,
  headless = false,
} = {}) {
  if (!profileDirectory) {
    throw new Error('launchLiveChrome requires profileDirectory');
  }

  if (!(await fileExists(browserPath))) {
    throw new Error(`Google Chrome binary not found: ${browserPath}`);
  }

  const liveArtifactDir = artifactDir || (await createArtifactRunDir({ label: 'smoke' }));
  const remoteDebuggingPort = await getFreePort();
  const chromeLogPath = path.join(liveArtifactDir, 'chrome.log');
  const logStream = createWriteStream(chromeLogPath, { flags: 'a' });

  const args = [
    `--user-data-dir=${cloneDir}`,
    `--profile-directory=${profileDirectory}`,
    `--remote-debugging-port=${remoteDebuggingPort}`,
    `--window-size=${viewport.width},${viewport.height}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
  ];

  if (headless) {
    args.push('--headless=new');
  }

  if (loadExtensionPath) {
    args.push(`--disable-extensions-except=${loadExtensionPath}`);
    args.push(`--load-extension=${loadExtensionPath}`);
  }

  args.push('about:blank');

  const chromeProcess = spawn(browserPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  chromeProcess.stdout.pipe(logStream);
  chromeProcess.stderr.pipe(logStream);

  await waitForDebuggerEndpoint({
    port: remoteDebuggingPort,
    chromeProcess,
    logPath: chromeLogPath,
  });

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${remoteDebuggingPort}`);
  const context = browser.contexts()[0];

  return {
    browser,
    context,
    chromeProcess,
    remoteDebuggingPort,
    chromeLogPath,
    artifactDir: liveArtifactDir,
    headless,
    async close() {
      await browser.close();
      await stopChromeProcess(chromeProcess);
      await new Promise(resolve => {
        logStream.end(resolve);
      });
    },
  };
}

export async function waitForExtensionId(context, timeoutMs = 15_000) {
  const existing = context.serviceWorkers()[0];
  if (existing) {
    return new URL(existing.url()).host;
  }

  const worker = await Promise.race([
    context.waitForEvent('serviceworker'),
    new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error('Timed out waiting for extension service worker')),
        timeoutMs
      );
    }),
  ]);

  return new URL(worker.url()).host;
}

export async function openExtensionHarness(context, extensionId) {
  const page = await context.newPage();
  await page.goto(
    `chrome-extension://${extensionId}/test-support/playwright/extension-harness.html`
  );
  await page.waitForFunction(() => window.__clLeafTestHarness?.ready === true);
  return page;
}

export function collectLivePageSnapshot(page) {
  return page.evaluate(() => {
    const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
    const headingSample = Array.from(document.querySelectorAll('h1,h2,h3'))
      .map(element => (element.textContent || '').trim())
      .filter(Boolean)
      .slice(0, 8);
    const pathname = window.location.pathname;
    const renderCountNodes = Array.from(document.querySelectorAll('[data-test-render-count]'));
    const userMessages = renderCountNodes.filter(node => {
      return Boolean(node.querySelector('[data-testid="user-message"]'));
    });
    const editedMessageCount = renderCountNodes.reduce((count, container) => {
      const userMessage = container.querySelector('[data-testid="user-message"]');
      if (!userMessage) {
        return count;
      }

      const spans = container.querySelectorAll('span');
      for (const span of spans) {
        if (userMessage.contains(span)) {
          continue;
        }

        const label = (span.textContent || '').trim();
        if (!/^\d+\s*\/\s*\d+$/.test(label)) {
          continue;
        }

        const [, totalRaw] = label.split('/');
        const total = Number.parseInt((totalRaw || '').trim(), 10);
        if (Number.isFinite(total) && total > 1) {
          return count + 1;
        }
        break;
      }

      return count;
    }, 0);
    const authText = text.slice(0, 400);
    const authButtons = Array.from(document.querySelectorAll('button, a'))
      .map(element => (element.textContent || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .slice(0, 20);
    const authCtaVisible = authButtons.some(label => {
      return /(continue with google|continue with email|log in|sign in|welcome back)/i.test(label);
    });
    const loginish =
      pathname.startsWith('/login') ||
      pathname.startsWith('/signup') ||
      (!renderCountNodes.length &&
        !document.querySelector(
          'textarea,div[contenteditable="true"],form textarea,[contenteditable="true"][role="textbox"]'
        ) &&
        authCtaVisible &&
        /(log in|sign in|continue with google|welcome back)/i.test(authText));
    const challenge =
      pathname.startsWith('/cdn-cgi/') ||
      /security verification|verify you are not a bot|cloudflare/i.test(authText);

    return {
      url: window.location.href,
      pathname,
      title: document.title,
      main: Boolean(document.querySelector('main,[role="main"]')),
      composer: Boolean(
        document.querySelector(
          'textarea,div[contenteditable="true"],form textarea,[contenteditable="true"][role="textbox"]'
        )
      ),
      sidebar: Boolean(document.querySelector('nav[aria-label="Sidebar"], aside nav, aside')),
      loginish,
      challenge,
      messageCount: renderCountNodes.length,
      userMessageCount: userMessages.length,
      retryButtonCount: document.querySelectorAll(
        '[data-testid="action-bar-retry"], button[aria-label="Retry"]'
      ).length,
      editedMessageCount,
      headingSample,
      textSample: text.slice(0, 320),
    };
  });
}

export function evaluateLiveRouteResult(routeKey, snapshot, expectations = {}) {
  const checks = [
    {
      id: 'auth_gate',
      pass: !snapshot.loginish,
      message: snapshot.loginish ? 'Login screen detected' : 'Not on login screen',
    },
    {
      id: 'challenge_gate',
      pass: !snapshot.challenge,
      message: snapshot.challenge
        ? 'Cloudflare/security challenge detected'
        : 'No challenge screen',
    },
  ];

  if (routeKey === 'new') {
    checks.push({
      id: 'composer',
      pass: snapshot.composer,
      message: snapshot.composer ? 'Composer detected' : 'Composer missing on /new',
    });
    checks.push({
      id: 'sidebar',
      pass: snapshot.sidebar,
      message: snapshot.sidebar ? 'Sidebar detected' : 'Sidebar missing on /new',
    });
    checks.push({
      id: 'path',
      pass: snapshot.pathname === '/new',
      message:
        snapshot.pathname === '/new' ? 'Stayed on /new' : `Unexpected path ${snapshot.pathname}`,
    });
  }

  if (routeKey === 'recents') {
    checks.push({
      id: 'sidebar',
      pass: snapshot.sidebar,
      message: snapshot.sidebar ? 'Sidebar detected' : 'Sidebar missing on /recents',
    });
    checks.push({
      id: 'path',
      pass: snapshot.pathname === '/recents',
      message:
        snapshot.pathname === '/recents'
          ? 'Stayed on /recents'
          : `Unexpected path ${snapshot.pathname}`,
    });
  }

  if (routeKey === 'chat') {
    checks.push({
      id: 'composer',
      pass: snapshot.composer,
      message: snapshot.composer ? 'Composer detected' : 'Composer missing on chat route',
    });
    checks.push({
      id: 'sidebar',
      pass: snapshot.sidebar,
      message: snapshot.sidebar ? 'Sidebar detected' : 'Sidebar missing on chat route',
    });
    checks.push({
      id: 'path',
      pass: snapshot.pathname.startsWith('/chat/'),
      message: snapshot.pathname.startsWith('/chat/')
        ? 'Resolved to chat route'
        : `Unexpected path ${snapshot.pathname}`,
    });
    checks.push({
      id: 'messages',
      pass: snapshot.messageCount >= (expectations.minMessages || 1),
      message:
        snapshot.messageCount >= (expectations.minMessages || 1)
          ? `Detected ${snapshot.messageCount} rendered messages`
          : `Expected at least ${expectations.minMessages || 1} rendered messages, found ${snapshot.messageCount}`,
    });

    if (expectations.minUserMessages) {
      checks.push({
        id: 'user_messages',
        pass: snapshot.userMessageCount >= expectations.minUserMessages,
        message:
          snapshot.userMessageCount >= expectations.minUserMessages
            ? `Detected ${snapshot.userMessageCount} user messages`
            : `Expected at least ${expectations.minUserMessages} user messages, found ${snapshot.userMessageCount}`,
      });
    }

    if (expectations.requiresEditedMessages) {
      checks.push({
        id: 'edited_messages',
        pass: snapshot.editedMessageCount >= (expectations.minEditedMessages || 1),
        message:
          snapshot.editedMessageCount >= (expectations.minEditedMessages || 1)
            ? `Detected ${snapshot.editedMessageCount} edited messages`
            : `Expected at least ${expectations.minEditedMessages || 1} edited messages, found ${snapshot.editedMessageCount}`,
      });
    }
  }

  if (routeKey === 'projects') {
    checks.push({
      id: 'sidebar',
      pass: snapshot.sidebar,
      message: snapshot.sidebar ? 'Sidebar detected' : 'Sidebar missing on /projects',
    });
    checks.push({
      id: 'path',
      pass: snapshot.pathname === '/projects',
      message:
        snapshot.pathname === '/projects'
          ? 'Stayed on /projects'
          : `Unexpected path ${snapshot.pathname}`,
    });
  }

  if (routeKey === 'code') {
    checks.push({
      id: 'composer',
      pass: snapshot.composer,
      message: snapshot.composer ? 'Composer detected' : 'Composer missing on code route',
    });
    checks.push({
      id: 'path',
      pass: snapshot.pathname === '/code' || snapshot.pathname.startsWith('/code/'),
      message:
        snapshot.pathname === '/code' || snapshot.pathname.startsWith('/code/')
          ? 'Resolved to code route'
          : `Unexpected path ${snapshot.pathname}`,
    });
  }

  return {
    pass: checks.every(check => check.pass),
    checks,
  };
}

export async function writeJson(targetPath, payload) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, JSON.stringify(payload, null, 2), 'utf8');
}
