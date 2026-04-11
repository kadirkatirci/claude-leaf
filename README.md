<p align="center">
  <img src="icons/icon.svg" alt="Claude Leaf logo" width="88">
</p>

<h1 align="center">Claude Leaf</h1>

<p align="center"><strong>Bring structure back to long Claude conversations.</strong></p>

<p align="center">
  Claude Leaf is a Chrome extension for <a href="https://claude.ai">Claude.ai</a> that helps you move through long threads,
  mark what matters, and revisit edits without losing your place.
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/claude-leaf/dpodfmfbkdnighbaajagchhbkblememp">Chrome Web Store</a>
  ·
  <a href="https://www.youtube.com/watch?v=rRNJ9Rvw-Rg">Watch Demo</a>
</p>

<p align="center">
  <img src="docs/screenshots/module-panels-view.png" alt="Claude Leaf module panels" width="48%">
  <img src="docs/screenshots/darkmode-lightmode.png" alt="Claude Leaf in dark and light mode" width="48%">
</p>

## Why It Exists

If you use Claude for coding, research, writing, or planning, long chats become hard to scan fast.
Claude Leaf gives you lightweight controls directly inside the conversation so you can:

- move between messages without hunting through the page
- bookmark important parts of a thread
- tag messages with emoji markers for quick visual scanning
- inspect edited prompts and version branches when a conversation evolves
- schedule a drafted message to send later when timing matters

## What You Can Use Today

### Navigation

Move up and down a conversation with floating controls and a live counter so you always know where you are.

<p>
  <img src="docs/screenshots/module-panels-view.png" alt="Navigation and module panels inside Claude" width="100%">
</p>

### Bookmarks

Save important messages, organize them, and jump back when you need context again.

<p>
  <img src="docs/screenshots/add-bookmark.png" alt="Adding a bookmark in Claude Leaf" width="48%">
  <img src="docs/screenshots/bookmarks-manager-modal-message-view.png" alt="Bookmark manager message view" width="48%">
</p>

### Emoji Markers

Mark messages with lightweight visual tags so key answers stand out during long sessions.

<p>
  <img src="docs/screenshots/add-emoji-marker.png" alt="Adding an emoji marker" width="48%">
  <img src="docs/screenshots/marked-messages-badges.png" alt="Marked messages in light mode" width="48%">
</p>

<p>
  <img src="docs/screenshots/marked-messages-badges-darkmode.png" alt="Marked messages in dark mode" width="48%">
</p>

### Edit History

See how prompts changed over time, inspect versions, and understand branching paths in edited conversations.

<p>
  <img src="docs/screenshots/edit-history-modal-view.png" alt="Edit history modal view" width="48%">
  <img src="docs/screenshots/branch-map-view.png" alt="Branch map view" width="48%">
</p>

### Scheduled Message

Schedule a drafted message to send later from the composer. This module is available in the build, but it starts disabled by default and must be enabled from the popup settings.

## Visual Tour

<p>
  <img src="docs/screenshots/bookmarks-manager-modal-grid-view.png" alt="Bookmarks manager grid view" width="32%">
  <img src="docs/screenshots/bookmarks-manager-modal-list-view.png" alt="Bookmarks manager list view" width="32%">
  <img src="docs/screenshots/edit-highlight-view.png" alt="Edit highlight view" width="32%">
</p>

## In Development

These modules exist in the codebase but are not enabled in the current build:

- **Compact View** for collapsing long responses
- **Content Folding** for headings and code blocks
- **Sidebar Collapse** for cleaner sidebar navigation

## Installation

### From Chrome Web Store

Install Claude Leaf from the Chrome Web Store:

https://chromewebstore.google.com/detail/claude-leaf/dpodfmfbkdnighbaajagchhbkblememp

### From Source

1. Clone the repository.

   ```bash
   git clone https://github.com/kadirkatirci/claude-leaf.git
   cd claude-leaf
   ```

2. Install dependencies and build the extension.

   ```bash
   npm install
   npm run build
   ```

3. Open `chrome://extensions`.
4. Enable `Developer mode`.
5. Click `Load unpacked`.
6. Select the project folder.
7. Open [claude.ai](https://claude.ai).

## Current Module Set

Available in the current build:

- Navigation
- Bookmarks
- Emoji Markers
- Edit History

Available as an opt-in module:

- Scheduled Message (disabled by default)

Present but dev-disabled:

- Compact View
- Content Folding
- Sidebar Collapse

## Development

```bash
npm run dev      # Watch mode with auto-rebuild
npm run build    # Production build
npm test         # Node/JSDOM contracts + smoke tests
npm run test:e2e # Playwright fixture E2E suite
npm run live:refresh-profile # Clone the real Chrome Test profile for local live smoke/capture
npm run test:e2e:live # Read-only live Claude smoke against the cloned Test profile
npm run test:e2e:live:modules # Live smoke plus module assertions when Claude Leaf is installed in Test
npm run test:e2e:live:deep # Single-chat deep smoke on the configured live long chat
npm run lint     # Run ESLint
npm run lint:fix # Fix ESLint issues
npm run format   # Format with Prettier
```

## Fixture E2E

The Playwright suite runs the real unpacked extension against deterministic `claude.ai` fixtures.

- `seed` fixtures are mutable interaction hosts for navigation, bookmarks, markers, and edit-history flows.
- `sanitized_html` fixtures are read-only DOM drift fixtures sourced from live Claude captures.
- The browser test harness blocks live `http/https` traffic by default and only serves committed fixture assets from `https://claude.ai/...`.
- Visual baselines use bundled local IBM Plex fonts so snapshots stay stable across machines and CI.

For the full chat-only operator and developer workflow, see [docs/CHAT_TEST_WORKFLOW.md](docs/CHAT_TEST_WORKFLOW.md).

Run the full browser suite with:

```bash
npm run test:e2e
```

Open the Playwright UI when iterating locally:

```bash
npm run test:e2e:ui
```

### Live Smoke and Capture

For authenticated local checks, use the real Google Chrome `Test` profile as the source of truth.

- Chrome must be fully closed before any live command.
- The live pipeline clones the `Test` profile into `.auth/chrome-test-live` instead of automating your daily profile directly.
- Live smoke is read-only: it opens the configured short, medium, and long `claude.ai/chat/...` targets, validates message/edit counts, writes screenshots, and stores a JSON report under `.auth/live-artifacts/...`.
- `npm run test:e2e:live` always validates route health. `npm run test:e2e:live:modules` additionally validates Claude Leaf UI surfaces, but that requires one-time manual installation in the Chrome `Test` profile.
- `fixtures:capture` uses the same cloned live profile workflow before visiting a named chat target.

Configure your private live chat targets locally:

```bash
cp scripts/fixtures/live-chat-targets.example.json .auth/live-chat-targets.json
```

Then replace the placeholder URLs in `.auth/live-chat-targets.json` with your real short, medium, and long Claude chat URLs. This file is ignored by git and never committed.

Refresh the clone explicitly:

```bash
npm run live:refresh-profile
```

Run the authenticated live smoke suite:

```bash
npm run test:e2e:live
```

To validate real module attachment in live Chrome, install the repo once in the `Test` profile:

1. Open Google Chrome with the `Test` profile.
2. Visit `chrome://extensions`.
3. Turn on Developer mode.
4. Click Load unpacked and select this repo root.
5. Close Chrome completely.

Then run:

```bash
npm run test:e2e:live:modules
```

This extra setup is required because Chrome 137+ official branded builds no longer honor the `--load-extension` flag for local automation. Route smoke and capture still work without it.

For a higher-signal live pass on a single real chat, run:

```bash
npm run test:e2e:live:deep
```

This deep smoke stays safe with respect to Claude itself, but it does exercise real Claude Leaf interactions on the configured live `long` chat:

- navigation next/prev/top and keyboard shortcuts
- bookmark add and panel navigation
- emoji marker add and panel navigation
- edit history panel / modal / branch map
- popup-driven navigation visibility save/sync

### Refreshing Fixtures

The committed fixture set is chat-only and is derived from three live sources:

- `short` → `chat-real-short`
- `medium` → `chat-real-medium`
- `long` → `chat-real-long`

Use the fixture pipeline when Claude DOM contracts drift:

1. Log in to `claude.ai` in the Google Chrome `Test` profile and close Chrome completely.
2. Capture the configured chat targets into the ignored source area:

   ```bash
   npm run fixtures:capture -- --target short
   npm run fixtures:capture -- --target medium
   npm run fixtures:capture -- --target long
   ```

3. Sanitize the captures into the committed chat fixtures:

   ```bash
   npm run fixtures:sanitize
   ```

4. Regenerate all fixture entry pages and validate metadata consistency:

   ```bash
   npm run fixtures:refresh
   ```

Rules enforced by `fixtures:refresh`:

- every fixture must have a unique route
- `seed` fixtures must declare a `seedProfile`
- `sanitized_html` fixtures must include `sanitized-source.html`
- `sanitized_html` fixtures are read-only with `helpers.mutable=false`
- committed chat fixtures are redacted before they are written to the repo, so real conversation text and chat ids stay out of version control

## Release

1. Add the new release block at the top of `CHANGELOG.md`.
2. For a live release, copy `env.release.example` to `.env` and fill in the credentials.
3. Run `./release.sh --dry-run --yes` to validate the changelog, versions, git state, and payloads without external calls.
4. Run `./release.sh --yes` for the actual release.

To keep the process trustworthy:

- `npm test` now includes a release-script smoke test.
- The script rejects untracked files, records the release commit before external publish steps, packages tracked source files plus fresh build output, and uploads the generated zip to the matching GitHub Release.

### Auxiliary Tool

This repository also contains a separate unpacked extension at `tools/claude-web-guardian/`.

- It is not part of the main Claude Leaf build or release zip.
- It watches live `claude.ai` routes and selector contracts.
- It auto-runs on monitored page changes, keeps a heartbeat fallback, and sends up to three desktop alerts for new failures.
- It ignores `https://claude.ai/code/...` routes.
- It is the live canary layer for authenticated/manual checks, not a pull-request gate.
- Use it when you need to spot selector drift before refreshing sanitized fixtures.

To use it locally:

1. Open `chrome://extensions`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select `tools/claude-web-guardian`

Recommended canary workflow:

1. Keep the fixture suite (`npm run test:e2e`) as the fast CI gate.
2. Use `npm run test:e2e:live` for read-only local smoke against the cloned Google Chrome `Test` profile.
3. Use `Claude Web Guardian` manually or on your own nightly browser profile against a real logged-in Claude session.
4. If Guardian or live smoke reports drift, refresh the short/medium/long chat captures, sanitize them, and rerun the local Playwright suite before changing production selectors.

### Project Structure

```text
src/
├── content.js
├── App.js
├── core/
├── modules/
├── stores/
├── managers/
├── utils/
└── config/

popup/
docs/
icons/
tools/
└── claude-web-guardian/
```

For architecture and internal development notes, see [CLAUDE.md](CLAUDE.md).

## Contributing

If you want to contribute, start here:

1. Fork the repository.
2. Create a branch: `git checkout -b feature/your-feature`
3. Make your changes.
4. Run `npm run lint:fix`
5. Open a pull request.

Please also read [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT License. See [LICENSE](LICENSE).
