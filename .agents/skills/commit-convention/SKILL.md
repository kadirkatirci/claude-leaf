---
name: "commit-convention"
description: "Enforces commit message conventions for the Claude Leaf Chrome extension project. Always trigger when: (1) user says 'commit', 'commit this', 'write a commit message', 'stage and commit', (2) user asks to commit changes or write a commit message, (3) user runs git commit or asks what to write as a commit message, (4) after completing a code change when the next logical step is committing. This skill writes standardized commit messages that the changelog-update skill can reliably parse. Never write a commit message without following this convention."
---

# Commit Convention

Enforces standardized commit messages for the Claude Leaf Chrome extension project. Based on Conventional Commits with project-specific extensions. These conventions directly feed into the changelog-update skill — consistent commit messages produce accurate changelogs.

## When to Use

- User says "commit", "commit this", "write a commit message"
- After completing a code change when committing is the next step
- User asks for help with a commit message
- Any `git commit` operation in the Claude Leaf project

## Format

```
<type>(<scope>): <subject>

[optional body]
```

### Type (required)

| Type | Purpose | Maps to CHANGELOG |
|---|---|---|
| `feat` | New feature or capability | → Added |
| `improve` | Enhancement to existing feature, UX polish, performance | → Improved |
| `fix` | Bug fix | → Fixed |
| `change` | Breaking behavior change, significant API change | → Changed |
| `remove` | Remove a feature or file | → Removed |
| `security` | Security fix or hardening | → Security |
| `chore` | Dependencies, config, build, CI — no user-facing change | → *skipped* |
| `docs` | Documentation only | → *skipped* |
| `style` | Code formatting, whitespace — no logic change | → *skipped* |
| `test` | Adding or updating tests | → *skipped* |
| `refactor` | Code restructuring with no behavior change | → *skipped* |

Types marked *skipped* are excluded from the changelog because they don't affect end users.

### Scope (required)

The scope identifies which module or area of the codebase is affected. Use one of these scopes:

| Scope | Covers |
|---|---|
| `nav` | Message navigation (scrolling between messages, position tracking) |
| `bookmark` | Bookmark system (save, list, jump to bookmarked messages) |
| `emoji` | Emoji markers (tag messages with emoji) |
| `history` | Edit history tools (prompt version inspection, branch diffing) |
| `compact` | Compact View (message collapsing) |
| `sidebar` | Sidebar Collapse (hide/show Claude.ai sidebar) |
| `fold` | Content Folding (collapse long message sections) |
| `popup` | Extension popup UI |
| `content` | Content script (DOM interaction, page injection) |
| `background` | Background service worker |
| `storage` | Chrome storage operations |
| `ui` | Shared UI components, styles, themes |
| `build` | Build system, webpack/vite config, zip packaging |
| `release` | Release automation, changelog, versioning |
| `deps` | Dependency updates |

If a commit spans multiple scopes, use the primary one. If truly cross-cutting, use the most relevant scope.

When a new module is introduced to the project, add its scope to this list.

### Subject (required)

- Start with a lowercase verb in imperative mood: `add`, `fix`, `remove`, `update`, `improve`
- No period at the end
- Max 72 characters for the entire first line (`type(scope): subject`)
- Be specific: `fix bookmark click handler` not `fix bug`

### Body (optional)

- Separated from subject by a blank line
- Use when the "why" isn't obvious from the subject
- Wrap at 72 characters
- Can include bullet points with `-`

## Examples

### Good Commits

```
feat(compact): add toggle button to collapse individual messages

feat(sidebar): add keyboard shortcut to toggle sidebar visibility

improve(nav): smoother scroll animation when jumping between messages

improve(emoji): redesign emoji picker with search support

fix(bookmark): prevent icons from disappearing on page scroll
The MutationObserver was disconnecting on dynamic content loads.
Switched to a persistent observer with proper cleanup.

fix(history): preserve scroll position when switching between branches

change(storage): migrate from sync to local storage for bookmarks
Breaking: existing bookmarks will need to be re-saved.

remove(popup): remove legacy settings panel

chore(deps): update chrome-types to v0.1.300

chore(build): switch from webpack to vite

refactor(content): extract DOM helpers into utility module

style(ui): apply consistent spacing to popup elements

docs(release): update release script usage instructions
```

### Bad Commits — Don't Do This

```
# Too vague — what was fixed?
fix(bookmark): fix bug

# No scope
feat: add dark mode

# Not imperative mood
fix(nav): fixed the scroll issue

# Too long
feat(compact): add a new feature that allows users to collapse and expand individual messages in long conversations with a smooth animation

# Wrong type — this is an improvement, not a new feature
feat(nav): smoother scrolling

# Period at end
fix(popup): remove console.log statements.

# Past tense
improve(ui): improved the color contrast

# Uppercase start
fix(emoji): Fix picker z-index
```

## Multi-Scope Changes

When a change touches multiple areas, commit separately if possible:

```bash
# Prefer this (separate commits):
git add src/nav/
git commit -m "improve(nav): add smooth scroll easing"

git add src/ui/styles.css
git commit -m "style(ui): adjust nav button hover states"

# Over this (combined):
git commit -am "improve navigation and update styles"
```

If a single logical change genuinely spans scopes, use the primary scope and mention others in the body:

```
feat(compact): add compact view with keyboard toggle

Also updates popup (settings checkbox) and content script
(message height observer).
```

## Workflow Integration

This convention directly feeds the **changelog-update** skill:

1. You commit with standard messages → `feat(sidebar): add collapse toggle`
2. Before release, changelog skill runs `git log v1.0.0..HEAD`
3. It reads the type prefix → maps to the correct CHANGELOG category
4. It reads the subject → rewrites it in user-friendly language
5. It skips `chore`, `docs`, `style`, `test`, `refactor` → clean changelog

The clearer your commits, the better the changelog.

## References

- [scope-registry.md](./references/scope-registry.md) — Full scope definitions with file path mappings
