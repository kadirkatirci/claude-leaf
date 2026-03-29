# CHANGELOG.md Format Specification

This document defines the format that `release.sh` expects when parsing CHANGELOG.md.

## File Structure

```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-04-15
type: minor
title: New features and improvements

### Added
- Feature description

### Improved
- Enhancement description

### Fixed
- Bug fix description

## [1.1.0] - 2026-03-29
type: patch
title: Previous release title

### Fixed
- Previous fix
```

## Required Fields

### Header Line
```
## [X.Y.Z] - YYYY-MM-DD
```
- `X.Y.Z`: Semantic versioning format (number.number.number)
- `YYYY-MM-DD`: ISO 8601 date format
- Must start with `##`, version wrapped in `[` and `]`, separated from date by ` - `

### type Line
```
type: minor
```
- Must come immediately after the header
- Valid values: `major`, `minor`, `patch`, `beta`
- Whitespace flexible: both `type:minor` and `type: minor` work

### title Line
```
title: Short descriptive title
```
- Must come immediately after the `type:` line
- This title is used in:
  - Git commit message: `release: v1.2.0 — Short descriptive title`
  - tedaitesnim.com changelog entry `title` field

### Categories and Items
```
### Added
- Feature one
- Feature two

### Fixed
- Fix one
```
- Category headers start with `### ` (three hashes + space)
- Items start with `- ` (dash + space)
- At least one category with at least one item is required

## Valid Category Names

- `Added` — New features
- `Improved` — Enhancements to existing features, UX polish, performance
- `Fixed` — Bug fixes
- `Changed` — Breaking behavior changes, significant refactors
- `Removed` — Removed features or files
- `Security` — Security fixes
- `Notes` — Additional notes (also sent as part of the `changes` array)

## Parsed JSON Output

The release script converts this format into the following JSON:

```json
{
  "version": "1.2.0",
  "release_date": "2026-04-15",
  "type": "minor",
  "title": "New features and improvements",
  "published": true,
  "changes": [
    {
      "category": "Added",
      "items": [
        "Feature description"
      ]
    },
    {
      "category": "Improved",
      "items": [
        "Enhancement description"
      ]
    },
    {
      "category": "Fixed",
      "items": [
        "Bug fix description"
      ]
    }
  ]
}
```

This JSON is sent to two destinations:
1. **Chrome Web Store** — only the zip is uploaded, description is not updated
2. **tedaitesnim.com** — `POST /api/external/v1/extensions/{id}/changelog`

## Release Script Validations

The script performs these checks — CHANGELOG must satisfy all of them:

1. First versioned block (`## [X.Y.Z]`) must be parseable
2. Version must be in semantic versioning format (`X.Y.Z`)
3. `type:` line must be present with a valid enum value
4. `title:` line must be present and non-empty
5. At least 1 category + 1 item required (empty changes rejected)
6. New version must be greater than current manifest.json / package.json / git tag version
7. Second block in CHANGELOG (previous release) must match current manifest version

## Do NOT

- Add an `## [Unreleased]` block
- Modify existing release blocks
- Avoid double quotes in items (JSON escape issues)
- Add empty categories (a `###` header with no items)
- Reuse the same version number twice
