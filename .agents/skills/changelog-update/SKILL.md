---
name: "changelog-update"
description: "Pre-release CHANGELOG.md updater for the Claude Leaf Chrome extension. Always trigger when: (1) user says 'update changelog', 'prepare release', 'write changelog', (2) user asks to add recent changes to CHANGELOG.md, (3) user mentions running release script or preparing for a new version, (4) any context about documenting commits for a release. This skill always reads git log automatically — never ask the user for a commit list."
---

# Changelog Update

Updates CHANGELOG.md before a Chrome extension release. Reads commits from git log, analyzes changes, determines the appropriate semantic version, and adds a new release block to CHANGELOG.md.

## When to Use

- User says "update changelog", "prepare release", "write changelog"
- User asks to document recent changes or add commits to the changelog
- Before running the release script (`./release.sh` or `npm run release`)
- User shows commits and wants them formatted as a changelog entry

## Dependencies

- Git (to read commit history)
- Project must be a git repository with at least one tag (`vX.Y.Z`)

## Workflow

### Step 1: Read Latest Tag and Commits

```bash
# Find the latest tag
git describe --tags --abbrev=0

# Read all commits since the last tag
git log <last-tag>..HEAD --oneline --no-merges

# For more context
git log <last-tag>..HEAD --pretty=format:"%h %s" --no-merges
```

If no tags exist, use the full commit history.
If HEAD equals the last tag (no commits), inform the user: "No changes since the last tag."

#### Unclear Commit Messages

Some commit messages may be vague (e.g., `fix stuff`, `update`, `wip`, `changes`). In these cases, don't rely on the message alone — inspect the actual changes:

```bash
# See which files changed in a specific commit
git show <commit-hash> --stat

# See the actual diff for a specific file
git show <commit-hash> -- <file>

# Overall diff summary since last tag
git diff <last-tag>..HEAD --stat
```

Strategy:
1. Read all commit messages first
2. Categorize commits with clear messages directly
3. For vague messages, run `git show <hash> --stat` to see changed files
4. If still unclear, run `git show <hash>` to read the code diff
5. After gathering all information, present a summary to the user for confirmation

### Step 2: Analyze and Categorize Commits

Place each commit into one of the following categories:

| Category | When to use | Commit hints |
|---|---|---|
| `Added` | New feature, new file, new UI component | Commit type: `feat` |
| `Improved` | Enhancement to an existing feature, UX polish, performance boost | Commit type: `improve` |
| `Fixed` | Bug fix, error correction | Commit type: `fix` |
| `Changed` | Breaking behavior change, significant API change | Commit type: `change` |
| `Removed` | Removed feature or file | Commit type: `remove` |
| `Security` | Security fix | Commit type: `security` |

Mapping from commit types (see commit-convention skill):
- `feat` → Added, `improve` → Improved, `fix` → Fixed, `change` → Changed, `remove` → Removed, `security` → Security
- `chore`, `docs`, `style`, `test`, `refactor` → **skip** (not user-facing)

Rules:
- Skip commits with types `chore`, `docs`, `style`, `test`, `refactor` — end users don't care about these
- Merge related commits (e.g., `fix(bookmark): ...` + `fix(bookmark): ...` → single item)
- Write each item in **clear, end-user-friendly language** — avoid technical jargon
- The commit scope (e.g., `nav`, `popup`) helps you understand context but should not appear verbatim in the changelog
- Write in English

### Step 3: Determine Semantic Version

Read the current version from the latest tag (`v1.0.0` → `1.0.0`), then:

| Change type | Version bump | Example |
|---|---|---|
| Breaking change, major redesign | **major** (X.0.0) | 1.0.0 → 2.0.0 |
| New feature (backward compatible) | **minor** (x.Y.0) | 1.0.0 → 1.1.0 |
| Bug fix, small improvement | **patch** (x.y.Z) | 1.0.0 → 1.0.1 |

When in doubt, ask the user.

### Step 4: Update CHANGELOG.md

CHANGELOG.md format — this format is mandatory, the release script parses it:

```markdown
## [X.Y.Z] - YYYY-MM-DD
type: major | minor | patch
title: Short descriptive title

### Added
- New feature description

### Improved
- Enhancement description

### Fixed
- Bug fix description
```

Rules:
- New block always goes at the top of the file (right after the `# Changelog` heading)
- Use today's date
- `type:` line is mandatory — must be `major`, `minor`, `patch`, or `beta`
- `title:` line is mandatory — short and descriptive (used in git commit and tedaitesnim.com)
- Don't add empty categories — skip categories with no items
- At least one category with at least one item is required
- Don't modify existing blocks, only add the new one
- Don't use an `## [Unreleased]` block

### Step 5: Show and Get Approval

Before writing changes, show the user:
1. The commit list that was read
2. The proposed version and reasoning
3. The changelog block to be added

After approval, update CHANGELOG.md. Do NOT commit the file — the release script will handle that.

## Important Warnings

- After updating CHANGELOG.md, **do NOT commit it**. The release script (`./release.sh`) will commit it together with manifest.json and package.json in a single release commit.
- **Do NOT update** the version in manifest.json or package.json. The release script handles this.
- Only update CHANGELOG.md — do not touch any other files.

## Example Output

If the latest tag is `v1.0.0` and these commits exist:

```
a1b2c3d feat: add compact view for long conversations
d4e5f6g feat: add sidebar collapse toggle
h7i8j9k improve: smoother scroll animation in message navigator
l0m1n2o fix: bookmark icons disappearing on scroll
p3q4r5s fix: edit history panel scroll reset
t6u7v8w refactor: reorganize popup styles
x9y0z1a chore: update dependencies
```

Output:

```markdown
## [1.1.0] - 2026-03-29
type: minor
title: Compact View and sidebar improvements

### Added
- Compact View for collapsing messages in long conversations
- Sidebar collapse toggle for hiding the Claude.ai sidebar

### Improved
- Smoother scroll animation in message navigator

### Fixed
- Bookmark icons no longer disappear when scrolling in long conversations
- Edit history panel scroll position no longer resets unexpectedly
```

Note: `refactor` and `chore` commits were excluded as they don't affect the end user.

## References

- [changelog-format.md](./references/changelog-format.md) — Full CHANGELOG.md format specification and parse rules
