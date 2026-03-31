# Chat Test Workflow

This repository treats `claude.ai/chat/...` as the only primary test surface.

The testing stack has two layers:

- Live smoke and live capture: real Google Chrome `Test` profile, real Claude chats, read-only checks
- Fixture E2E: committed sanitized chat fixtures, deterministic Playwright assertions, visual baselines

## Directory Roles

```text
.auth/live-chat-targets.json              # local only, real short/medium/long chat URLs
scripts/fixtures/chat-fixtures.json       # tracked manifest for chat fixture ids and thresholds
scripts/fixtures/lib/chatFixtureConfig.js # resolves tracked manifest + local live URLs
test/fixtures-source/claude/              # ignored raw captures from live Claude chats
test/fixtures/claude/chat-real-*/         # committed sanitized chat fixtures
test/e2e/support/chatFixtures.js          # canonical fixture ids and surface mapping for specs
test/e2e/*.spec.js                        # deterministic browser coverage
test/e2e-live/live-smoke.spec.js          # read-only live Claude smoke
```

## Default Operator Workflow

Use this when you need confidence that the real Claude DOM still matches the local fixture suite:

1. Close Google Chrome completely.
2. Refresh the cloned live profile:

   ```bash
   npm run live:refresh-profile
   ```

3. Run live smoke against the configured short, medium, and long chats:

   ```bash
   npm run test:e2e:live
   ```

4. If Claude Leaf is installed in the `Test` profile, run the single-chat deep smoke:

   ```bash
   npm run test:e2e:live:deep
   ```

5. If smoke is clean, run the deterministic local gates:

   ```bash
   npm test
   npm run test:e2e
   ```

6. If live smoke reports drift, refresh fixtures:

   ```bash
   npm run fixtures:capture -- --target short
   npm run fixtures:capture -- --target medium
   npm run fixtures:capture -- --target long
   npm run fixtures:sanitize
   npm run fixtures:refresh
   npm run test:e2e
   ```

## Which Fixture to Use

Use `test/e2e/support/chatFixtures.js` instead of hardcoding fixture ids in new specs.

- `REAL_CHAT_FIXTURES.short`
  - shortest natural chat surface
  - use for basic navigation, bookmarks, popup sync, compact visuals
- `REAL_CHAT_FIXTURES.medium`
  - natural edit-history and marker surface
  - use for modal, badge, and medium-density UX checks
- `REAL_CHAT_FIXTURES.long`
  - dense scroll stress surface
  - use for counters, panel scrolling, anchoring, long-thread stability
- `SYNTHETIC_CHAT_FIXTURES.streaming`
  - controlled mutable streaming state
- `SYNTHETIC_CHAT_FIXTURES.editedThread`
  - controlled inline edit-form save/cancel state

Rule of thumb:

- If you are testing real placement, selector drift, or natural chat UX, use a real fixture.
- If you need deterministic mutation that a real chat cannot safely provide, use a synthetic fixture.

## How to Add a New E2E Spec

1. Pick the correct surface from `CHAT_TEST_SURFACES`.
2. Open the fixture with `openFixture(...)`.
3. Assert module behavior.
4. End with `assertNoPageErrors(...)`.

Minimal example:

```js
import { openFixture, test, expect, assertNoPageErrors } from './support/extensionTest.js';
import { CHAT_TEST_SURFACES } from './support/chatFixtures.js';

test('example module behavior', async ({ fixturePage, harnessPage }) => {
  await openFixture(fixturePage, harnessPage, CHAT_TEST_SURFACES.bookmarks.base);

  await expect(fixturePage.locator('#claude-bookmarks-fixed-btn')).toBeVisible();

  assertNoPageErrors(fixturePage, ['ResizeObserver loop limit exceeded']);
});
```

## How to Add a New Real Chat Fixture

Only do this when short/medium/long no longer cover the scenario well.

1. Add a tracked target entry in `scripts/fixtures/chat-fixtures.json`.
2. Add the matching local live URL in `.auth/live-chat-targets.json`.
3. Capture the target with `fixtures:capture -- --target <name>`.
4. Sanitize and refresh fixtures.
5. Add the new fixture id to `test/e2e/support/chatFixtures.js`.
6. Extend `test/chat-test-surfaces.test.js` if the new surface becomes part of the shared matrix.

Do not commit raw chat ids or raw live capture text.

## What Belongs in Live Smoke vs Fixture E2E

Live smoke should answer:

- does Claude still open these chats without login/challenge?
- do basic message/edit counts still match expectations?
- did the DOM drift enough that fixture refresh is needed?
- if the Test profile already has Claude Leaf installed, do core live module surfaces still attach?

Live deep smoke should answer:

- on one real long chat, do the core modules still behave correctly together?
- can Claude Leaf still add and navigate bookmarks and markers safely?
- do edit-history overlays still open correctly?
- does popup save still sync navigation visibility back to the live tab?

Fixture E2E should answer:

- do modules attach in the right places?
- do counters, panels, badges, shortcuts, and modals behave correctly?
- do visuals still align in deterministic snapshots?

Keep live smoke read-only. Keep deep behavior coverage in fixture E2E.

## One-Time Setup for Live Module Smoke

Official Google Chrome 137+ no longer loads unpacked extensions from
`--load-extension` in branded builds. Because of that:

- `npm run test:e2e:live` only guarantees route health and capture readiness
- `npm run test:e2e:live:modules` requires Claude Leaf to already be installed
  in the Chrome `Test` profile
- `npm run test:e2e:live:deep` builds on the same one-time setup and runs a
  deeper safe interaction sweep against the configured live `long` chat

One-time setup:

1. Open Google Chrome with the `Test` profile.
2. Go to `chrome://extensions`.
3. Enable Developer mode.
4. Choose Load unpacked and select this repo root.
5. Close Chrome completely.
