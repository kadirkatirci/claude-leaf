import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom } from '../test-support/dom.js';
import { protectClippingAncestors } from '../src/utils/ClippingVisibilityGuard.js';

function setupClippingDom() {
  const cleanup = setupDom(`
    <main>
      <div id="scroll" style="overflow-y: auto; overflow-x: hidden;">
        <div id="clip" style="overflow: hidden;">
          <div id="cv" style="content-visibility: auto;">
            <div id="message-a"></div>
            <div id="message-b"></div>
          </div>
        </div>
      </div>
    </main>
  `);

  const scroll = document.getElementById('scroll');
  Object.defineProperties(scroll, {
    clientHeight: { configurable: true, value: 120 },
    scrollHeight: { configurable: true, value: 360 },
    clientWidth: { configurable: true, value: 220 },
    scrollWidth: { configurable: true, value: 220 },
  });

  return {
    cleanup,
    scroll,
    clip: document.getElementById('clip'),
    cv: document.getElementById('cv'),
    messageA: document.getElementById('message-a'),
    messageB: document.getElementById('message-b'),
  };
}

test('clipping visibility guard also protects the anchor host itself', () => {
  const cleanup = setupDom(`
    <main>
      <div id="message" style="content-visibility: auto; overflow: hidden;"></div>
    </main>
  `);

  try {
    const message = document.getElementById('message');
    const release = protectClippingAncestors(message, {
      axes: { horizontal: true, vertical: false },
    });

    assert.equal(message.style.contentVisibility, 'visible');
    assert.equal(message.style.overflow, 'visible');

    release();
    assert.equal(message.style.contentVisibility, 'auto');
    assert.equal(message.style.overflow, 'hidden');
  } finally {
    cleanup();
  }
});

test('clipping visibility guard is ref-counted and leaves scroll containers untouched', () => {
  const env = setupClippingDom();

  try {
    const releaseA = protectClippingAncestors(env.messageA, {
      axes: { horizontal: true, vertical: true },
    });
    const releaseB = protectClippingAncestors(env.messageB, {
      axes: { horizontal: true, vertical: true },
    });

    assert.equal(env.cv.style.contentVisibility, 'visible');
    assert.equal(env.clip.style.overflow, 'visible');
    assert.equal(env.scroll.style.overflowX, 'hidden');
    assert.equal(env.scroll.style.overflowY, 'auto');

    releaseA();
    assert.equal(env.cv.style.contentVisibility, 'visible');
    assert.equal(env.clip.style.overflow, 'visible');

    releaseB();
    assert.equal(env.cv.style.contentVisibility, 'auto');
    assert.equal(env.clip.style.overflow, 'hidden');
    assert.equal(env.scroll.style.overflowX, 'hidden');
    assert.equal(env.scroll.style.overflowY, 'auto');
  } finally {
    env.cleanup();
  }
});

test('message badge restores ancestor styles on removeAll', async () => {
  const env = setupClippingDom();

  try {
    const { default: MessageBadge } = await import('../src/components/primitives/MessageBadge.js');
    const badge = new MessageBadge(() => null, null);
    badge.create(env.messageA, {
      className: 'test-message-badge',
      content: 'History',
      position: { top: '-20px', right: '8px' },
    });

    assert.equal(env.cv.style.contentVisibility, 'visible');
    assert.equal(env.clip.style.overflow, 'visible');

    badge.removeAll('.test-message-badge');
    assert.equal(env.cv.style.contentVisibility, 'auto');
    assert.equal(env.clip.style.overflow, 'hidden');
  } finally {
    env.cleanup();
  }
});

test('bookmark button restores ancestor styles on removeAll', async () => {
  const env = setupClippingDom();

  try {
    const { BookmarkButton } = await import('../src/modules/BookmarkModule/BookmarkButton.js');
    const buttonManager = new BookmarkButton(
      { createElement: tag => document.createElement(tag) },
      () => null
    );

    await buttonManager.addToMessages(
      [env.messageA],
      () => 'bookmark-message',
      () => false,
      () => {}
    );

    assert.equal(env.cv.style.contentVisibility, 'visible');
    assert.equal(env.clip.style.overflow, 'visible');

    buttonManager.removeAll();
    assert.equal(env.cv.style.contentVisibility, 'auto');
    assert.equal(env.clip.style.overflow, 'hidden');
  } finally {
    env.cleanup();
  }
});

test('marker badge restores ancestor styles on removeAll', async () => {
  const env = setupClippingDom();

  try {
    const { MarkerBadge } = await import('../src/modules/EmojiMarkerModule/MarkerBadge.js');
    const badgeManager = new MarkerBadge(
      () => null,
      null,
      () => [],
      () => {},
      () => {}
    );

    badgeManager.updateAll([env.messageA], [{ id: 'marker-1', index: 0, emoji: '📌' }]);

    assert.equal(env.cv.style.contentVisibility, 'visible');
    assert.equal(env.clip.style.overflow, 'visible');

    badgeManager.removeAll();
    assert.equal(env.cv.style.contentVisibility, 'auto');
    assert.equal(env.clip.style.overflow, 'hidden');
  } finally {
    env.cleanup();
  }
});

test('marker button restores ancestor styles on removeAll', async () => {
  const env = setupClippingDom();

  try {
    const { MarkerButton } = await import('../src/modules/EmojiMarkerModule/MarkerButton.js');
    const buttonManager = new MarkerButton(
      () => null,
      () => [],
      null,
      () => {},
      () => {},
      () => {}
    );

    buttonManager.addToMessages([env.messageA], []);

    assert.equal(env.cv.style.contentVisibility, 'visible');
    assert.equal(env.clip.style.overflow, 'visible');

    buttonManager.removeAll();
    assert.equal(env.cv.style.contentVisibility, 'auto');
    assert.equal(env.clip.style.overflow, 'hidden');
  } finally {
    env.cleanup();
  }
});
