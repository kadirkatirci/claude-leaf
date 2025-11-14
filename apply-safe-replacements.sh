#!/bin/bash

echo "Applying safe innerHTML replacements..."

# Simple text/emoji replacements
sed -i '' "s/section\.chevron\.innerHTML = section\.isCollapsed ? '▶' : '▼';/section.chevron.textContent = section.isCollapsed ? '▶' : '▼';/" src/modules/SidebarCollapseModule.js

sed -i '' "s/cached\.chevron\.innerHTML = '▶';/cached.chevron.textContent = '▶';/" src/modules/ContentFoldingModule/MessageFolder.js
sed -i '' "s/cached\.chevron\.innerHTML = '▼';/cached.chevron.textContent = '▼';/" src/modules/ContentFoldingModule/MessageFolder.js

sed -i '' "s/cached\.chevron\.innerHTML = '▶';/cached.chevron.textContent = '▶';/" src/modules/ContentFoldingModule/HeadingFolder.js
sed -i '' "s/cached\.chevron\.innerHTML = '▼';/cached.chevron.textContent = '▼';/" src/modules/ContentFoldingModule/HeadingFolder.js

sed -i '' "s/cached\.button\.innerHTML = '⬇️';/cached.button.textContent = '⬇️';/" src/modules/ContentFoldingModule/CodeBlockFolder.js
sed -i '' "s/cached\.button\.innerHTML = '⬆️';/cached.button.textContent = '⬆️';/" src/modules/ContentFoldingModule/CodeBlockFolder.js

sed -i '' "s/collapseBtn\.innerHTML = this\.isAllCollapsed ? '📂' : '📦';/collapseBtn.textContent = this.isAllCollapsed ? '📂' : '📦';/" src/modules/EditHistoryModule.js

sed -i '' "s/this\.elements\.toggleBtn\.innerHTML = '📂';/this.elements.toggleBtn.textContent = '📂';/" src/modules/CompactViewModule.js
sed -i '' "s/this\.elements\.toggleBtn\.innerHTML = '📦';/this.elements.toggleBtn.textContent = '📦';/" src/modules/CompactViewModule.js

sed -i '' "s/moreBtn\.innerHTML = '⋯';/moreBtn.textContent = '⋯';/" src/modules/EmojiMarkerModule/EmojiPicker.js
sed -i '' "s/btn\.innerHTML = emoji;/btn.textContent = emoji;/" src/modules/EmojiMarkerModule/EmojiPicker.js

sed -i '' "s/badge\.innerHTML = newEmoji;/badge.textContent = newEmoji;/" src/modules/EmojiMarkerModule/MarkerBadge.js

sed -i '' "s/button\.innerHTML = '🏷️';/button.textContent = '🏷️';/g" src/modules/EmojiMarkerModule/MarkerButton.js
sed -i '' "s/button\.innerHTML = emoji;/button.textContent = emoji;/g" src/modules/EmojiMarkerModule/MarkerButton.js

sed -i '' "s/closeBtn\.innerHTML = '×';/closeBtn.textContent = '×';/" src/core/BasePanel.js

# Clear content replacements
sed -i '' "s/this\.content\.innerHTML = '';/this.content.textContent = '';/g" src/core/BasePanel.js
sed -i '' "s/this\.content\.innerHTML = '';/this.content.textContent = '';/" src/modules/EditHistoryModule/EditPanel.js
sed -i '' "s/button\.innerHTML = '';/button.textContent = '';/" src/components/primitives/Button.js

echo "Simple replacements done!"

# Now count remaining innerHTML occurrences
echo ""
echo "Remaining innerHTML occurrences:"
grep -r "\.innerHTML\s*=" src --include="*.js" | grep -v "DOMManager.js" | wc -l

echo ""
echo "Files still using innerHTML (excluding DOMManager):"
grep -r "\.innerHTML\s*=" src --include="*.js" | grep -v "DOMManager.js" | cut -d: -f1 | sort -u

echo ""
echo "Done! Check the remaining files for complex HTML content that needs domManager."
