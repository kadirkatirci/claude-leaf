// Bookmarks Page JavaScript

const state = {
  bookmarks: [],
  categories: [],
  activeCategory: 'all', // 'all' or categoryId
  searchQuery: '',
};

// UUID Polyfill
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// --- Actions & Modal Logic ---

function openCategoryModal() {
  document.getElementById('category-modal').classList.add('active');
  document.getElementById('cat-name-input').focus();
}

function closeCategoryModal() {
  document.getElementById('category-modal').classList.remove('active');
}

async function saveCategory() {
  const nameInput = document.getElementById('cat-name-input');
  const colorInput = document.getElementById('cat-color-input');
  const name = nameInput.value.trim();

  if (!name) return;

  const newCat = {
    id: generateUUID(),
    name,
    color: colorInput.value,
    createdAt: new Date().toISOString(),
    isDefault: false
  };

  state.categories.push(newCat);
  await saveData();

  closeCategoryModal();
  renderApp();

  // Reset inputs
  nameInput.value = '';
  colorInput.value = '#667eea';
}

function openFullTextModal(bookmark) {
  const modal = document.getElementById('fulltext-modal');
  document.getElementById('fulltext-content').textContent = bookmark.fullText || bookmark.previewText;

  // Setup the "Go to" button inside the modal dynamically or checking if we need to re-bind
  // Safer to re-bind or just set onclick property (which is allowed in JS files)
  const gotoBtn = document.getElementById('fulltext-goto-btn');
  gotoBtn.onclick = () => window.navigateToBookmark(bookmark);

  modal.classList.add('active');
}

function closeFullTextModal() {
  document.getElementById('fulltext-modal').classList.remove('active');
}

window.navigateToBookmark = (bookmark) => {
  if (bookmark.conversationUrl) {
    let targetUrl;
    const baseUrl = 'https://claude.ai';

    if (bookmark.conversationUrl.startsWith('http')) {
      const url = new URL(bookmark.conversationUrl);
      url.searchParams.set('bookmark', bookmark.id);
      targetUrl = url.toString();
    } else {
      const path = bookmark.conversationUrl.startsWith('/') ? bookmark.conversationUrl : '/' + bookmark.conversationUrl;
      targetUrl = `${baseUrl}${path}?bookmark=${bookmark.id}`;
    }
    window.location.href = targetUrl;
  }
};

window.deleteBookmark = async (id) => {
  if (!confirm('Are you sure you want to delete this bookmark?')) return;

  state.bookmarks = state.bookmarks.filter(b => b.id !== id);
  await saveData();
  renderApp();
};

window.deleteCategory = async (id) => {
  const category = state.categories.find(c => c.id === id);
  if (!category) return;

  if (category.isDefault || id === 'default') {
    alert('Cannot delete the default category.');
    return;
  }

  const count = state.bookmarks.filter(b => b.categoryId === id).length;
  if (!confirm(`Delete category "${category.name}"?\n\n${count} bookmarks will be moved to "General".`)) return;

  // Move bookmarks to default
  state.bookmarks = state.bookmarks.map(b =>
    b.categoryId === id ? { ...b, categoryId: 'default' } : b
  );

  // Remove category
  state.categories = state.categories.filter(c => c.id !== id);

  if (state.activeCategory === id) state.activeCategory = 'all';

  await saveData();
  renderApp();
};

// --- Initialization ---

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderApp();
  setupEventListeners();

  // Close modals on click outside
  window.onclick = (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('active');
    }
  };
});

async function loadData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['bookmarks'], (result) => {
      const data = result.bookmarks || {};

      // Load bookmarks
      state.bookmarks = Array.isArray(data.bookmarks) ? data.bookmarks : [];

      // Load categories (ensure defaults)
      const defaultCat = { id: 'default', name: 'General', color: '#667eea', isDefault: true };
      state.categories = Array.isArray(data.categories) && data.categories.length > 0
        ? data.categories
        : [defaultCat];

      // Ensure 'default' exists in case it was deleted somehow?
      if (!state.categories.find(c => c.id === 'default')) {
        state.categories.unshift(defaultCat);
      }

      // Ensure every bookmark has a categoryId
      state.bookmarks = state.bookmarks.map(b => ({
        ...b,
        categoryId: b.categoryId || 'default',
        fullText: b.fullText || b.previewText || ''
      }));

      resolve();
    });
  });
}

async function saveData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['bookmarks'], (result) => {
      const existingMeta = result.bookmarks?.__meta || {
        version: 2,
        createdAt: new Date().toISOString()
      };

      const storeData = {
        __meta: { ...existingMeta, updatedAt: new Date().toISOString() },
        bookmarks: state.bookmarks,
        categories: state.categories
      };

      chrome.storage.local.set({ bookmarks: storeData }, () => {
        // Notify extension parts (facultative, but good practice)
        chrome.runtime.sendMessage({ type: 'BOOKMARKS_UPDATED' }).catch(() => { });
        resolve();
      });
    });
  });
}

function setupEventListeners() {
  // Search
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase();
      renderBookmarks();
    });
  }

  // Static Buttons - CSP Safe
  document.getElementById('btn-new-category')?.addEventListener('click', openCategoryModal);
  document.getElementById('btn-cancel-category')?.addEventListener('click', closeCategoryModal);
  document.getElementById('btn-save-category')?.addEventListener('click', saveCategory);
  document.getElementById('btn-close-fulltext')?.addEventListener('click', closeFullTextModal);
}

// --- Logic ---

function navigateToBookmark(bookmark) {
  if (bookmark.conversationUrl) {
    let targetUrl;
    const baseUrl = 'https://claude.ai';

    if (bookmark.conversationUrl.startsWith('http')) {
      const url = new URL(bookmark.conversationUrl);
      url.searchParams.set('bookmark', bookmark.id);
      targetUrl = url.toString();
    } else {
      const path = bookmark.conversationUrl.startsWith('/') ? bookmark.conversationUrl : '/' + bookmark.conversationUrl;
      targetUrl = `${baseUrl}${path}?bookmark=${bookmark.id}`;
    }
    window.location.href = targetUrl;
  }
}

async function deleteBookmark(id) {
  if (!confirm('Are you sure you want to delete this bookmark?')) return;

  state.bookmarks = state.bookmarks.filter(b => b.id !== id);
  await saveData();
  renderApp();
}

async function deleteCategory(id) {
  const category = state.categories.find(c => c.id === id);
  if (!category) return;

  if (category.isDefault || id === 'default') {
    alert('Cannot delete the default category.');
    return;
  }

  const count = state.bookmarks.filter(b => b.categoryId === id).length;
  if (!confirm(`Delete category "${category.name}"?\n\n${count} bookmarks will be moved to "General".`)) return;

  // Move bookmarks to default
  state.bookmarks = state.bookmarks.map(b =>
    b.categoryId === id ? { ...b, categoryId: 'default' } : b
  );

  // Remove category
  state.categories = state.categories.filter(c => c.id !== id);

  if (state.activeCategory === id) state.activeCategory = 'all';

  await saveData();
  renderApp();
}


// --- Rendering ---

function renderApp() {
  renderCategories();
  renderBookmarks();
}

function renderCategories() {
  const container = document.getElementById('category-list');
  if (!container) return;

  container.innerHTML = '';

  // "All Bookmarks" item
  const allItem = createCategoryItem({
    id: 'all',
    name: 'All Bookmarks',
    color: '#333'
  }, state.bookmarks.length);
  container.appendChild(allItem);

  // Category items
  state.categories.forEach(category => {
    const count = state.bookmarks.filter(b => b.categoryId === category.id).length;
    const item = createCategoryItem(category, count);
    container.appendChild(item);
  });
}

function createCategoryItem(category, count) {
  const div = document.createElement('div');
  div.className = `category-item ${state.activeCategory === category.id ? 'active' : ''}`;
  div.onclick = () => {
    state.activeCategory = category.id;
    // Update title
    document.getElementById('current-category-title').textContent = category.name;
    // Re-render
    renderApp();
  };

  const dot = document.createElement('div');
  dot.className = 'category-dot';
  dot.style.backgroundColor = category.color || '#ccc';

  const name = document.createElement('span');
  name.textContent = category.name;

  const countBadge = document.createElement('span');
  countBadge.className = 'category-count';
  countBadge.textContent = count;

  div.appendChild(dot);
  div.appendChild(name);
  div.appendChild(countBadge);

  // Delete button (only for non-default, non-all categories)
  if (category.id !== 'all' && category.id !== 'default' && !category.isDefault) {
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-cat-btn';
    delBtn.innerHTML = '🗑️';
    delBtn.title = 'Delete Category';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteCategory(category.id);
    };
    div.appendChild(delBtn);
  }

  return div;
}

function renderBookmarks() {
  const container = document.getElementById('bookmarks-grid');
  if (!container) return;

  container.innerHTML = '';

  // Filter
  let filtered = state.bookmarks.filter(b => {
    // Category filter
    if (state.activeCategory !== 'all' && b.categoryId !== state.activeCategory) return false;

    // Search filter
    if (state.searchQuery) {
      const match = (b.fullText || '').toLowerCase().includes(state.searchQuery) ||
        (b.note || '').toLowerCase().includes(state.searchQuery) ||
        (b.previewText || '').toLowerCase().includes(state.searchQuery);
      return match;
    }
    return true;
  });

  // Sort (Newest first)
  filtered.sort((a, b) => (b.createdAt || b.timestamp || 0) - (a.createdAt || a.timestamp || 0));

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>No bookmarks found</h2>
        <p>${state.searchQuery ? 'Try a different search term.' : 'Select a different category or add some bookmarks!'}</p>
      </div>
    `;
    return;
  }

  filtered.forEach(b => {
    container.appendChild(createBookmarkCard(b));
  });
}

function createBookmarkCard(bookmark) {
  const category = state.categories.find(c => c.id === bookmark.categoryId) ||
    state.categories.find(c => c.id === 'default') ||
    { name: 'Unknown', color: '#ccc' };

  const card = document.createElement('div');
  card.className = 'bookmark-card';

  // Date
  const dateStr = new Date(bookmark.createdAt || bookmark.timestamp).toLocaleString();

  // Header
  const header = document.createElement('div');
  header.className = 'card-header';
  header.innerHTML = `
    <span class="card-badge" style="background:${category.color}20; color:${category.color}">
      ${escapeHtml(category.name)}
    </span>
    <span style="font-size:11px; opacity:0.5">${dateStr}</span>
  `;

  // Body
  const body = document.createElement('div');
  body.className = 'card-body';

  const preview = document.createElement('div');
  preview.className = 'bookmark-preview';
  preview.textContent = bookmark.previewText || bookmark.fullText;

  body.appendChild(preview);

  // "Read More" if text is long or fullText exists
  if (bookmark.fullText && bookmark.fullText.length > 200) {
    const readMore = document.createElement('span');
    readMore.className = 'read-more';
    readMore.textContent = 'Read full content';
    readMore.onclick = (e) => {
      e.stopPropagation();
      openFullTextModal(bookmark);
    };
    body.appendChild(readMore);
  }

  // Footer
  const footer = document.createElement('div');
  footer.className = 'card-footer';

  // Conversation Link
  let convoName = 'Conversation';
  try {
    const url = bookmark.conversationUrl.startsWith('http')
      ? new URL(bookmark.conversationUrl)
      : new URL('https://claude.ai' + bookmark.conversationUrl);
    convoName = url.pathname.split('/').pop().substring(0, 8) + '...';
  } catch (e) { }

  footer.innerHTML = `<span>📍 ${escapeHtml(convoName)}</span>`;

  // Actions
  const actions = document.createElement('div');

  // Go to
  const gotoBtn = document.createElement('button');
  gotoBtn.className = 'action-btn';
  gotoBtn.innerHTML = '↗️';
  gotoBtn.title = 'Open in Claude';
  gotoBtn.onclick = (e) => {
    e.stopPropagation();
    navigateToBookmark(bookmark);
  };

  // Delete
  const delBtn = document.createElement('button');
  delBtn.className = 'action-btn delete';
  delBtn.innerHTML = '🗑️';
  delBtn.title = 'Delete Bookmark';
  delBtn.onclick = (e) => {
    e.stopPropagation();
    deleteBookmark(bookmark.id);
  };

  actions.appendChild(gotoBtn);
  actions.appendChild(delBtn);
  footer.appendChild(actions);

  card.appendChild(header);
  card.appendChild(body);
  card.appendChild(footer);

  // Card click -> Open Full Text (Better UX than navigating immediately?)
  // Let's make card click open full text, and button navigate
  card.onclick = (e) => {
    if (e.target.closest('button') || e.target.classList.contains('read-more')) return;
    openFullTextModal(bookmark);
  };

  return card;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
