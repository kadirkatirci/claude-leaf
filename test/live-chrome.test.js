import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  assertChromeClosed,
  cloneChromeProfile,
  detectInstalledExtension,
  evaluateAuthSignals,
  evaluateLiveRouteResult,
  parsePgrepOutput,
  readClaudeCookieNames,
  resolveProfileDirectoryFromLocalState,
  shouldCopyProfileRelativePath,
} from '../scripts/fixtures/lib/liveChrome.js';

function createTempDir(prefix) {
  return mkdtempSync(path.join(tmpdir(), prefix));
}

test('resolveProfileDirectoryFromLocalState maps Chrome profile name to directory', () => {
  const profileDirectory = resolveProfileDirectoryFromLocalState(
    {
      profile: {
        info_cache: {
          'Profile 1': { name: 'Default' },
          'Profile 3': { name: 'Test' },
        },
      },
    },
    'Test'
  );

  assert.equal(profileDirectory, 'Profile 3');
});

test('parsePgrepOutput keeps pid and command pairs', () => {
  const parsed = parsePgrepOutput('123 Google Chrome\n456 /Applications/Google Chrome Helper\n');

  assert.deepEqual(parsed, [
    { pid: 123, command: 'Google Chrome' },
    { pid: 456, command: '/Applications/Google Chrome Helper' },
  ]);
});

test('assertChromeClosed fails when live Chrome processes or singleton locks exist', async () => {
  await assert.rejects(
    assertChromeClosed({
      chromeUserDataDir: '/tmp/chrome',
      getProcesses: () => [{ pid: 42, command: 'Google Chrome' }],
      getSingletons: () => Promise.resolve([]),
    }),
    /Google Chrome must be fully closed/
  );

  await assert.rejects(
    assertChromeClosed({
      chromeUserDataDir: '/tmp/chrome',
      getProcesses: () => [],
      getSingletons: () => Promise.resolve(['/tmp/chrome/SingletonLock']),
    }),
    /SingletonLock/
  );
});

test('shouldCopyProfileRelativePath excludes ephemeral cache and lock paths', () => {
  assert.equal(shouldCopyProfileRelativePath('Cookies'), true);
  assert.equal(shouldCopyProfileRelativePath('Local Storage/leveldb/000003.log'), true);
  assert.equal(shouldCopyProfileRelativePath('Cache/index'), false);
  assert.equal(shouldCopyProfileRelativePath('Service Worker/CacheStorage/data'), false);
  assert.equal(shouldCopyProfileRelativePath('GPUCache/data'), false);
  assert.equal(shouldCopyProfileRelativePath('LOCK'), false);
  assert.equal(shouldCopyProfileRelativePath('SingletonSocket'), false);
  assert.equal(shouldCopyProfileRelativePath('foo/bar/file.tmp'), false);
});

test('cloneChromeProfile copies Local State and omits filtered profile paths', async () => {
  const sourceRoot = createTempDir('claude-live-source-');
  const cloneRoot = createTempDir('claude-live-clone-');
  const profileDirectory = 'Profile 3';

  try {
    mkdirSync(path.join(sourceRoot, profileDirectory, 'Local Storage'), { recursive: true });
    mkdirSync(path.join(sourceRoot, profileDirectory, 'Cache'), { recursive: true });
    mkdirSync(path.join(sourceRoot, profileDirectory, 'Service Worker', 'CacheStorage'), {
      recursive: true,
    });

    writeFileSync(path.join(sourceRoot, 'Local State'), '{"profile":{"info_cache":{}}}');
    writeFileSync(path.join(sourceRoot, profileDirectory, 'Cookies'), 'cookie-db');
    writeFileSync(path.join(sourceRoot, profileDirectory, 'Local Storage', 'keep.txt'), 'keep me');
    writeFileSync(path.join(sourceRoot, profileDirectory, 'Cache', 'omit.txt'), 'omit me');
    writeFileSync(
      path.join(sourceRoot, profileDirectory, 'Service Worker', 'CacheStorage', 'omit.txt'),
      'omit me'
    );
    writeFileSync(path.join(sourceRoot, profileDirectory, 'LOCK'), 'locked');

    await cloneChromeProfile({
      chromeUserDataDir: sourceRoot,
      profileDirectory,
      cloneDir: cloneRoot,
    });

    assert.equal(
      readFileSync(path.join(cloneRoot, 'Local State'), 'utf8'),
      '{"profile":{"info_cache":{}}}'
    );
    assert.equal(existsSync(path.join(cloneRoot, profileDirectory, 'Cookies')), true);
    assert.equal(
      readFileSync(path.join(cloneRoot, profileDirectory, 'Local Storage', 'keep.txt'), 'utf8'),
      'keep me'
    );
    assert.equal(existsSync(path.join(cloneRoot, profileDirectory, 'Cache', 'omit.txt')), false);
    assert.equal(
      existsSync(
        path.join(cloneRoot, profileDirectory, 'Service Worker', 'CacheStorage', 'omit.txt')
      ),
      false
    );
    assert.equal(existsSync(path.join(cloneRoot, profileDirectory, 'LOCK')), false);
  } finally {
    rmSync(sourceRoot, { recursive: true, force: true });
    rmSync(cloneRoot, { recursive: true, force: true });
  }
});

test('readClaudeCookieNames and evaluateAuthSignals detect required Claude auth cookies', () => {
  const rootDir = createTempDir('claude-live-cookies-');
  const cookiesDbPath = path.join(rootDir, 'Cookies');

  try {
    execFileSync(
      'python3',
      [
        '-c',
        `
import sqlite3
import sys

db_path = sys.argv[1]
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("create table cookies (host_key text, name text, path text, expires_utc integer)")
cur.executemany(
  "insert into cookies(host_key, name, path, expires_utc) values (?, ?, '/', 0)",
  [
    ('.claude.ai', 'sessionKey'),
    ('.claude.ai', 'lastActiveOrg'),
    ('.claude.ai', 'routingHint'),
    ('.claude.ai', 'cf_clearance'),
  ]
)
conn.commit()
conn.close()
`,
        cookiesDbPath,
      ],
      { encoding: 'utf8' }
    );

    const cookieNames = readClaudeCookieNames(cookiesDbPath);
    const auth = evaluateAuthSignals(cookieNames);

    assert.equal(auth.authenticated, true);
    assert.deepEqual(auth.missingSignals, []);
    assert.equal(cookieNames.includes('sessionKey'), true);
    assert.equal(cookieNames.includes('routingHint'), true);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test('detectInstalledExtension finds the unpacked Claude Leaf install by path and state', () => {
  const detected = detectInstalledExtension(
    {
      extensions: {
        settings: {
          abcdefghijklmnopabcdefghijklmnop: {
            path: '/repo/claude-leaf',
            state: 1,
            location: 8,
            manifest: {
              name: 'Claude Leaf',
            },
          },
        },
      },
    },
    {
      extensionPath: '/repo/claude-leaf',
    }
  );

  assert.equal(detected.installed, true);
  assert.equal(detected.enabled, true);
  assert.equal(detected.id, 'abcdefghijklmnopabcdefghijklmnop');
});

test('detectInstalledExtension returns not installed when the profile lacks Claude Leaf', () => {
  const detected = detectInstalledExtension(
    {
      extensions: {
        settings: {
          someotherextensionid: {
            path: '/repo/other',
            state: 1,
            manifest: {
              name: 'Other Extension',
            },
          },
        },
      },
    },
    {
      extensionPath: '/repo/claude-leaf',
    }
  );

  assert.equal(detected.installed, false);
  assert.equal(detected.enabled, false);
});

test('evaluateLiveRouteResult uses route-specific readiness contracts', () => {
  const chat = evaluateLiveRouteResult(
    'chat',
    {
      pathname: '/chat/thread-1',
      composer: true,
      sidebar: true,
      main: false,
      loginish: false,
      challenge: false,
      messageCount: 14,
      userMessageCount: 7,
      editedMessageCount: 2,
    },
    {
      minMessages: 8,
      minUserMessages: 4,
      requiresEditedMessages: true,
      minEditedMessages: 1,
    }
  );
  assert.equal(chat.pass, true);

  const code = evaluateLiveRouteResult('code', {
    pathname: '/code/draft_123',
    composer: true,
    sidebar: false,
    main: false,
    loginish: false,
    challenge: false,
  });
  assert.equal(code.pass, true);

  const brokenNew = evaluateLiveRouteResult('new', {
    pathname: '/new',
    composer: false,
    sidebar: true,
    main: true,
    loginish: false,
    challenge: false,
    messageCount: 0,
    userMessageCount: 0,
    editedMessageCount: 0,
  });
  assert.equal(brokenNew.pass, false);
  assert.equal(
    brokenNew.checks.some(check => check.id === 'composer' && check.pass === false),
    true
  );
});
