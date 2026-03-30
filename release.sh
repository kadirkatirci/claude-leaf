#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Claude Leaf — Chrome Extension Release Script
# ============================================================================
# Usage:  ./release.sh [--dry-run]
#
# Prerequisites:
#   1. CHANGELOG.md updated with the new release block at the top
#   2. .env file with required credentials (see below)
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
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

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

# ── Load .env ───────────────────────────────────────────────────────────────
step "Loading .env"
if [[ ! -f .env ]]; then
  fail ".env file not found in project root"
fi
set -a
source .env
set +a
ok ".env loaded"

# ── Validate required env vars ──────────────────────────────────────────────
REQUIRED_VARS=(
  CWS_CLIENT_ID CWS_CLIENT_SECRET CWS_REFRESH_TOKEN
  CWS_EXTENSION_ID CWS_PUBLISHER_ID
  TEDAI_API_BASE_URL TEDAI_API_KEY TEDAI_EXTENSION_ID
)
for var in "${REQUIRED_VARS[@]}"; do
  [[ -z "${!var:-}" ]] && fail "Missing required env var: $var"
done
ok "All credentials present"

# ── Git working tree check ──────────────────────────────────────────────────
step "Checking git working tree"

# All uncommitted changes (staged + unstaged), excluding CHANGELOG.md
DIRTY_FILES=$(git status --porcelain | grep -v "CHANGELOG.md" | grep -v "^??" || true)

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

read -r -p "Proceed with release? [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

# ── Update manifest.json & package.json ─────────────────────────────────────
step "Updating version in manifest.json and package.json"

if [[ "$DRY_RUN" == false ]]; then
  python3 -c "
import json

for fname in ['manifest.json', 'package.json']:
    with open(fname, 'r') as f:
        data = json.load(f)
    data['version'] = '$NEW_VERSION'
    with open(fname, 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print(f'  ✓ {fname} → $NEW_VERSION')
"
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
  zip -r "release/${ZIP_NAME}" manifest.json styles.css dist src popup icons \
    -x "*.DS_Store" "*/.DS_Store"

  ZIP_PATH="release/${ZIP_NAME}"

  if [[ ! -f "$ZIP_PATH" ]]; then
    fail "Zip file not created: $ZIP_PATH"
  fi

  ZIP_SIZE=$(du -h "$ZIP_PATH" | cut -f1)
  ok "Created $ZIP_PATH ($ZIP_SIZE)"
else
  ZIP_PATH="release/claude-leaf-webstore-${NEW_VERSION}.zip"
  info "[dry-run] Would build and create $ZIP_PATH"
fi

# ── Chrome Web Store: Get Access Token ──────────────────────────────────────
step "Getting Chrome Web Store access token"

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

  if [[ "$UPLOAD_STATE" != "SUCCESS" ]]; then
    echo "$UPLOAD_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$UPLOAD_RESPONSE"
    fail "Upload failed with state: $UPLOAD_STATE"
  fi

  ok "Upload successful"
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

  PUBLISH_STATUS=$(echo "$PUBLISH_RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    statuses = data.get('status', [])
    print(statuses[0] if statuses else 'UNKNOWN')
except:
    print('UNKNOWN')
")

  if [[ "$PUBLISH_STATUS" == "OK" || "$PUBLISH_STATUS" == "ITEM_PENDING_REVIEW" ]]; then
    ok "Publish submitted (status: $PUBLISH_STATUS)"
  else
    echo "$PUBLISH_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$PUBLISH_RESPONSE"
    warn "Publish response status: $PUBLISH_STATUS (may still be processing)"
  fi
else
  info "[dry-run] Would publish extension to Chrome Web Store"
fi

# ── tedaitesnim.com: Post Changelog ─────────────────────────────────────────
step "Posting changelog to tedaitesnim.com"

CHANGELOG_PAYLOAD=$(python3 -c "
import json

payload = {
    'version': '$NEW_VERSION',
    'release_date': '$RELEASE_DATE',
    'type': '$RELEASE_TYPE',
    'title': '''$RELEASE_TITLE''',
    'published': True,
    'changes': $CHANGES_JSON
}

desc = '''$RELEASE_DESCRIPTION'''
if desc.strip():
    payload['description'] = desc.strip()

print(json.dumps(payload, ensure_ascii=False))
")

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
    ok "Changelog posted to tedaitesnim.com (HTTP $TEDAI_HTTP_CODE)"
  else
    echo "$TEDAI_BODY" | python3 -m json.tool 2>/dev/null || echo "$TEDAI_BODY"
    warn "tedaitesnim.com returned HTTP $TEDAI_HTTP_CODE — check manually"
  fi
else
  info "[dry-run] Would POST changelog to ${TEDAI_API_BASE_URL}/extensions/${TEDAI_EXTENSION_ID}/changelog"
fi

# ── Git: Commit, Tag, Push ──────────────────────────────────────────────────
step "Git commit, tag, and push"

if [[ "$DRY_RUN" == false ]]; then
  git add manifest.json package.json CHANGELOG.md
  git commit -m "release: v${NEW_VERSION} — ${RELEASE_TITLE}"
  git tag "v${NEW_VERSION}"
  git push origin HEAD
  git push origin "v${NEW_VERSION}"
  ok "Committed, tagged v${NEW_VERSION}, and pushed"
else
  info "[dry-run] Would commit, tag v${NEW_VERSION}, and push"
fi

# ── Done ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ✅ Release v${NEW_VERSION} complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${CYAN}Chrome Web Store:${NC}  Submitted for review"
echo -e "  ${CYAN}tedaitesnim.com:${NC}   Changelog published"
echo -e "  ${CYAN}Git tag:${NC}           v${NEW_VERSION}"
echo ""
