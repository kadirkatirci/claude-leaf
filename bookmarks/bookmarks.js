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

  card.innerHTML = `
    <div class="bookmark-preview">${escapeHtml(bookmark.previewText)}</div>
    ${bookmark.note ? `<div class="bookmark-note">📝 ${escapeHtml(bookmark.note)}</div>` : ''}
    <div class="bookmark-meta">
      <div class="bookmark-date">
        <span>🕒</span>
        <span>${dateStr}</span>
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
  // Open Claude.ai with the conversation URL
  if (bookmark.conversationUrl) {
    window.location.href = bookmark.conversationUrl;
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
