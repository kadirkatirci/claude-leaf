// Bookmarks Page JavaScript

let allBookmarks = [];

// Debug function to check all storage
async function debugStorage() {
  chrome.storage.local.get(null, (allData) => {
    console.log('[DEBUG] All local storage:', allData);
    console.log('[DEBUG] Storage keys:', Object.keys(allData));
  });

  chrome.storage.sync.get(null, (allData) => {
    console.log('[DEBUG] All sync storage:', allData);
    console.log('[DEBUG] Sync keys:', Object.keys(allData));
  });
}

// Load bookmarks when page loads
document.addEventListener('DOMContentLoaded', async () => {
  // Debug storage first
  await debugStorage();

  await loadBookmarks();
  renderBookmarks(allBookmarks);

  // Setup search
  document.getElementById('search-input').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filtered = allBookmarks.filter(bookmark =>
      bookmark.previewText.toLowerCase().includes(searchTerm) ||
      (bookmark.note && bookmark.note.toLowerCase().includes(searchTerm))
    );
    renderBookmarks(filtered);
  });
});

/**
 * Load bookmarks from Chrome storage (new Store format)
 */
async function loadBookmarks() {
  return new Promise((resolve) => {
    // Use NEW storage key 'bookmarks' with Store format
    chrome.storage.local.get(['bookmarks'], (result) => {
      console.log('[Bookmarks Page] Raw storage result:', result);

      // NEW Store format: { version: 2, data: { bookmarks: [...] } }
      if (result.bookmarks && result.bookmarks.data && Array.isArray(result.bookmarks.data.bookmarks)) {
        allBookmarks = result.bookmarks.data.bookmarks;
        console.log(`[Bookmarks Page] ✅ Loaded ${allBookmarks.length} bookmarks from Store format`);
        console.log('[Bookmarks Page] Sample bookmark:', allBookmarks[0]);
      }
      // Fallback: Empty array if no bookmarks
      else {
        allBookmarks = [];
        console.log('[Bookmarks Page] ℹ️ No bookmarks found (storage might be empty or old format)');
        console.log('[Bookmarks Page] Expected format: { bookmarks: { version: 2, data: { bookmarks: [...] } } }');
      }

      console.log(`[Bookmarks Page] Total bookmarks: ${allBookmarks.length}`);
      resolve();
    });
  });
}

/**
 * Save bookmarks to Chrome storage
 */
async function saveBookmarks() {
  return new Promise((resolve) => {
    // Save in new store format
    const storeData = {
      version: 2,
      data: {
        bookmarks: allBookmarks
      }
    };

    chrome.storage.local.set({ bookmarks: storeData }, () => {
      console.log('Bookmarks saved');
      resolve();
    });
  });
}

/**
 * Render bookmarks to the page
 */
function renderBookmarks(bookmarks) {
  const container = document.getElementById('bookmarks-container');
  const totalCount = document.getElementById('total-count');

  // Update count
  totalCount.textContent = `${bookmarks.length} bookmark${bookmarks.length !== 1 ? 's' : ''}`;

  // Clear container
  container.innerHTML = '';

  // Empty state
  if (bookmarks.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.innerHTML = `
      <h2>No bookmarks yet</h2>
      <p>Start bookmarking messages on Claude.ai to see them here!</p>
    `;
    container.appendChild(emptyState);
    return;
  }

  // Sort by date (newest first)
  const sorted = [...bookmarks].sort((a, b) => {
    const timeA = new Date(a.createdAt || a.timestamp || 0).getTime();
    const timeB = new Date(b.createdAt || b.timestamp || 0).getTime();
    return timeB - timeA;
  });

  // Render each bookmark
  sorted.forEach(bookmark => {
    const card = createBookmarkCard(bookmark);
    container.appendChild(card);
  });
}

/**
 * Create a bookmark card element
 */
function createBookmarkCard(bookmark) {
  const card = document.createElement('div');
  card.className = 'bookmark-card';

  // Support both createdAt (new format) and timestamp (old format)
  const dateValue = bookmark.createdAt || bookmark.timestamp;
  const date = new Date(dateValue);
  const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Get conversation name from URL
  let conversationName = 'Unknown';
  if (bookmark.conversationUrl) {
    if (bookmark.conversationUrl.startsWith('/')) {
      // Pathname format - extract conversation ID
      const parts = bookmark.conversationUrl.split('/');
      conversationName = parts[parts.length - 1] || 'Unknown';
    } else if (bookmark.conversationUrl.startsWith('http')) {
      // Full URL format
      try {
        const url = new URL(bookmark.conversationUrl);
        const parts = url.pathname.split('/');
        conversationName = parts[parts.length - 1] || 'Unknown';
      } catch (e) {
        conversationName = 'Unknown';
      }
    }
  }

  card.innerHTML = `
    <div class="bookmark-preview">${escapeHtml(bookmark.previewText)}</div>
    ${bookmark.note ? `<div class="bookmark-note">📝 ${escapeHtml(bookmark.note)}</div>` : ''}
    <div class="bookmark-meta">
      <div class="bookmark-date">
        <span>🕒</span>
        <span>${dateStr}</span>
        <span style="margin-left: 10px; opacity: 0.7; font-size: 11px;">📍 ${conversationName.substring(0, 8)}...</span>
      </div>
      <button class="delete-btn" data-id="${bookmark.id}">🗑️ Delete</button>
    </div>
  `;

  // Click to navigate
  card.addEventListener('click', (e) => {
    if (!e.target.classList.contains('delete-btn')) {
      navigateToBookmark(bookmark);
    }
  });

  // Delete button
  const deleteBtn = card.querySelector('.delete-btn');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteBookmark(bookmark.id);
  });

  return card;
}

/**
 * Navigate to bookmarked message
 */
function navigateToBookmark(bookmark) {
  // Open Claude.ai with the conversation URL and bookmark ID as parameter
  if (bookmark.conversationUrl) {
    let targetUrl;

    // Handle different URL formats
    if (bookmark.conversationUrl.startsWith('http')) {
      // Old format: full URL
      const url = new URL(bookmark.conversationUrl);
      url.searchParams.set('bookmark', bookmark.id);
      targetUrl = url.toString();
    } else if (bookmark.conversationUrl.startsWith('/')) {
      // New format: pathname only
      targetUrl = `https://claude.ai${bookmark.conversationUrl}?bookmark=${bookmark.id}`;
    } else {
      // Fallback: assume it's a path without leading slash
      targetUrl = `https://claude.ai/${bookmark.conversationUrl}?bookmark=${bookmark.id}`;
    }

    window.location.href = targetUrl;
  }
}

/**
 * Delete a bookmark
 */
async function deleteBookmark(bookmarkId) {
  if (!confirm('Are you sure you want to delete this bookmark?')) {
    return;
  }

  allBookmarks = allBookmarks.filter(b => b.id !== bookmarkId);
  await saveBookmarks();
  renderBookmarks(allBookmarks);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
