# Scope Registry

Defines each commit scope and what it covers. Use this to determine the correct scope for a commit. When unsure, inspect the changed files to understand which module they belong to.

## Feature Scopes

| Scope | Description |
|---|---|
| `nav` | Message navigation — scrolling between messages, position tracking, jump buttons |
| `bookmark` | Bookmark system — save, list, jump to bookmarked messages |
| `emoji` | Emoji markers — tag messages with emoji for visual identification |
| `history` | Edit history tools — prompt version inspection, branch diffing |
| `compact` | Compact View — collapse/expand individual messages in long conversations |
| `sidebar` | Sidebar Collapse — hide/show the Claude.ai sidebar |
| `fold` | Content Folding — collapse long sections within a single message |

## Infrastructure Scopes

| Scope | Description |
|---|---|
| `popup` | Extension popup UI — settings panel, controls shown when clicking the extension icon |
| `content` | Content script — DOM interaction, page injection, Claude.ai page manipulation |
| `background` | Background service worker — event listeners, cross-tab coordination |
| `storage` | Chrome storage operations — data persistence, sync/local storage logic |
| `ui` | Shared UI components — styles, themes, reusable visual elements |

## Tooling Scopes

| Scope | Description |
|---|---|
| `build` | Build system — bundler config, compilation, zip packaging |
| `release` | Release automation — release script, changelog, versioning |
| `deps` | Dependency updates — package.json changes |

## Scope Selection Rules

1. **Feature over infrastructure** — if a change in the content script is specifically for the bookmark feature, use `bookmark` not `content`
2. **Most specific wins** — `nav` over `content`, `emoji` over `ui`
3. **Cross-cutting → primary scope** — if a change touches `bookmark` + `ui`, use `bookmark` and mention `ui` in the commit body
4. **New modules** — when a new feature module is introduced, add its scope to this registry
