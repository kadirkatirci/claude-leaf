import { spawn } from 'node:child_process';

function parseRunnerArgs(argv) {
  const forwarded = [];
  let headlessOverride = null;
  let requireExtension = false;

  for (const arg of argv) {
    if (arg === '--headless') {
      headlessOverride = '1';
      continue;
    }

    if (arg === '--headed') {
      headlessOverride = '0';
      continue;
    }

    if (arg === '--require-extension') {
      requireExtension = true;
      continue;
    }

    forwarded.push(arg);
  }

  return { forwarded, headlessOverride, requireExtension };
}

const { forwarded, headlessOverride, requireExtension } = parseRunnerArgs(process.argv.slice(2));

const child = spawn(
  'npx',
  ['playwright', 'test', '-c', 'playwright.live.config.js', ...forwarded],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...(headlessOverride ? { CLAUDE_LEAF_LIVE_HEADLESS: headlessOverride } : {}),
      ...(requireExtension ? { CLAUDE_LEAF_LIVE_REQUIRE_EXTENSION: '1' } : {}),
    },
  }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
