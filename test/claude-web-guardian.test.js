import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { setupDom } from '../test-support/dom.js';

const contentScriptPath = new URL('../tools/claude-web-guardian/src/content.js', import.meta.url);
const contentScriptSource = fs.readFileSync(contentScriptPath, 'utf8');

function loadGuardianChecks() {
  const context = vm.createContext({
    window,
    document,
    chrome: {
      runtime: {
        onMessage: {
          addListener() {},
        },
      },
    },
  });

  new vm.Script(`${contentScriptSource}\nthis.__CWG_TEST__ = { runChecks };`, {
    filename: 'claude-web-guardian-content.js',
  }).runInContext(context);

  return context.__CWG_TEST__;
}

test('main_container passes when conversation content is found via body fallback', () => {
  const cleanup = setupDom(`
    <div data-testid="conversation-turn-1">
      <div data-testid="user-message">Prompt A</div>
    </div>
  `);

  try {
    window.history.replaceState({}, '', '/chat/test-thread');
    const { runChecks } = loadGuardianChecks();
    const result = runChecks({ domCore: true });
    const mainCheck = result.checks.find(check => check.id === 'main_container');

    assert.equal(mainCheck?.pass, true);
    assert.equal(mainCheck?.details?.strategy, 'body_fallback');
    assert.match(mainCheck?.message || '', /body fallback/i);
  } finally {
    cleanup();
  }
});

test('retry_icon_signature passes when conversation has no edited prompts', () => {
  const cleanup = setupDom(`
    <main>
      <div data-testid="conversation-turn-1">
        <div data-testid="user-message">Prompt A</div>
        <div class="inline-flex items-center gap-1"><span>1 / 1</span></div>
      </div>
    </main>
  `);

  try {
    window.history.replaceState({}, '', '/chat/test-thread');
    const { runChecks } = loadGuardianChecks();
    const result = runChecks({ editHistory: true });
    const retryCheck = result.checks.find(check => check.id === 'retry_icon_signature');

    assert.equal(retryCheck?.pass, true);
    assert.match(retryCheck?.message || '', /not required/i);
  } finally {
    cleanup();
  }
});

test('retry_icon_signature still fails when edited prompts exist without a retry control', () => {
  const cleanup = setupDom(`
    <main>
      <div data-testid="conversation-turn-1">
        <div data-testid="user-message">Prompt A</div>
        <div class="inline-flex items-center gap-1"><span>2 / 2</span></div>
      </div>
    </main>
  `);

  try {
    window.history.replaceState({}, '', '/chat/test-thread');
    const { runChecks } = loadGuardianChecks();
    const result = runChecks({ editHistory: true });
    const retryCheck = result.checks.find(check => check.id === 'retry_icon_signature');

    assert.equal(retryCheck?.pass, false);
    assert.match(retryCheck?.message || '', /missing/i);
  } finally {
    cleanup();
  }
});
