import test from 'node:test';
import assert from 'node:assert/strict';
import ThemeManager from '../src/managers/ThemeManager.js';
import { generateGlobalCss } from '../src/managers/theme/themeCss.js';
import { createCustomTheme } from '../src/managers/theme/themeColorUtils.js';
import { setupDom } from '../test-support/dom.js';

test('ThemeManager keeps CSS output and root property behavior stable', () => {
  const cleanup = setupDom();

  try {
    ThemeManager.init({
      general: {
        colorTheme: 'custom',
        customColor: '#336699',
        opacity: 0.75,
        highlightPadding: { top: 1, right: 2, bottom: 3, left: 4 },
        highlightMargin: { top: 5, right: 6, bottom: 7, left: 8 },
      },
    });

    const styleElement = document.getElementById('claude-productivity-global-styles');
    assert.ok(styleElement);
    assert.match(styleElement.textContent, /--claude-productivity-primary:\s*#336699/);
    assert.equal(
      document.documentElement.style.getPropertyValue('--claude-productivity-primary'),
      ''
    );

    ThemeManager.setTheme('custom', '#336699');
    ThemeManager.setHighlightMargin({ top: 5, right: 6, bottom: 7, left: 8 });

    assert.equal(
      document.documentElement.style.getPropertyValue('--claude-productivity-primary'),
      '#336699'
    );
    assert.equal(
      document.documentElement.style.getPropertyValue(
        '--claude-productivity-highlight-margin-right'
      ),
      '6px'
    );
  } finally {
    ThemeManager.destroy();
    cleanup();
  }
});

test('theme helpers preserve custom theme derivation and CSS generation', () => {
  const theme = createCustomTheme('#123456');
  const css = generateGlobalCss(
    theme,
    new Map([
      ['--claude-productivity-opacity', 0.8],
      ['--claude-productivity-highlight-padding-top', '1px'],
      ['--claude-productivity-highlight-padding-right', '2px'],
      ['--claude-productivity-highlight-padding-bottom', '3px'],
      ['--claude-productivity-highlight-padding-left', '4px'],
      ['--claude-productivity-highlight-margin-top', '5px'],
      ['--claude-productivity-highlight-margin-right', '6px'],
      ['--claude-productivity-highlight-margin-bottom', '7px'],
      ['--claude-productivity-highlight-margin-left', '8px'],
    ])
  );

  assert.match(theme.hover, /^#/);
  assert.match(theme.active, /^#/);
  assert.match(css, /--claude-productivity-opacity:\s*0.8/);
  assert.match(css, /claude-nav-highlight/);
});
