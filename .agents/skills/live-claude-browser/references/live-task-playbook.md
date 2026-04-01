# Live Task Playbook

Use this only when the built-in live commands are not enough.

## Existing Building Blocks

- `scripts/fixtures/lib/liveChrome.js`
  - profile clone refresh
  - headed Chrome launch against the cloned `Test` profile
  - artifact directory creation
  - live page snapshot helpers
- `scripts/fixtures/capture-live-page.mjs`
  - minimal route visit + safe capture flow
- `test/e2e-live/support/liveTest.js`
  - extension-aware live helpers, reporting, popup access
- `test/e2e-live/support/liveSmokeHelpers.js`
  - smoke check helpers and module surface assertions
- `test/e2e-live/live-deep-smoke.spec.js`
  - reference for safe real-chat interactions

## Use the Simplest Path First

- Need to know whether Claude still opens correctly:
  - `npm run test:e2e:live`
- Need to know whether Claude Leaf still attaches:
  - `npm run test:e2e:live:modules`
- Need one stronger real-chat pass:
  - `npm run test:e2e:live:deep`
- Need fresh fixture input:
  - `npm run fixtures:capture -- --target <short|medium|long>`

Only write a custom live script when those commands do not cover the request.

## Typical One-Off Tasks

- Inspect a live chat and report what is rendered
- Collect a screenshot after reproducing a layout bug
- Read selector state or counts from a real chat
- Verify whether a popup or fixed button action reflects on the live page
- Capture specific DOM fragments before deciding whether fixtures need refresh

For these, write the smallest temporary script possible and prefer reporting
through saved artifacts plus terminal output.

## Custom Script Recipe

1. Close Google Chrome completely.
2. Refresh the cloned profile:

   ```bash
   npm run live:refresh-profile
   ```

3. Write a temporary Node ESM script outside tracked repo files if possible.
4. Import from `scripts/fixtures/lib/liveChrome.js`.
5. Launch headed Chrome with the cloned profile.
6. Navigate only to the required `claude.ai/chat/...` page.
7. Record artifacts under `.auth/live-artifacts/...`.
8. Close the browser cleanly.
9. Delete the temporary script unless it became reusable infrastructure.

Minimal skeleton:

```js
import {
  DEFAULT_ARTIFACT_ROOT,
  DEFAULT_BROWSER_PATH,
  DEFAULT_CHROME_USER_DATA_DIR,
  DEFAULT_CLONE_DIR,
  DEFAULT_PROFILE_NAME,
  createArtifactRunDir,
  launchLiveChrome,
  refreshChromeProfileClone,
} from './scripts/fixtures/lib/liveChrome.js';

const artifactDir = await createArtifactRunDir({
  rootDir: DEFAULT_ARTIFACT_ROOT,
  label: 'manual-live-task',
});

const clone = await refreshChromeProfileClone({
  profileName: DEFAULT_PROFILE_NAME,
  chromeUserDataDir: DEFAULT_CHROME_USER_DATA_DIR,
  cloneDir: DEFAULT_CLONE_DIR,
  browserPath: DEFAULT_BROWSER_PATH,
});

const liveChrome = await launchLiveChrome({
  cloneDir: clone.cloneDir,
  profileDirectory: clone.profileDirectory,
  browserPath: clone.browserPath,
  artifactDir,
  headless: false,
});

const page = liveChrome.context.pages()[0] || (await liveChrome.context.newPage());

try {
  await page.goto('https://claude.ai/chat/...');
  await page.waitForTimeout(4000);
  // Do the smallest live task needed.
} finally {
  await page.close();
  await liveChrome.close();
}
```

## Safety Boundaries

- Do not submit prompts, retry Claude responses, save edited Claude messages,
  create/delete projects, or perform account-changing actions unless the user
  explicitly wants a real live mutation.
- Extension-only UI actions are acceptable when they do not mutate Claude data.
- Never commit `.auth/` or `test/fixtures-source/`.
- If you capture live content, sanitize it before promoting it to tracked
  fixtures.
