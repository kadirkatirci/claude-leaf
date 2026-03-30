import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getDevDisabledModules } from '../src/config/DevConfig.js';
import { loadPopupDevConfig } from '../popup/devConfig.js';

test('popup dev config mirrors runtime dev-disabled modules', async () => {
  const popupDevConfig = await loadPopupDevConfig();
  const popupConfig = JSON.parse(
    readFileSync(new URL('../popup/config.json', import.meta.url), 'utf8')
  );

  assert.deepEqual(popupDevConfig, {
    disabledModules: getDevDisabledModules(),
  });

  for (const moduleId of popupDevConfig.disabledModules) {
    assert.ok(
      popupConfig.modules[moduleId],
      `Expected popup/config.json to define dev-disabled module "${moduleId}"`
    );
  }
});
