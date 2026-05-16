# Changelog

All notable changes to this project will be documented in this file.

## [1.3.1] - 2026-05-17
type: patch
title: Badge and button visibility fix

### Fixed
- Restored visibility of bookmark buttons, emoji marker buttons, and edit history badges that disappeared after a recent Claude UI update

## [1.3.0] - 2026-04-26
type: minor
title: Text highlights and local annotations

### Added
- Annotation module for highlighting selected text in Claude and your own messages, with local notes, color tags, and dedicated quick-panel and sidebar manager views
- Deep-link support for opening annotations and jumping back to the related conversation and highlighted passage
- Annotation support for pointer, double-click, and paragraph selections, with panel-focused editing, exact text navigation, and version-aware restoration after message edits

### Fixed
- Prevented malformed Claude tab responses from breaking popup export flows
- Restored the Bookmarks sidebar label after Claude starts with the sidebar collapsed
- Limited Claude Web Guardian checks to supported chat routes so unsupported Claude pages no longer trigger unnecessary monitoring

## [1.2.1] - 2026-04-17
type: patch
title: Usage tracker percentage accuracy

### Fixed
- Corrected usage tracker percentage normalization so session and weekly indicators no longer render as full when Claude returns exact percentage values from the usage API

## [1.2.0] - 2026-04-13
type: minor
title: Composer usage tracking

### Added
- Usage Tracker module for showing subtle session and weekly Claude usage indicators directly on the composer, with live updates and hover details in both new and existing chats

## [1.1.0] - 2026-04-11
type: minor
title: Scheduled messages for Claude drafts

### Added
- Scheduled Message module for sending drafted Claude messages later from the composer, including support on the new chat page

### Fixed
- Background monitoring no longer reports false failures when no Claude tab is open

### Security
- Hardened live fixture metadata redaction to reduce the chance of exposing sensitive Claude session details in local capture workflows

## [1.0.2] - 2026-03-30
type: patch
title: Popup visibility and settings sync fixes

### Fixed
- Hid in-development modules consistently in the popup so disabled features no longer appear in packaged builds
- Preserved full extension settings when saving popup changes so navigation counters and other hidden options no longer disappear

## [1.0.1] - 2026-03-30
type: patch
title: Floating controls and update link polish

### Improved
- Added separate popup controls to hide floating buttons without turning the related feature off
- Improved help and update links so they open with clearer release-specific context

### Fixed
- Restored the floating visibility button styling in the popup

## [1.0.0] - 2026-03-26
type: major
title: First stable release

### Added
- Message navigation for long Claude.ai conversations
- Bookmarks for saving and revisiting important messages
- Emoji markers for lightweight visual tagging
- Edit history tools for inspecting prompt versions and branches
- Chrome Web Store distribution

### Notes
- Available on the Chrome Web Store:
  https://chromewebstore.google.com/detail/claude-leaf/dpodfmfbkdnighbaajagchhbkblememp
- Compact View, Sidebar Collapse, and Content Folding remain in development and are not enabled in the current build
