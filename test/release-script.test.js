import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
  });
}

function writeFile(repoDir, relativePath, content, mode) {
  const fullPath = path.join(repoDir, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content);
  if (mode) {
    chmodSync(fullPath, mode);
  }
}

function writeExecutable(filePath, content) {
  writeFileSync(filePath, content);
  chmodSync(filePath, 0o755);
}

function createFixtureRepo(options = {}) {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'claude-leaf-release-'));
  const repoDir = path.join(rootDir, 'repo');
  const originDir = path.join(rootDir, 'origin.git');
  mkdirSync(repoDir, { recursive: true });

  cpSync(path.join(REPO_ROOT, 'release.sh'), path.join(repoDir, 'release.sh'));
  chmodSync(path.join(repoDir, 'release.sh'), 0o755);

  writeFile(repoDir, '.gitignore', '.env\nnode_modules/\ndist/\nrelease/\n.DS_Store\n*.log\n');
  writeFile(
    repoDir,
    'package.json',
    JSON.stringify(
      {
        name: 'release-smoke-fixture',
        version: '1.0.0',
        scripts: {
          build: 'echo build',
        },
      },
      null,
      2
    ) + '\n'
  );
  writeFile(
    repoDir,
    'manifest.json',
    JSON.stringify(
      {
        manifest_version: 3,
        name: 'Release Smoke Fixture',
        version: '1.0.0',
      },
      null,
      2
    ) + '\n'
  );
  writeFile(
    repoDir,
    'CHANGELOG.md',
    [
      '# Changelog',
      '',
      '## [1.0.0] - 2026-03-26',
      'type: major',
      'title: Initial release',
      '',
      '### Added',
      '- Initial release',
      '',
    ].join('\n')
  );
  writeFile(repoDir, 'styles.css', 'body { color: #111111; }\n');
  writeFile(repoDir, 'src/background.js', 'console.log("background");\n');
  writeFile(repoDir, 'popup/popup.css', 'body { color: #222222; }\n');
  writeFile(repoDir, 'popup/popup.html', '<!doctype html><html><body>popup</body></html>\n');
  writeFile(repoDir, 'icons/icon16.png', 'icon16\n');
  writeFile(repoDir, 'icons/icon48.png', 'icon48\n');
  writeFile(repoDir, 'icons/icon128.png', 'icon128\n');

  git(repoDir, ['init', '-b', 'main']);
  git(repoDir, ['config', 'user.name', 'Release Test']);
  git(repoDir, ['config', 'user.email', 'release-test@example.com']);
  git(repoDir, ['add', '.']);
  git(repoDir, ['commit', '-m', 'init']);
  git(repoDir, ['tag', 'v1.0.0']);

  git(rootDir, ['init', '--bare', originDir]);
  git(repoDir, ['remote', 'add', 'origin', originDir]);
  git(repoDir, ['push', '-u', 'origin', 'main']);

  writeFile(
    repoDir,
    'CHANGELOG.md',
    [
      '# Changelog',
      '',
      '## [1.0.1] - 2026-03-29',
      'type: patch',
      'title: Smoke release',
      '',
      '### Fixed',
      '- Tightened release validation',
      '',
      '## [1.0.0] - 2026-03-26',
      'type: major',
      'title: Initial release',
      '',
      '### Added',
      '- Initial release',
      '',
    ].join('\n')
  );

  if (options.withEnv) {
    writeFile(
      repoDir,
      '.env',
      [
        'CWS_CLIENT_ID=test-client',
        'CWS_CLIENT_SECRET=test-secret',
        'CWS_REFRESH_TOKEN=test-refresh',
        'CWS_EXTENSION_ID=test-extension',
        'CWS_PUBLISHER_ID=test-publisher',
        'TEDAI_API_BASE_URL=https://www.example.com/api/external/v1',
        'TEDAI_API_KEY=test-api-key',
        'TEDAI_EXTENSION_ID=test-extension-uuid',
        '',
      ].join('\n')
    );
  }

  let env = { ...process.env };
  if (options.withMocks) {
    const binDir = path.join(rootDir, 'bin');
    mkdirSync(binDir, { recursive: true });

    writeExecutable(
      path.join(binDir, 'npm'),
      `#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" != "run build" ]]; then
  echo "unexpected npm args: $*" >&2
  exit 1
fi
mkdir -p dist
printf 'bundle\\n' > dist/content.bundle.js
printf 'body { color: #123456; }\\n' > styles.css
printf 'body { color: #abcdef; }\\n' > popup/popup.css
`
    );

    writeExecutable(
      path.join(binDir, 'curl'),
      `#!/usr/bin/env bash
set -euo pipefail
url=""
for arg in "$@"; do
  if [[ "$arg" == http* ]]; then
    url="$arg"
  fi
done

if [[ -z "$url" ]]; then
  echo "unexpected curl args: $*" >&2
  exit 1
fi

case "$url" in
  https://oauth2.googleapis.com/token)
    printf '{"access_token":"test-token"}'
    ;;
  https://chromewebstore.googleapis.com/upload/v2/publishers/test-publisher/items/test-extension:upload)
    printf '{"uploadState":"IN_PROGRESS"}'
    ;;
  https://chromewebstore.googleapis.com/v2/publishers/test-publisher/items/test-extension:fetchStatus)
    printf '{"lastAsyncUploadState":"SUCCEEDED"}'
    ;;
  https://chromewebstore.googleapis.com/v2/publishers/test-publisher/items/test-extension:publish)
    printf '{"state":"PENDING_REVIEW"}'
    ;;
  https://www.example.com/api/external/v1/extensions/test-extension-uuid/changelog)
    printf '{"ok":true}\\n201'
    ;;
  *)
    echo "unexpected curl url: $url" >&2
    exit 1
    ;;
esac
`
    );

    writeExecutable(
      path.join(binDir, 'sleep'),
      `#!/usr/bin/env bash
exit 0
`
    );

    env = {
      ...env,
      PATH: `${binDir}:${env.PATH}`,
    };
  }

  return { env, repoDir, rootDir };
}

function runRelease(repoDir, args, env) {
  return spawnSync('./release.sh', args, {
    cwd: repoDir,
    env,
    encoding: 'utf8',
  });
}

function formatFailure(result) {
  return [`exit code: ${result.status}`, 'stdout:', result.stdout, 'stderr:', result.stderr].join(
    '\n'
  );
}

test('release script dry-run succeeds without .env when only CHANGELOG.md is modified', t => {
  const fixture = createFixtureRepo();
  t.after(() => rmSync(fixture.rootDir, { force: true, recursive: true }));

  const result = runRelease(fixture.repoDir, ['--dry-run', '--yes'], fixture.env);

  assert.equal(result.status, 0, formatFailure(result));
  assert.match(result.stdout, /Dry run: skipping \.env load and credential validation/);
  assert.match(result.stdout, /Chrome Web Store:.*dry-run/s);
  assert.equal(git(fixture.repoDir, ['status', '--short']), ' M CHANGELOG.md\n');
});

test('release script smoke test completes a mocked live release and pushes the tag', t => {
  const fixture = createFixtureRepo({ withEnv: true, withMocks: true });
  t.after(() => rmSync(fixture.rootDir, { force: true, recursive: true }));

  const result = runRelease(fixture.repoDir, ['--yes'], fixture.env);

  assert.equal(result.status, 0, formatFailure(result));
  assert.match(result.stdout, /Upload still processing; polling Chrome Web Store/);
  assert.match(result.stdout, /Chrome Web Store:.*PENDING_REVIEW/s);
  assert.match(result.stdout, /tedaitesnim\.com:.*HTTP 201/s);

  assert.equal(git(fixture.repoDir, ['status', '--short']), '');
  assert.equal(git(fixture.repoDir, ['tag', '--list', 'v1.0.1']), 'v1.0.1\n');
  assert.match(
    git(fixture.repoDir, ['log', '-1', '--pretty=%s']),
    /^release: v1\.0\.1 .* Smoke release\n$/
  );

  const changedFiles = git(fixture.repoDir, ['show', '--name-only', '--pretty=format:', 'HEAD']);
  assert.match(changedFiles, /CHANGELOG\.md/);
  assert.match(changedFiles, /manifest\.json/);
  assert.match(changedFiles, /package\.json/);
  assert.match(changedFiles, /styles\.css/);
  assert.match(changedFiles, /popup\/popup\.css/);

  assert.equal(
    readFileSync(path.join(fixture.repoDir, 'styles.css'), 'utf8'),
    'body { color: #123456; }\n'
  );
  assert.equal(
    readFileSync(path.join(fixture.repoDir, 'popup', 'popup.css'), 'utf8'),
    'body { color: #abcdef; }\n'
  );
  assert.ok(existsSync(path.join(fixture.repoDir, 'release', 'claude-leaf-webstore-1.0.1.zip')));
  assert.match(
    git(fixture.repoDir, ['ls-remote', '--tags', 'origin', 'refs/tags/v1.0.1']),
    /refs\/tags\/v1\.0\.1/
  );
});
