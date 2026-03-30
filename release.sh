#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Claude Leaf — Chrome Extension Release Script
# ============================================================================
# Usage:  ./release.sh [--dry-run] [--yes]
#
# Prerequisites:
#   1. CHANGELOG.md updated with the new release block at the top
#   2. .env file with required credentials (see below) for live releases
#
# .env variables:
#   CWS_CLIENT_ID        — Google OAuth2 client ID
#   CWS_CLIENT_SECRET    — Google OAuth2 client secret
#   CWS_REFRESH_TOKEN    — Google OAuth2 refresh token
#   CWS_EXTENSION_ID     — Chrome Web Store extension ID
#   CWS_PUBLISHER_ID     — Chrome Web Store publisher ID
#   TEDAI_API_BASE_URL   — e.g. https://www.tedaitesnim.com/api/external/v1
#   TEDAI_API_KEY         — x-api-key for tedaitesnim.com external API
#   TEDAI_EXTENSION_ID   — Extension UUID in tedaitesnim.com DB
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DRY_RUN=false
AUTO_CONFIRM=false

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

step() { echo -e "\n${BLUE}▸ $1${NC}"; }
ok()   { echo -e "  ${GREEN}✓ $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "  ${RED}✗ $1${NC}"; exit 1; }
info() { echo -e "  ${CYAN}ℹ $1${NC}"; }

usage() {
  cat <<'EOF'
Usage: ./release.sh [--dry-run] [--yes]

Options:
  --dry-run  Validate inputs and show planned actions without external calls
  --yes      Skip the interactive confirmation prompt
  -h, --help Show this help text
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      ;;
    --yes)
      AUTO_CONFIRM=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      fail "Unknown argument: $1"
      ;;
  esac
  shift
done

wait_for_upload_completion() {
  local max_attempts=12
  local delay_seconds=5
  local attempt status_response upload_state

  for ((attempt=1; attempt<=max_attempts; attempt++)); do
    info "Upload still processing; polling Chrome Web Store (${attempt}/${max_attempts})"
    sleep "$delay_seconds"

    status_response=$(curl -s \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      "https://chromewebstore.googleapis.com/v2/publishers/${CWS_PUBLISHER_ID}/items/${CWS_EXTENSION_ID}:fetchStatus")

    upload_state=$(echo "$status_response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('lastAsyncUploadState', ''))
except json.JSONDecodeError:
    print('')
")

    case "$upload_state" in
      SUCCEEDED)
        ok "Upload finished successfully"
        return 0
        ;;
      IN_PROGRESS|UPLOAD_IN_PROGRESS)
        ;;
      FAILED|NOT_FOUND)
        echo "$status_response" | python3 -m json.tool 2>/dev/null || echo "$status_response"
        fail "Upload failed while polling status: $upload_state"
        ;;
      "")
        echo "$status_response" | python3 -m json.tool 2>/dev/null || echo "$status_response"
        fail "Could not parse upload status from fetchStatus response"
        ;;
      *)
        warn "Unexpected upload status while polling: $upload_state"
        ;;
    esac
  done

  fail "Timed out waiting for Chrome Web Store upload processing"
}

# ── Load .env ───────────────────────────────────────────────────────────────
step "Loading .env"
if [[ "$DRY_RUN" == false ]]; then
  if [[ ! -f .env ]]; then
    fail ".env file not found in project root"
  fi
  set -a
  source .env
  set +a
  ok ".env loaded"

  # ── Validate required env vars ────────────────────────────────────────────
  REQUIRED_VARS=(
    CWS_CLIENT_ID CWS_CLIENT_SECRET CWS_REFRESH_TOKEN
    CWS_EXTENSION_ID CWS_PUBLISHER_ID
    TEDAI_API_BASE_URL TEDAI_API_KEY TEDAI_EXTENSION_ID
  )
  for var in "${REQUIRED_VARS[@]}"; do
    [[ -z "${!var:-}" ]] && fail "Missing required env var: $var"
  done
  ok "All credentials present"
else
  info "Dry run: skipping .env load and credential validation"
fi

# ── Git working tree check ──────────────────────────────────────────────────
step "Checking git working tree"

# All uncommitted changes (staged + unstaged + untracked), excluding CHANGELOG.md
DIRTY_FILES=$(git status --porcelain --untracked-files=all | grep -vE '^.. CHANGELOG\.md$' || true)

if [[ -n "$DIRTY_FILES" ]]; then
  fail "Working tree has uncommitted changes (other than CHANGELOG.md):
$DIRTY_FILES
    Commit or stash these changes before releasing."
fi

# CHANGELOG.md must have uncommitted changes (script will commit it)
CHANGELOG_STATUS=$(git status --porcelain CHANGELOG.md || true)
if [[ -z "$CHANGELOG_STATUS" ]]; then
  fail "CHANGELOG.md has no pending changes.
    Update CHANGELOG.md with the new release block before running this script."
fi

ok "Working tree clean (only CHANGELOG.md modified)"

# ── Branch check ────────────────────────────────────────────────────────────
step "Checking branch"

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  fail "Must be on 'main' branch to release.
    Current branch: $CURRENT_BRANCH
    Run: git checkout main"
fi

ok "On branch: main"

# ── Parse CHANGELOG.md ──────────────────────────────────────────────────────
step "Parsing CHANGELOG.md"
if [[ ! -f CHANGELOG.md ]]; then
  fail "CHANGELOG.md not found"
fi

# Extract the first (latest) release block
# Format expected:
#   ## [1.1.0] - 2026-03-29
#   type: minor
#   title: Some title here
#
#   ### Category Name
#   - item one
#   - item two

CHANGELOG_BLOCK=$(awk '
  /^## \[[0-9]/ {
    if (found) exit
    found = 1
  }
  found { print }
' CHANGELOG.md)

if [[ -z "$CHANGELOG_BLOCK" ]]; then
  fail "No release block found in CHANGELOG.md"
fi

# Parse version
NEW_VERSION=$(echo "$CHANGELOG_BLOCK" | head -1 | sed -n 's/^## \[\(.*\)\] - .*/\1/p')
if [[ -z "$NEW_VERSION" ]]; then
  FIRST_LINE=$(echo "$CHANGELOG_BLOCK" | head -1)
  fail "Could not parse version from CHANGELOG.md
    Found:    $FIRST_LINE
    Expected: ## [X.Y.Z] - YYYY-MM-DD"
fi

# Validate semver format
if [[ ! "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  fail "Invalid version format: '$NEW_VERSION'
    Expected: semantic versioning (e.g. 1.2.3)"
fi

# Parse release date
RELEASE_DATE=$(echo "$CHANGELOG_BLOCK" | head -1 | sed -n 's/^## \[.*\] - \(.*\)/\1/p')
if [[ -z "$RELEASE_DATE" ]]; then
  RELEASE_DATE=$(date +%Y-%m-%d)
  warn "No date found, using today: $RELEASE_DATE"
fi

# Parse type (major/minor/patch/beta)
RELEASE_TYPE=$(echo "$CHANGELOG_BLOCK" | sed -n 's/^type: *\(.*\)/\1/p' | tr -d '[:space:]')
if [[ -z "$RELEASE_TYPE" ]]; then
  fail "Missing 'type:' line in CHANGELOG.md release block.
    Add this line right after the ## [X.Y.Z] header:
      type: minor
    Valid values: major, minor, patch, beta"
fi

# Validate type enum
if [[ ! "$RELEASE_TYPE" =~ ^(major|minor|patch|beta)$ ]]; then
  fail "Invalid release type: '$RELEASE_TYPE'. Must be: major, minor, patch, or beta"
fi

# Parse title
RELEASE_TITLE=$(echo "$CHANGELOG_BLOCK" | sed -n 's/^title: *\(.*\)/\1/p')
if [[ -z "$RELEASE_TITLE" ]]; then
  fail "Missing 'title:' line in CHANGELOG.md release block.
    Add this line after the 'type:' line:
      title: Human-readable release title"
fi

# Parse description (optional, line after title that isn't a ### or empty)
RELEASE_DESCRIPTION=$(echo "$CHANGELOG_BLOCK" | awk '
  /^title:/ { found_title=1; next }
  found_title && /^$/ { next }
  found_title && /^###/ { exit }
  found_title { print; exit }
')

# Parse changes categories and items → JSON
CHANGES_JSON=$(echo "$CHANGELOG_BLOCK" | awk '
  BEGIN { first=1; printf "[" }
  /^### / {
    if (!first) printf "]},";
    first=0;
    cat = substr($0, 5);
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", cat);
    printf "{\"category\":\"%s\",\"items\":[", cat;
    item_first=1;
  }
  /^- / {
    item = substr($0, 3);
    # Escape double quotes
    gsub(/"/, "\\\"", item);
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", item);
    if (!item_first) printf ",";
    item_first=0;
    printf "\"%s\"", item;
  }
  END {
    if (!first) printf "]}";
    printf "]";
  }
')

# Validate JSON
if ! echo "$CHANGES_JSON" | python3 -m json.tool > /dev/null 2>&1; then
  fail "Generated changes JSON is invalid:\n$CHANGES_JSON"
fi

# Validate changes are not empty
CHANGES_COUNT=$(echo "$CHANGES_JSON" | python3 -c "
import sys, json
data = json.load(sys.stdin)
items = sum(len(c.get('items', [])) for c in data)
print(items)
")
if [[ "$CHANGES_COUNT" -eq 0 ]]; then
  fail "No changes found in CHANGELOG.md release block.
    Add at least one category with items:
      ### Added
      - Description of what was added"
fi

ok "Version:  $NEW_VERSION"
ok "Date:     $RELEASE_DATE"
ok "Type:     $RELEASE_TYPE"
ok "Title:    $RELEASE_TITLE"
[[ -n "$RELEASE_DESCRIPTION" ]] && ok "Desc:     $RELEASE_DESCRIPTION"
info "Changes:  $(echo "$CHANGES_JSON" | python3 -m json.tool --compact)"

# ── Check current versions (triple-source validation) ───────────────────────
step "Validating version references"

# Source 1: manifest.json
CURRENT_MANIFEST_VERSION=$(python3 -c "
import json
with open('manifest.json') as f:
    print(json.load(f)['version'])
")

# Source 2: package.json
CURRENT_PKG_VERSION=$(python3 -c "
import json
with open('package.json') as f:
    print(json.load(f)['version'])
")

# Source 3: Latest git tag (strip 'v' prefix)
LATEST_GIT_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
CURRENT_GIT_VERSION="${LATEST_GIT_TAG#v}"

# Source 4: Second block in CHANGELOG.md (previous release = current state)
PREV_CHANGELOG_VERSION=$(awk '
  /^## \[[0-9]/ {
    count++
    if (count == 2) { print; exit }
  }
' CHANGELOG.md | sed -n 's/^## \[\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)\].*/\1/p')

ok "manifest.json:  ${CURRENT_MANIFEST_VERSION}"
ok "package.json:   ${CURRENT_PKG_VERSION}"
ok "git tag:        ${LATEST_GIT_TAG:-<no tags>}"
ok "prev changelog: ${PREV_CHANGELOG_VERSION:-<none>}"

# ── Cross-check: all current sources must agree ────────────────────────────
MISMATCH=false

if [[ "$CURRENT_MANIFEST_VERSION" != "$CURRENT_PKG_VERSION" ]]; then
  warn "manifest.json ($CURRENT_MANIFEST_VERSION) ≠ package.json ($CURRENT_PKG_VERSION)"
  MISMATCH=true
fi

if [[ -n "$CURRENT_GIT_VERSION" && "$CURRENT_MANIFEST_VERSION" != "$CURRENT_GIT_VERSION" ]]; then
  warn "manifest.json ($CURRENT_MANIFEST_VERSION) ≠ git tag ($LATEST_GIT_TAG)"
  MISMATCH=true
fi

if [[ -n "$PREV_CHANGELOG_VERSION" && "$CURRENT_MANIFEST_VERSION" != "$PREV_CHANGELOG_VERSION" ]]; then
  warn "manifest.json ($CURRENT_MANIFEST_VERSION) ≠ CHANGELOG.md previous ($PREV_CHANGELOG_VERSION)"
  MISMATCH=true
fi

if [[ "$MISMATCH" == true ]]; then
  fail "Version sources are out of sync.
    All three must match before releasing:
      manifest.json / package.json  →  $CURRENT_MANIFEST_VERSION / $CURRENT_PKG_VERSION
      git tag                       →  ${LATEST_GIT_TAG:-<none>}
      CHANGELOG.md previous block   →  ${PREV_CHANGELOG_VERSION:-<none>}
    Fix the mismatch first, then retry."
fi

ok "All sources agree: $CURRENT_MANIFEST_VERSION"

# ── New version must be strictly greater ────────────────────────────────────
if [[ "$NEW_VERSION" == "$CURRENT_MANIFEST_VERSION" ]]; then
  fail "New version ($NEW_VERSION) is same as current ($CURRENT_MANIFEST_VERSION).
    Did you forget to update CHANGELOG.md?"
fi

VERSION_CHECK=$(python3 -c "
current = tuple(int(x) for x in '$CURRENT_MANIFEST_VERSION'.split('.'))
new = tuple(int(x) for x in '$NEW_VERSION'.split('.'))
if new > current:
    print('OK')
else:
    print('DOWNGRADE')
")
if [[ "$VERSION_CHECK" == "DOWNGRADE" ]]; then
  fail "New version ($NEW_VERSION) is lower than current ($CURRENT_MANIFEST_VERSION).
    Version must go forward, not backward."
fi

# ── Check tag doesn't already exist ────────────────────────────────────────
if git rev-parse "v${NEW_VERSION}" >/dev/null 2>&1; then
  fail "Git tag v${NEW_VERSION} already exists.
    This version was already released."
fi

ok "v${NEW_VERSION} > v${CURRENT_MANIFEST_VERSION} ✓"

# ── Confirm ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  Release: v${NEW_VERSION} (${RELEASE_TYPE})${NC}"
echo -e "${YELLOW}  ${RELEASE_TITLE}${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [[ "$DRY_RUN" == true ]]; then
  warn "DRY RUN MODE — no changes will be made"
  echo ""
fi

if [[ "$AUTO_CONFIRM" == false ]]; then
  read -r -p "Proceed with release? [y/N] " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 0
  fi
else
  info "Auto-confirm enabled; continuing without prompt"
fi

# ── Update manifest.json & package.json ─────────────────────────────────────
step "Updating version in manifest.json and package.json"

if [[ "$DRY_RUN" == false ]]; then
  NEW_VERSION="$NEW_VERSION" python3 - <<'PY'
import json
import os

for fname in ['manifest.json', 'package.json']:
    with open(fname, 'r') as f:
        data = json.load(f)
    data['version'] = os.environ['NEW_VERSION']
    with open(fname, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print(f"  ✓ {fname} → {os.environ['NEW_VERSION']}")
PY
else
  info "[dry-run] Would update manifest.json & package.json to $NEW_VERSION"
fi

# ── Build & Zip ─────────────────────────────────────────────────────────────
step "Building and creating zip package"

if [[ "$DRY_RUN" == false ]]; then
  npm run build

  mkdir -p release
  ZIP_NAME="claude-leaf-webstore-${NEW_VERSION}.zip"
  rm -f "release/${ZIP_NAME}"
  ZIP_PATH="release/${ZIP_NAME}"
  ZIP_PATH="$ZIP_PATH" python3 - <<'PY'
import os
import subprocess
import zipfile
from pathlib import Path

root = Path('.').resolve()
zip_path = Path(os.environ['ZIP_PATH'])
tracked_files = subprocess.check_output(
    ['git', 'ls-files', 'manifest.json', 'styles.css', 'src', 'popup', 'icons'],
    text=True,
).splitlines()

dist_dir = root / 'dist'
if not dist_dir.exists():
    raise SystemExit('dist directory not created by build')

archive_files = [Path(path) for path in tracked_files if path and not path.endswith('.DS_Store')]
archive_files.extend(
    sorted(
        path.relative_to(root)
        for path in dist_dir.rglob('*')
        if path.is_file() and path.name != '.DS_Store'
    )
)

seen = set()
with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for rel_path in archive_files:
        rel_string = rel_path.as_posix()
        if rel_string in seen:
            continue
        seen.add(rel_string)
        archive.write(root / rel_path, arcname=rel_string)
PY

  if [[ ! -f "$ZIP_PATH" ]]; then
    fail "Zip file not created: $ZIP_PATH"
  fi

  ZIP_SIZE=$(du -h "$ZIP_PATH" | cut -f1)
  ok "Created $ZIP_PATH ($ZIP_SIZE)"
else
  ZIP_PATH="release/claude-leaf-webstore-${NEW_VERSION}.zip"
  info "[dry-run] Would build and create $ZIP_PATH"
fi

# ── Verify build side effects ───────────────────────────────────────────────
step "Verifying build side effects"

POST_BUILD_FILES=$(git status --porcelain --untracked-files=all | awk '{print substr($0, 4)}')
UNEXPECTED_POST_BUILD=""

while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  case "$file" in
    CHANGELOG.md|manifest.json|package.json|styles.css|popup/popup.css)
      ;;
    *)
      UNEXPECTED_POST_BUILD+="${file}"$'\n'
      ;;
  esac
done <<< "$POST_BUILD_FILES"

if [[ -n "$UNEXPECTED_POST_BUILD" ]]; then
  fail "Build introduced unexpected tracked or untracked changes:
$UNEXPECTED_POST_BUILD
    Commit, ignore, or exclude these files before releasing."
fi

ok "Only expected release files changed"

# ── Git: Commit release locally ─────────────────────────────────────────────
step "Recording release commit locally"

if [[ "$DRY_RUN" == false ]]; then
  git add manifest.json package.json CHANGELOG.md styles.css popup/popup.css
  git commit -m "release: v${NEW_VERSION} — ${RELEASE_TITLE}"
  RELEASE_COMMIT_SHA=$(git rev-parse --short HEAD)
  ok "Created local release commit ${RELEASE_COMMIT_SHA}"
else
  info "[dry-run] Would commit manifest.json, package.json, CHANGELOG.md, styles.css, and popup/popup.css"
fi

# ── Chrome Web Store: Get Access Token ──────────────────────────────────────
step "Getting Chrome Web Store access token"

if [[ "$DRY_RUN" == false ]]; then
  ACCESS_TOKEN_RESPONSE=$(curl -s -X POST "https://oauth2.googleapis.com/token" \
    -d "client_id=${CWS_CLIENT_ID}" \
    -d "client_secret=${CWS_CLIENT_SECRET}" \
    -d "refresh_token=${CWS_REFRESH_TOKEN}" \
    -d "grant_type=refresh_token")

  ACCESS_TOKEN=$(echo "$ACCESS_TOKEN_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data['access_token'])
except (KeyError, json.JSONDecodeError):
    print('')
")

  if [[ -z "$ACCESS_TOKEN" ]]; then
    echo "$ACCESS_TOKEN_RESPONSE"
    fail "Failed to get access token"
  fi
  ok "Access token obtained"
else
  info "[dry-run] Would request Chrome Web Store access token"
fi

# ── Chrome Web Store: Upload ────────────────────────────────────────────────
step "Uploading to Chrome Web Store"

if [[ "$DRY_RUN" == false ]]; then
  UPLOAD_RESPONSE=$(curl -s \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -X POST \
    -T "$ZIP_PATH" \
    "https://chromewebstore.googleapis.com/upload/v2/publishers/${CWS_PUBLISHER_ID}/items/${CWS_EXTENSION_ID}:upload")

  UPLOAD_STATE=$(echo "$UPLOAD_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('uploadState', data.get('itemError', [{}])[0].get('error_code', 'UNKNOWN')))
except:
    print('UNKNOWN')
")

  case "$UPLOAD_STATE" in
    SUCCEEDED)
      ok "Upload successful"
      ;;
    IN_PROGRESS|UPLOAD_IN_PROGRESS)
      wait_for_upload_completion
      ;;
    FAILED)
      echo "$UPLOAD_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$UPLOAD_RESPONSE"
      fail "Upload failed with state: $UPLOAD_STATE"
      ;;
    *)
      echo "$UPLOAD_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$UPLOAD_RESPONSE"
      fail "Unexpected upload state: $UPLOAD_STATE"
      ;;
  esac
else
  info "[dry-run] Would upload $ZIP_PATH to Chrome Web Store"
fi

# ── Chrome Web Store: Publish ───────────────────────────────────────────────
step "Publishing to Chrome Web Store"

if [[ "$DRY_RUN" == false ]]; then
  PUBLISH_RESPONSE=$(curl -s \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -X POST \
    "https://chromewebstore.googleapis.com/v2/publishers/${CWS_PUBLISHER_ID}/items/${CWS_EXTENSION_ID}:publish")

  PUBLISH_STATE=$(echo "$PUBLISH_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('state', 'UNKNOWN'))
except:
    print('UNKNOWN')
")

  case "$PUBLISH_STATE" in
    PENDING_REVIEW|PUBLISHED|STAGED|PUBLISHED_TO_TESTERS)
      CWS_PUBLISH_SUMMARY="$PUBLISH_STATE"
      ok "Publish submitted (state: $PUBLISH_STATE)"
      ;;
    REJECTED|CANCELLED|UNKNOWN)
      echo "$PUBLISH_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$PUBLISH_RESPONSE"
      fail "Publish failed or returned an unusable state: $PUBLISH_STATE"
      ;;
    *)
      CWS_PUBLISH_SUMMARY="$PUBLISH_STATE"
      warn "Publish returned an unexpected state: $PUBLISH_STATE"
      ;;
  esac
else
  CWS_PUBLISH_SUMMARY="dry-run"
  info "[dry-run] Would publish extension to Chrome Web Store"
fi

# ── tedaitesnim.com: Post Changelog ─────────────────────────────────────────
step "Posting changelog to tedaitesnim.com"

CHANGELOG_PAYLOAD=$(NEW_VERSION="$NEW_VERSION" RELEASE_DATE="$RELEASE_DATE" RELEASE_TYPE="$RELEASE_TYPE" RELEASE_TITLE="$RELEASE_TITLE" RELEASE_DESCRIPTION="$RELEASE_DESCRIPTION" CHANGES_JSON="$CHANGES_JSON" python3 - <<'PY'
import json
import os

payload = {
    'version': os.environ['NEW_VERSION'],
    'release_date': os.environ['RELEASE_DATE'],
    'type': os.environ['RELEASE_TYPE'],
    'title': os.environ['RELEASE_TITLE'],
    'published': True,
    'changes': json.loads(os.environ['CHANGES_JSON'])
}

desc = os.environ['RELEASE_DESCRIPTION']
if desc.strip():
    payload['description'] = desc.strip()

print(json.dumps(payload, ensure_ascii=False))
PY
)

info "Payload:"
echo "$CHANGELOG_PAYLOAD" | python3 -m json.tool

if [[ "$DRY_RUN" == false ]]; then
  TEDAI_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${TEDAI_API_KEY}" \
    -d "$CHANGELOG_PAYLOAD" \
    "${TEDAI_API_BASE_URL}/extensions/${TEDAI_EXTENSION_ID}/changelog")

  TEDAI_HTTP_CODE=$(echo "$TEDAI_RESPONSE" | tail -1)
  TEDAI_BODY=$(echo "$TEDAI_RESPONSE" | sed '$d')

  if [[ "$TEDAI_HTTP_CODE" -ge 200 && "$TEDAI_HTTP_CODE" -lt 300 ]]; then
    TEDAI_SUMMARY="HTTP ${TEDAI_HTTP_CODE}"
    ok "Changelog posted to tedaitesnim.com (HTTP $TEDAI_HTTP_CODE)"
  else
    TEDAI_SUMMARY="HTTP ${TEDAI_HTTP_CODE} (manual check)"
    echo "$TEDAI_BODY" | python3 -m json.tool 2>/dev/null || echo "$TEDAI_BODY"
    warn "tedaitesnim.com returned HTTP $TEDAI_HTTP_CODE — check manually"
  fi
else
  TEDAI_SUMMARY="dry-run"
  info "[dry-run] Would POST changelog to tedaitesnim.com"
fi

# ── Git: Tag and Push ───────────────────────────────────────────────────────
step "Tagging and pushing release"

if [[ "$DRY_RUN" == false ]]; then
  git tag "v${NEW_VERSION}"
  git push origin HEAD
  git push origin "v${NEW_VERSION}"
  ok "Committed, tagged v${NEW_VERSION}, and pushed"
else
  info "[dry-run] Would tag v${NEW_VERSION} and push HEAD + tag"
fi

# ── Done ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅ Release v${NEW_VERSION} complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${CYAN}Chrome Web Store:${NC}  ${CWS_PUBLISH_SUMMARY:-not-run}"
echo -e "  ${CYAN}tedaitesnim.com:${NC}   ${TEDAI_SUMMARY:-not-run}"
echo -e "  ${CYAN}Git tag:${NC}           v${NEW_VERSION}"
echo ""
