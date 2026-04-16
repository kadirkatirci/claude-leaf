# Changelog

All notable changes to this project will be documented in this file.

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
