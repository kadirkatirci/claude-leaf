# Claude Web Guardian

A standalone Chrome extension project for **live-page canary monitoring** on `claude.ai`.

## What it does

- Runs scheduled canary checks (via `chrome.alarms`) against live Claude.ai pages.
- Monitors route, DOM, edit-history, sidebar, and theme selector contracts.
- Stores report history in `chrome.storage.local`.
- Lets you configure all optional checks and schedule interval from popup.
- Supports optional webhook bridge for pushing report payloads.
- Captures sanitized fixture snapshots from a real Claude tab.

## Install locally (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `tools/claude-web-guardian`

## Popup controls

- Enable/disable automatic monitoring
- Interval in minutes (min 5)
- Optional checks toggles:
  - Core DOM
  - Edit history
  - Sidebar
  - Theme
  - Routes
- Optional webhook bridge
- Run canary now
- Export reports JSON
- Capture fixture (sanitized) from active Claude tab

## Output format

Reports are saved to `chrome.storage.local` under key `cwg_reports`.
Each report includes:
- timestamp
- reason (`scheduled` / `manual`)
- url + page meta
- check results array with severity/pass/message

## Bridge strategy for main extension

Use webhook payloads from this project to trigger automation in your main extension repo pipeline:
- selector drift issue creation
- regression test fixture refresh
- risk score updates

