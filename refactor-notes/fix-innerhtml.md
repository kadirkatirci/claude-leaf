# innerHTML Security Fixes

## Summary
All innerHTML assignments should be replaced with safer alternatives:
- For plain text/emojis: Use `textContent`
- For trusted HTML: Use `domManager.setContent(element, content, true)`
- For user content: Always sanitize

## Required Changes

### Simple Text/Emoji Replacements (Use textContent)
These are safe to replace directly with textContent:

1. **SidebarCollapseModule.js:201**
   - OLD: `section.chevron.innerHTML = section.isCollapsed ? '▶' : '▼';`
   - NEW: `section.chevron.textContent = section.isCollapsed ? '▶' : '▼';`

2. **ContentFoldingModule/MessageFolder.js:264**
   - OLD: `cached.chevron.innerHTML = '▶';`
   - NEW: `cached.chevron.textContent = '▶';`

3. **ContentFoldingModule/MessageFolder.js:299**
   - OLD: `cached.chevron.innerHTML = '▼';`
   - NEW: `cached.chevron.textContent = '▼';`

4. **ContentFoldingModule/CodeBlockFolder.js:234**
   - OLD: `cached.button.innerHTML = '⬇️';`
   - NEW: `cached.button.textContent = '⬇️';`

5. **ContentFoldingModule/CodeBlockFolder.js:269**
   - OLD: `cached.button.innerHTML = '⬆️';`
   - NEW: `cached.button.textContent = '⬆️';`

6. **ContentFoldingModule/HeadingFolder.js:192**
   - OLD: `cached.chevron.innerHTML = '▶';`
   - NEW: `cached.chevron.textContent = '▶';`

7. **ContentFoldingModule/HeadingFolder.js:229**
   - OLD: `cached.chevron.innerHTML = '▼';`
   - NEW: `cached.chevron.textContent = '▼';`

8. **EditHistoryModule.js:194**
   - OLD: `collapseBtn.innerHTML = this.isAllCollapsed ? '📂' : '📦';`
   - NEW: `collapseBtn.textContent = this.isAllCollapsed ? '📂' : '📦';`

9. **CompactViewModule.js:189,192,205**
   - OLD: `this.elements.toggleBtn.innerHTML = '📂';`
   - NEW: `this.elements.toggleBtn.textContent = '📂';`

10. **EmojiMarkerModule/EmojiPicker.js:77,309**
    - OLD: `moreBtn.innerHTML = '⋯';`
    - NEW: `moreBtn.textContent = '⋯';`

11. **FixedButtonMixin.js:103**
    - OLD: `button.innerHTML = icon;`
    - NEW: `button.textContent = icon;`

12. **MarkerBadge.js:147**
    - OLD: `badge.innerHTML = newEmoji;`
    - NEW: `badge.textContent = newEmoji;`

13. **MarkerButton.js:99,140,209,240,279**
    - OLD: `button.innerHTML = '🏷️';`
    - NEW: `button.textContent = '🏷️';`

14. **BasePanel.js:146**
    - OLD: `closeBtn.innerHTML = '×';`
    - NEW: `closeBtn.textContent = '×';`

### HTML Content (Need domManager)
These contain actual HTML and need proper handling:

1. **BookmarkSidebar.js:58**
   - OLD: `header.innerHTML = \`${IconLibrary.bookmarkWithDarkMode()} <span>Bookmarks</span>\`;`
   - NEW: Import domManager and use `domManager.setContent(header, \`${IconLibrary.bookmarkWithDarkMode()} <span>Bookmarks</span>\`, true);`

2. **BookmarkButton.js:55,65,136,139**
   - Contains SVG from IconLibrary
   - NEW: Use domManager.setContent with HTML flag

3. **BasePanel.js:248**
   - OLD: `this.content.innerHTML = '';`
   - NEW: `this.content.textContent = '';`

4. **EditPanel.js:77**
   - OLD: `this.content.innerHTML = '';`
   - NEW: `this.content.textContent = '';`

5. **MessageBadge.js:47,128**
   - OLD: `badge.innerHTML = content;`
   - NEW: Check if content is HTML, use appropriate method

6. **Button.js:179**
   - OLD: `button.innerHTML = '';`
   - NEW: `button.textContent = '';`

7. **ExpandButton.js:32,348**
   - OLD: `button.innerHTML = isCollapsed ? '+ Daha fazla göster' : '− Daralt';`
   - NEW: `button.textContent = isCollapsed ? '+ Daha fazla göster' : '− Daralt';`

### DOMUtils-Helpers.js (Already handles it)
The DOMUtils-Helpers.js file has innerHTML usage but it's in utility functions that should be replaced by using DOMManager methods instead.

## Implementation Notes

1. Import domManager where needed:
   ```javascript
   import domManager from '../managers/DOMManager.js';
   ```

2. For simple text/emoji: Use `textContent`

3. For HTML content: Use `domManager.setContent(element, html, true)`

4. For clearing content: Use `textContent = ''` instead of `innerHTML = ''`

5. Test each change to ensure functionality is preserved

## Security Benefits
- Prevents XSS attacks from user-generated content
- Sanitizes HTML when necessary
- Clear distinction between text and HTML content
- Centralized sanitization logic in DOMManager