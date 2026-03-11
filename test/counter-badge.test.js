import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Badge from '../src/components/primitives/Badge.js';
import Button from '../src/components/primitives/Button.js';
import CounterBadge from '../src/components/primitives/CounterBadge.js';
import { badgeVariantClass, buttonClass, counterBadgeClass } from '../src/utils/ClassNames.js';
import { setupDom } from '../test-support/dom.js';

test('counter badges use the repo-owned accent class instead of host accent utilities', () => {
  const cleanup = setupDom();

  try {
    const badge = CounterBadge.create({ content: '3' });

    assert.match(counterBadgeClass(), /\bclp-counter-badge\b/);
    assert.match(badge.className, /\bclp-counter-badge\b/);
    assert.doesNotMatch(badge.className, /\bbg-accent-main-100\b/);
  } finally {
    cleanup();
  }
});

test('bookmark message buttons use the repo-owned accent class when bookmarked', async () => {
  const cleanup = setupDom('<div id="message"></div>');

  try {
    const { BookmarkButton } = await import('../src/modules/BookmarkModule/BookmarkButton.js');
    const bookmarkButton = new BookmarkButton(
      {
        createElement: tagName => document.createElement(tagName),
      },
      () => ({})
    );

    const message = document.getElementById('message');
    const button = bookmarkButton.createButton(message, 'bookmark-1', true, () => {});

    assert.match(button.className, /\bclp-button-primary\b/);
    assert.doesNotMatch(button.className, /\bbg-accent-main-100\b/);
  } finally {
    cleanup();
  }
});

test('bookmark manager primary action buttons use the repo-owned accent class', async () => {
  const cleanup = setupDom();
  const originalBroadcastChannel = globalThis.BroadcastChannel;
  let navigationInterceptor;

  try {
    globalThis.BroadcastChannel = undefined;
    const { BookmarkManagerModal } =
      await import('../src/modules/BookmarkModule/BookmarkManagerModal.js');
    ({ default: navigationInterceptor } = await import('../src/core/NavigationInterceptor.js'));
    const modal = new BookmarkManagerModal();

    assert.match(modal.getActionButtonClass('primary'), /\bclp-button-primary\b/);
    assert.match(modal.getActionButtonClass('primaryLg'), /\bclp-button-primary\b/);
    assert.doesNotMatch(modal.getActionButtonClass('primary'), /\bbg-accent-main-100\b/);
    assert.doesNotMatch(modal.getActionButtonClass('primaryLg'), /\bbg-accent-main-100\b/);
  } finally {
    navigationInterceptor?.destroy();
    globalThis.BroadcastChannel = originalBroadcastChannel;
    cleanup();
  }
});

test('content accent compatibility layer covers remaining accent utility classes', () => {
  const css = readFileSync(new URL('../src/styles/content-core.css', import.meta.url), 'utf8');

  assert.match(css, /\.bg-accent-main-100\s*\{/);
  assert.match(css, /\.bg-accent-main-100\\\/10\s*\{/);
  assert.match(css, /\.text-accent-main-100\s*\{/);
  assert.match(css, /\.border-accent-main-100\s*\{/);
  assert.match(css, /\.hover\\:text-accent-main-100:hover\s*\{/);
  assert.match(css, /\.hover\\:border-accent-main-100\\\/50:hover\s*\{/);
  assert.match(css, /\.focus\\:border-accent-main-100:focus\s*\{/);
});

test('accent badges use the repo-owned accent class instead of host accent utilities', () => {
  const cleanup = setupDom();

  try {
    const badge = Badge.create({ content: 'New', variant: 'accent' });

    assert.match(badgeVariantClass('accent'), /\bclp-badge-accent\b/);
    assert.match(badge.className, /\bclp-badge-accent\b/);
    assert.doesNotMatch(badge.className, /\bbg-accent-main-100\b/);
  } finally {
    cleanup();
  }
});

test('primary buttons use the repo-owned accent class instead of host accent utilities', () => {
  const cleanup = setupDom();

  try {
    const button = Button.create({ text: 'Save', variant: 'primary' });

    assert.match(buttonClass('primary'), /\bclp-button-primary\b/);
    assert.match(button.className, /\bclp-button-primary\b/);
    assert.doesNotMatch(button.className, /\bbg-accent-main-100\b/);
    assert.doesNotMatch(button.className, /\bhover:bg-accent-main-200\b/);
  } finally {
    cleanup();
  }
});
