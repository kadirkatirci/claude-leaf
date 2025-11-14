// Script to safely replace innerHTML with textContent for simple cases
// Run this to see the replacements needed

const replacements = [
    // Simple emoji/text replacements (safe to use textContent)
    {
        file: 'src/modules/SidebarCollapseModule.js',
        line: 201,
        old: "section.chevron.innerHTML = section.isCollapsed ? '▶' : '▼';",
        new: "section.chevron.textContent = section.isCollapsed ? '▶' : '▼';"
    },
    {
        file: 'src/modules/ContentFoldingModule/MessageFolder.js',
        line: 264,
        old: "cached.chevron.innerHTML = '▶';",
        new: "cached.chevron.textContent = '▶';"
    },
    {
        file: 'src/modules/ContentFoldingModule/MessageFolder.js',
        line: 299,
        old: "cached.chevron.innerHTML = '▼';",
        new: "cached.chevron.textContent = '▼';"
    },
    {
        file: 'src/modules/ContentFoldingModule/CodeBlockFolder.js',
        line: 234,
        old: "cached.button.innerHTML = '⬇️';",
        new: "cached.button.textContent = '⬇️';"
    },
    {
        file: 'src/modules/ContentFoldingModule/CodeBlockFolder.js',
        line: 269,
        old: "cached.button.innerHTML = '⬆️';",
        new: "cached.button.textContent = '⬆️';"
    },
    {
        file: 'src/modules/ContentFoldingModule/HeadingFolder.js',
        line: 192,
        old: "cached.chevron.innerHTML = '▶';",
        new: "cached.chevron.textContent = '▶';"
    },
    {
        file: 'src/modules/ContentFoldingModule/HeadingFolder.js',
        line: 229,
        old: "cached.chevron.innerHTML = '▼';",
        new: "cached.chevron.textContent = '▼';"
    },
    {
        file: 'src/modules/EditHistoryModule.js',
        line: 194,
        old: "collapseBtn.innerHTML = this.isAllCollapsed ? '📂' : '📦';",
        new: "collapseBtn.textContent = this.isAllCollapsed ? '📂' : '📦';"
    },
    {
        file: 'src/modules/CompactViewModule.js',
        line: 189,
        old: "this.elements.toggleBtn.innerHTML = '📂';",
        new: "this.elements.toggleBtn.textContent = '📂';"
    },
    {
        file: 'src/modules/CompactViewModule.js',
        line: 192,
        old: "this.elements.toggleBtn.innerHTML = '📦';",
        new: "this.elements.toggleBtn.textContent = '📦';"
    },
    {
        file: 'src/modules/CompactViewModule.js',
        line: 205,
        old: "button.innerHTML = icon;",
        new: "button.textContent = icon;"
    },
    {
        file: 'src/modules/EmojiMarkerModule/EmojiPicker.js',
        line: 77,
        old: "moreBtn.innerHTML = '⋯';",
        new: "moreBtn.textContent = '⋯';"
    },
    {
        file: 'src/modules/EmojiMarkerModule/EmojiPicker.js',
        line: 309,
        old: "btn.innerHTML = emoji;",
        new: "btn.textContent = emoji;"
    },
    {
        file: 'src/core/FixedButtonMixin.js',
        line: 103,
        old: "button.innerHTML = icon;",
        new: "button.textContent = icon;"
    },
    {
        file: 'src/modules/EmojiMarkerModule/MarkerBadge.js',
        line: 147,
        old: "badge.innerHTML = newEmoji;",
        new: "badge.textContent = newEmoji;"
    },
    {
        file: 'src/modules/EmojiMarkerModule/MarkerButton.js',
        line: 99,
        old: "button.innerHTML = '🏷️';",
        new: "button.textContent = '🏷️';"
    },
    {
        file: 'src/modules/EmojiMarkerModule/MarkerButton.js',
        line: 140,
        old: "button.innerHTML = emoji;",
        new: "button.textContent = emoji;"
    },
    {
        file: 'src/modules/EmojiMarkerModule/MarkerButton.js',
        line: 209,
        old: "button.innerHTML = emoji;",
        new: "button.textContent = emoji;"
    },
    {
        file: 'src/modules/EmojiMarkerModule/MarkerButton.js',
        line: 240,
        old: "button.innerHTML = '🏷️';",
        new: "button.textContent = '🏷️';"
    },
    {
        file: 'src/modules/EmojiMarkerModule/MarkerButton.js',
        line: 279,
        old: "button.innerHTML = '🏷️';",
        new: "button.textContent = '🏷️';"
    },
    {
        file: 'src/core/BasePanel.js',
        line: 146,
        old: "closeBtn.innerHTML = '×';",
        new: "closeBtn.textContent = '×';"
    },
    {
        file: 'src/modules/CompactViewModule/ExpandButton.js',
        line: 32,
        old: "button.innerHTML = isCollapsed ? '+ Daha fazla göster' : '− Daralt';",
        new: "button.textContent = isCollapsed ? '+ Daha fazla göster' : '− Daralt';"
    },
    {
        file: 'src/modules/CompactViewModule.js',
        line: 348,
        old: "button.innerHTML = isCollapsed ? '+ Daha fazla göster' : '− Daralt';",
        new: "button.textContent = isCollapsed ? '+ Daha fazla göster' : '− Daralt';"
    },
    // Clear content cases
    {
        file: 'src/core/BasePanel.js',
        line: 248,
        old: "this.content.innerHTML = '';",
        new: "this.content.textContent = '';"
    },
    {
        file: 'src/modules/EditHistoryModule/EditPanel.js',
        line: 77,
        old: "this.content.innerHTML = '';",
        new: "this.content.textContent = '';"
    },
    {
        file: 'src/components/primitives/Button.js',
        line: 179,
        old: "button.innerHTML = '';",
        new: "button.textContent = '';"
    }
];

console.log('Safe innerHTML replacements to make:');
replacements.forEach(r => {
    console.log(`\nFile: ${r.file}`);
    console.log(`Line ${r.line}:`);
    console.log(`  OLD: ${r.old}`);
    console.log(`  NEW: ${r.new}`);
});

console.log(`\nTotal: ${replacements.length} safe replacements`);

// Export for use in automated replacement
if (typeof module !== 'undefined' && module.exports) {
    module.exports = replacements;
}