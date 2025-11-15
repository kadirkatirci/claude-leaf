#!/bin/bash

# Script to refactor files to use only native classes
# Removes all useNativeClasses conditional logic

echo "🔧 Refactoring to use only native classes..."
echo ""

# List of files to refactor
FILES=(
  "src/modules/EmojiMarkerModule/EmojiPicker.js"
  "src/modules/EmojiMarkerModule/MarkerButton.js"
  "src/modules/EmojiMarkerModule/MarkerPanel.js"
  "src/modules/BookmarkModule/BookmarkButton.js"
  "src/modules/BookmarkModule/BookmarkPanel.js"
  "src/modules/EditHistoryModule/EditPanel.js"
  "src/modules/EditHistoryModule/EditBadge.js"
  "src/modules/CompactViewModule/ExpandButton.js"
  "src/modules/CompactViewModule.js"
  "src/components/primitives/Button.js"
  "src/components/primitives/Badge.js"
  "src/components/primitives/CounterBadge.js"
  "src/core/BasePanel.js"
)

# Backup directory
BACKUP_DIR="backups/native-refactor-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📦 Creating backups in $BACKUP_DIR..."
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$file")"
    cp "$file" "$BACKUP_DIR/$file"
    echo "  ✓ Backed up $file"
  fi
done

echo ""
echo "✅ Backups created! Now manually refactor the files."
echo ""
echo "Files to refactor:"
for file in "${FILES[@]}"; do
  echo "  - $file"
done
