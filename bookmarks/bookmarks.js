// Bookmarks Page JavaScript

let allBookmarks = [];

// Load bookmarks when page loads
document.addEventListener('DOMContentLoaded', async () => {
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
 * Load bookmarks from Chrome storage
 */
async function loadBookmarks() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['claude-bookmarks'], (result) => {
      allBookmarks = result['claude-bookmarks'] || [];
      console.log(`Loaded ${allBookmarks.length} bookmarks`);
      resolve();
    });
  });
}

/**
 * Save bookmarks to Chrome storage
 */
async function saveBookmarks() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ 'claude-bookmarks': allBookmarks }, () => {
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
  const sorted = [...bookmarks].sort((a, b) => b.timestamp - a.timestamp);

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

  const date = new Date(bookmark.timestamp);
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
