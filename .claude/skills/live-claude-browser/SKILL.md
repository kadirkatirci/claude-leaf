---
name: "live-claude-browser"
description: "Access the real claude.ai web app through the repo's cloned Google Chrome Test profile workflow. Use when the user wants Codex to inspect live Claude pages, navigate real chats, reproduce a live issue, collect screenshots or DOM state, verify extension behavior on the real site, or perform a safe one-off action in the user's authenticated Claude session."
---

# Live Claude Browser

Use this skill when the task depends on the real `claude.ai` UI rather than only
local fixtures, mocks, or repo files.

## Rules

- Use the Google Chrome `Test` profile clone workflow only. Do not automate the
  daily browser profile directly.
- Run `npm run live:refresh-profile` before any live task. Chrome must be fully
  closed first.
- Keep live Claude work headed. Headless is acceptable for fixture E2E, but it
  is more likely to trigger Cloudflare on the live site.
- Default to read-only live Claude work. If the user explicitly asks for an
  action that mutates a real conversation, message, project, or account state,
  say that it changes live Claude data and only then proceed.
- Never commit `.auth/`, `test/fixtures-source/`, raw live chat IDs, or raw
  captured chat text.
- Prefer local fixture E2E when the request does not strictly need the live site.

## Use Cases

Use this skill for tasks such as:

- opening and inspecting a real Claude chat or page
- verifying whether a live issue reproduces in the user's authenticated session
- collecting screenshots, DOM snapshots, counts, selectors, or route state
- checking whether Claude Leaf attaches correctly on the live site
- safely exercising extension UI on a real chat
- capturing fresh live fixture source for later local testing

## Command Shortcuts

Use the built-in commands when they match the request.

- Route health and login/challenge checks:

  ```bash
  npm run test:e2e:live
  ```

- Live module surface attachment on real chats:

  ```bash
  npm run test:e2e:live:modules
  ```

- One real rich-chat deep smoke:

  ```bash
  npm run test:e2e:live:deep
  ```

- Capture a named live chat source:

  ```bash
  npm run fixtures:capture -- --target short
  npm run fixtures:capture -- --target medium
  npm run fixtures:capture -- --target long
  ```

- Promote live capture into committed fixtures:

  ```bash
  npm run fixtures:sanitize
  npm run fixtures:refresh
  npm run test:e2e
  ```

## One-Off Live Tasks

If the request does not fit the built-in smoke or capture commands, read
[references/live-task-playbook.md](./references/live-task-playbook.md) and reuse
the existing live Chrome helper instead of inventing a new profile flow.

Default approach:

1. Refresh the clone profile.
2. Reuse `scripts/fixtures/lib/liveChrome.js`.
3. Borrow patterns from `test/e2e-live/live-deep-smoke.spec.js`,
   `test/e2e-live/support/liveTest.js`, or
   `scripts/fixtures/capture-live-page.mjs`.
4. Keep the script temporary unless it is clearly reusable repo infrastructure.

## Decision Guide

- Need to know whether live Claude still opens and the session is valid:
  use `npm run test:e2e:live`
- Need to know whether Claude Leaf still attaches on the real site:
  use `npm run test:e2e:live:modules`
- Need a stronger real-chat pass that still avoids mutating Claude data:
  use `npm run test:e2e:live:deep`
- Need fresh fixture input from a real chat:
  use `npm run fixtures:capture`
- Need anything else on the live site:
  write the smallest temporary task script around `liveChrome.js`
