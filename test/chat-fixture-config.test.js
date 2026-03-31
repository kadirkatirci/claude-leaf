import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveChatTarget,
  summarizeKnownChatTargets,
} from '../scripts/fixtures/lib/chatFixtureConfig.js';

test('resolveChatTarget joins tracked fixture metadata with local live chat urls', async () => {
  const target = await resolveChatTarget('short', {
    manifest: {
      targets: {
        short: {
          captureId: 'chat-live-short',
          fixtureId: 'chat-real-short',
          route: '/chat/fixture-real-short',
          smoke: { minMessages: 8 },
        },
      },
    },
    liveTargets: {
      short: 'https://claude.ai/chat/508038a5-ac24-4241-bf82-301805282362',
    },
  });

  assert.equal(target.targetName, 'short');
  assert.equal(target.captureId, 'chat-live-short');
  assert.equal(target.fixtureId, 'chat-real-short');
  assert.equal(target.route, '/chat/fixture-real-short');
  assert.equal(target.url, 'https://claude.ai/chat/508038a5-ac24-4241-bf82-301805282362');
});

test('resolveChatTarget rejects non-chat claude.ai urls', async () => {
  await assert.rejects(
    resolveChatTarget('short', {
      manifest: {
        targets: {
          short: {
            captureId: 'chat-live-short',
            fixtureId: 'chat-real-short',
            route: '/chat/fixture-real-short',
          },
        },
      },
      liveTargets: {
        short: 'https://claude.ai/projects',
      },
    }),
    /must point to \/chat\/\.\.\./
  );
});

test('summarizeKnownChatTargets returns stable sorted names', () => {
  const names = summarizeKnownChatTargets({
    targets: {
      long: {},
      short: {},
      medium: {},
    },
  });

  assert.deepEqual(names, ['long', 'medium', 'short']);
});
