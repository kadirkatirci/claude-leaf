import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { setupDom } from '../test-support/dom.js';

const contentScriptPath = new URL('../tools/claude-web-guardian/src/content.js', import.meta.url);
const contentScriptSource = fs.readFileSync(contentScriptPath, 'utf8');

function loadGuardianChecks() {
  window.__CWG_DISABLE_AUTO_MONITOR__ = true;
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

  new vm.Script(`${contentScriptSource}\nthis.__CWG_TEST__ = { runChecks, runChecksWhenStable };`, {
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

test('code workspace routes are recognized without treating them as selector drift', () => {
  const cleanup = setupDom('<main><div>Claude Code</div></main>');

  try {
    window.history.replaceState({}, '', '/code/test-workspace');
    const { runChecks } = loadGuardianChecks();
    const result = runChecks({ routes: true });
    const routeCheck = result.checks.find(check => check.id === 'route_detection');

    assert.equal(result.pageMeta?.pageType, 'code');
    assert.equal(routeCheck?.pass, true);
    assert.match(routeCheck?.message || '', /code/i);
  } finally {
    cleanup();
  }
});

test('runChecksWhenStable waits for conversation messages before reporting', async () => {
  const cleanup = setupDom('<main><div id="placeholder">Loading</div></main>');

  try {
    window.history.replaceState({}, '', '/chat/test-thread');
    const { runChecksWhenStable } = loadGuardianChecks();

    window.setTimeout(() => {
      const main = document.querySelector('main');
      const message = document.createElement('div');
      const userMessage = document.createElement('div');
      message.setAttribute('data-testid', 'conversation-turn-1');
      userMessage.setAttribute('data-testid', 'user-message');
      userMessage.textContent = 'Prompt A';
      message.appendChild(userMessage);
      main.appendChild(message);
    }, 40);

    const result = await runChecksWhenStable(
      { domCore: true },
      { timeoutMs: 400, intervalMs: 30, requiredStableSamples: 2 }
    );
    const messageCheck = result.checks.find(check => check.id === 'message_nodes');

    assert.equal(messageCheck?.pass, true);
    assert.ok((messageCheck?.details?.count || 0) >= 1);
  } finally {
    cleanup();
  }
});
