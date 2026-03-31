import { spawn } from 'node:child_process';

function parseRunnerArgs(argv) {
  const forwarded = [];
  let headlessOverride = null;

  for (const arg of argv) {
    if (arg === '--headless') {
      headlessOverride = '1';
      continue;
    }

    if (arg === '--headed') {
      headlessOverride = '0';
      continue;
    }

    forwarded.push(arg);
  }

  return { forwarded, headlessOverride };
}

const { forwarded, headlessOverride } = parseRunnerArgs(process.argv.slice(2));

const child = spawn(
  'npx',
  ['playwright', 'test', '-c', 'playwright.config.js', ...forwarded],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...(headlessOverride ? { CLAUDE_LEAF_HEADLESS: headlessOverride } : {}),
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
