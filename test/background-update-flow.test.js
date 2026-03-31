import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const backgroundScriptPath = new URL('../src/background.js', import.meta.url);
const backgroundScriptSource = fs.readFileSync(backgroundScriptPath, 'utf8');

function loadBackgroundRuntime(manifestVersion = '1.0.0') {
  const createdTabs = [];
  const listeners = {};

  const chrome = {
    tabs: {
      create({ url }) {
        createdTabs.push(url);
      },
    },
    runtime: {
      getManifest() {
        return { version: manifestVersion };
      },
      reload() {},
      onInstalled: {
        addListener(listener) {
          listeners.onInstalled = listener;
        },
      },
      onUpdateAvailable: {
        addListener(listener) {
          listeners.onUpdateAvailable = listener;
        },
      },
      onMessage: {
        addListener(listener) {
          listeners.onMessage = listener;
        },
      },
    },
  };

  const context = vm.createContext({
    chrome,
    console,
    URL,
  });

  new vm.Script(backgroundScriptSource, { filename: 'background.js' }).runInContext(context);

  return { createdTabs, listeners };
}

test('opens changelog with update analytics query params on real version updates', async () => {
  const { createdTabs, listeners } = loadBackgroundRuntime('1.0.0');

  listeners.onInstalled({ reason: 'update', previousVersion: '0.9.5' });
  await Promise.resolve();

  assert.deepEqual(createdTabs, [
    'https://www.tedaitesnim.com/extensions/claude-extension/changelog?source=extension-update&from=0.9.5&to=1.0.0',
  ]);
});

test('does not open changelog when previous version matches current version', async () => {
  const { createdTabs, listeners } = loadBackgroundRuntime('1.0.0');

  listeners.onInstalled({ reason: 'update', previousVersion: '1.0.0' });
  await Promise.resolve();

  assert.deepEqual(createdTabs, []);
});
