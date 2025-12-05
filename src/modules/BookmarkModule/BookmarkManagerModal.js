
import DOMUtils from '../../utils/DOMUtils.js';
import IconLibrary from '../../components/primitives/IconLibrary.js';
import { bookmarkStore } from '../../stores/index.js';
import { textClass } from '../../utils/ClassNames.js';

export class BookmarkManagerModal {
    constructor() {
        this.activeModal = null;
        this.state = {
            bookmarks: [],
            categories: [],
            activeCategory: 'all',
            searchQuery: ''
        };
    }

    async show() {
        // Load Data
        await this.loadData();

        // Create Modal Structure
        const modal = DOMUtils.createElement('div', {
            className: 'fixed inset-0 bg-black/70 flex items-center justify-center z-[5000]',
            style: { animation: 'fadeIn 0.2s ease' }
        });

        const content = DOMUtils.createElement('div', {
            className: 'bg-bg-000 rounded-xl overflow-hidden shadow-2xl flex flex-row w-[90vw] h-[85vh] max-w-[1200px]',
            style: { animation: 'slideUp 0.3s ease' }
        });

        // Sidebar
        const sidebar = this.createSidebar();

        // Main Area
        const main = this.createMainArea();

        content.appendChild(sidebar);
        content.appendChild(main);
        modal.appendChild(content);

        // Close on click outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.close();
        });

        // ESC to close
        const escHandler = (e) => {
            if (e.key === 'Escape') this.close();
        };
        document.addEventListener('keydown', escHandler);

        this.activeModal = { element: modal, escHandler };
        document.body.appendChild(modal);

        // Initial Render
        this.renderCategories();
        this.renderBookmarks();
    }

    close() {
        if (!this.activeModal) return;
        const { element, escHandler } = this.activeModal;
        element.style.animation = 'fadeOut 0.2s ease';
        setTimeout(() => {
            element.remove();
            document.removeEventListener('keydown', escHandler);
            this.activeModal = null;
        }, 200);
    }

    // --- Data Loading ---

    async loadData() {
        const data = await bookmarkStore.getAll(); // This gets bookmarks array
        // Wait, bookmarkStore.getAll() returns just bookmarks array.
        // We need categories too. BookmarkStore has getCategories() now?
        // Let's check BookmarkStore.js. I previously added getCategories.

        this.state.bookmarks = data || [];
        this.state.categories = await bookmarkStore.getCategories();
    }

    async refreshData() {
        await this.loadData();
        this.renderCategories();
        this.renderBookmarks();
    }

    // --- UI Creation ---

    createSidebar() {
        const sidebar = DOMUtils.createElement('div', {
            className: 'w-[260px] bg-bg-100 border-r border-border-200 flex flex-col shrink-0'
        });

        // Header
        const header = DOMUtils.createElement('div', {
            className: 'p-4 border-b border-border-200 flex items-center gap-2'
        });
        header.innerHTML = `${IconLibrary.bookmark(false, 'currentColor', 20)} <span class="font-semibold text-lg">Bookmarks</span>`;

        // Category List Container
        const listContainer = DOMUtils.createElement('div', {
            className: 'flex-1 overflow-y-auto p-3 space-y-1',
            id: 'bm-category-list'
        });

        // New Category Button
        const newBtn = DOMUtils.createElement('button', {
            className: 'm-3 p-2 bg-bg-000 border border-border-300 border-dashed rounded-lg text-text-300 hover:text-accent-main-100 hover:border-accent-main-100 hover:bg-bg-000 transition-all flex items-center justify-center gap-2 text-sm',
            textContent: '+ New Category',
            onclick: () => this.openNewCategoryModal()
        });

        sidebar.appendChild(header);
        sidebar.appendChild(listContainer);
        sidebar.appendChild(newBtn);

        return sidebar;
    }

    createMainArea() {
        const main = DOMUtils.createElement('div', {
            className: 'flex-1 flex flex-col bg-bg-000 min-w-0'
        });

        // Header
        const header = DOMUtils.createElement('div', {
            className: 'p-6 border-b border-border-200 flex justify-between items-center bg-bg-000'
        });

        // Title & Filter Info
        const titleArea = DOMUtils.createElement('div', {
            className: 'flex items-center gap-3'
        });
        const title = DOMUtils.createElement('h2', {
            className: 'text-xl font-bold text-text-000',
            id: 'bm-current-category-title',
            textContent: 'All Bookmarks'
        });
        titleArea.appendChild(title);

        // Search
        const searchWrapper = DOMUtils.createElement('div', {
            className: 'relative w-[300px]'
        });
        searchWrapper.innerHTML = `
      <div class="absolute left-3 top-1/2 -translate-y-1/2 text-text-300 text-lg">🔍</div>
    `;
        const searchInput = DOMUtils.createElement('input', {
            className: 'w-full pl-10 pr-4 py-2 bg-bg-100 border border-border-200 rounded-lg text-sm text-text-000 focus:border-accent-main-100 focus:outline-none transition-colors',
            placeholder: 'Search bookmarks...',
            oninput: (e) => {
                this.state.searchQuery = e.target.value.toLowerCase();
                this.renderBookmarks();
            }
        });
        searchWrapper.appendChild(searchInput);

        // Close Button (Top Right of main area)
        const closeBtn = DOMUtils.createElement('button', {
            className: 'ml-4 p-2 text-text-300 hover:text-text-000 hover:bg-bg-100 rounded-md transition-colors',
            innerHTML: IconLibrary.close('currentColor', 20),
            onclick: () => this.close()
        });

        header.appendChild(titleArea);

        const rightSide = DOMUtils.createElement('div', { className: 'flex items-center' });
        rightSide.appendChild(searchWrapper);
        rightSide.appendChild(closeBtn);

        header.appendChild(rightSide);

        // Grid Container
        const gridContainer = DOMUtils.createElement('div', {
            className: 'flex-1 overflow-y-auto p-8',
            id: 'bm-grid-container'
        });

        const grid = DOMUtils.createElement('div', {
            className: 'grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6 pb-10',
            id: 'bm-grid'
        });

        gridContainer.appendChild(grid);

        main.appendChild(header);
        main.appendChild(gridContainer);

        return main;
    }

    // --- Rendering ---

    renderCategories() {
        const container = this.activeModal.element.querySelector('#bm-category-list');
        if (!container) return;
        container.innerHTML = '';

        // "All" Item
        container.appendChild(this.createCategoryItem({
            id: 'all', name: 'All Bookmarks', color: '#333'
        }, this.state.bookmarks.length));

        // Category Items
        this.state.categories.forEach(cat => {
            const count = this.state.bookmarks.filter(b => b.categoryId === cat.id).length;
            container.appendChild(this.createCategoryItem(cat, count));
        });
    }

    createCategoryItem(category, count) {
        const isActive = this.state.activeCategory === category.id;
        const item = DOMUtils.createElement('div', {
            className: `flex items-center px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors group ${isActive ? 'bg-accent-main-100/10 text-accent-main-100 font-medium' : 'text-text-200 hover:bg-bg-200 hover:text-text-000'}`,
            onclick: () => {
                this.state.activeCategory = category.id;
                const titleEl = this.activeModal.element.querySelector('#bm-current-category-title');
                if (titleEl) titleEl.textContent = category.name;
                this.renderCategories(); // Re-render to update active state
                this.renderBookmarks();
            }
        });

        const dot = DOMUtils.createElement('div', {
            className: 'w-2.5 h-2.5 rounded-full mr-3',
            style: { backgroundColor: category.color || '#ccc' }
        });

        const name = DOMUtils.createElement('span', {
            className: 'flex-1 truncate',
            textContent: category.name
        });

        const badge = DOMUtils.createElement('span', {
            className: 'text-xs opacity-60 ml-2',
            textContent: count
        });

        item.appendChild(dot);
        item.appendChild(name);
        item.appendChild(badge);

        // Delete Button (if not default/all)
        if (category.id !== 'all' && category.id !== 'default' && !category.isDefault) {
            const delBtn = DOMUtils.createElement('button', {
                className: 'ml-2 p-1 text-text-300 hover:text-danger-100 hover:bg-danger-100/10 rounded opacity-0 group-hover:opacity-100 transition-opacity',
                innerHTML: IconLibrary.trash('currentColor', 14),
                title: 'Delete Category',
                onclick: (e) => {
                    e.stopPropagation();
                    this.deleteCategory(category);
                }
            });
            item.appendChild(delBtn);
        }

        return item;
    }

    renderBookmarks() {
        const grid = this.activeModal.element.querySelector('#bm-grid');
        if (!grid) return;
        grid.innerHTML = '';

        // Filter
        let filtered = this.state.bookmarks.filter(b => {
            if (this.state.activeCategory !== 'all' && b.categoryId !== this.state.activeCategory) return false;
            if (this.state.searchQuery) {
                const q = this.state.searchQuery;
                // Search in full text (HTML stripped? or just text)
                // Ideally we search in plain text representation
                const content = b.fullText || '';
                const preview = b.previewText || '';
                return content.toLowerCase().includes(q) || preview.toLowerCase().includes(q);
            }
            return true;
        });

        // Sort Newest First
        filtered.sort((a, b) => (new Date(b.createdAt || b.timestamp).getTime()) - (new Date(a.createdAt || a.timestamp).getTime()));

        if (filtered.length === 0) {
            grid.innerHTML = `
        <div class="col-span-full flex flex-col items-center justify-center py-20 text-text-300">
          <div class="text-4xl mb-4">🔖</div>
          <div class="text-lg font-medium">No bookmarks found</div>
          <div class="text-sm">Try changing filters or add some bookmarks.</div>
        </div>
      `;
            return;
        }

        filtered.forEach(b => {
            grid.appendChild(this.createBookmarkCard(b));
        });
    }

    createBookmarkCard(bookmark) {
        const category = this.state.categories.find(c => c.id === bookmark.categoryId) ||
            this.state.categories.find(c => c.id === 'default') ||
            { name: 'Unknown', color: '#ccc' };

        const card = DOMUtils.createElement('div', {
            className: 'bg-bg-000 border border-border-200 rounded-xl overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all flex flex-col h-[280px] cursor-pointer group',
            onclick: (e) => {
                if (!e.target.closest('button')) this.openFullText(bookmark);
            }
        });

        // Header
        const dateStr = new Date(bookmark.createdAt || bookmark.timestamp).toLocaleDateString();
        const header = DOMUtils.createElement('div', {
            className: 'p-4 border-b border-border-100 flex justify-between items-center bg-bg-50'
        });
        header.innerHTML = `
      <span class="px-2 py-0.5 rounded text-[11px] font-medium" style="background: ${category.color}20; color: ${category.color}">
        ${category.name}
      </span>
      <span class="text-xs text-text-300">${dateStr}</span>
    `;

        // Preview Body
        const body = DOMUtils.createElement('div', {
            className: 'p-4 flex-1 overflow-hidden relative'
        });

        const previewText = DOMUtils.createElement('div', {
            className: 'text-sm text-text-200 line-clamp-[6]',
            textContent: bookmark.previewText // Using textContent for safety in preview
        });

        // Fade at bottom
        const fade = DOMUtils.createElement('div', {
            className: 'absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-bg-000 to-transparent pointer-events-none'
        });

        body.appendChild(previewText);
        body.appendChild(fade);

        // Footer
        const footer = DOMUtils.createElement('div', {
            className: 'p-3 border-t border-border-100 bg-bg-50 flex justify-between items-center'
        });

        // Conversation name
        let convoName = 'Conversation';
        try {
            const urlPart = bookmark.conversationUrl.split('/').pop();
            convoName = urlPart.substring(0, 8) + '...';
        } catch (e) { }

        const loc = DOMUtils.createElement('div', {
            className: 'text-xs text-text-300 flex items-center gap-1',
            innerHTML: `<span class="opacity-50">📍</span> ${convoName}`
        });

        // Actions
        const actions = DOMUtils.createElement('div', { className: 'flex gap-1' });

        const gotoBtn = DOMUtils.createElement('button', {
            className: 'p-1.5 text-text-300 hover:text-text-000 hover:bg-bg-200 rounded transition-colors',
            title: 'Go to Message',
            innerHTML: '↗️',
            onclick: (e) => {
                e.stopPropagation();
                this.navigateToBookmark(bookmark);
            }
        });

        const delBtn = DOMUtils.createElement('button', {
            className: 'p-1.5 text-text-300 hover:text-danger-100 hover:bg-danger-100/10 rounded transition-colors',
            title: 'Delete',
            innerHTML: IconLibrary.trash('currentColor', 16),
            onclick: (e) => {
                e.stopPropagation();
                this.deleteBookmark(bookmark.id);
            }
        });

        actions.appendChild(gotoBtn);
        actions.appendChild(delBtn);

        footer.appendChild(loc);
        footer.appendChild(actions);

        card.appendChild(header);
        card.appendChild(body);
        card.appendChild(footer);

        return card;
    }

    // --- Actions ---

    async deleteBookmark(id) {
        if (!confirm('Delete this bookmark?')) return;
        await bookmarkStore.remove(id);
        await this.refreshData();
    }

    async deleteCategory(category) {
        const count = this.state.bookmarks.filter(b => b.categoryId === category.id).length;
        if (!confirm(`Delete category "${category.name}"?\n${count} bookmarks will be moved to General.`)) return;

        await bookmarkStore.removeCategory(category.id);
        if (this.state.activeCategory === category.id) this.state.activeCategory = 'all';

        await this.refreshData();
    }

    navigateToBookmark(bookmark) {
        this.close();
        // Use BookmarkModule's logic? Or duplicate?
        // Ideally we dispatch an event or use the module reference if available.
        // For now, let's just do URL navigation which BookmarkModule handles on load/check.

        if (bookmark.conversationUrl) {
            let targetUrl;
            const baseUrl = 'https://claude.ai';
            const path = bookmark.conversationUrl.startsWith('/') ? bookmark.conversationUrl : '/' + bookmark.conversationUrl;

            // Check if we are already on the page
            const currentPath = window.location.pathname;
            if (currentPath === path || currentPath === bookmark.conversationUrl) {
                // Same page, just update param to trigger highlight
                const url = new URL(window.location.href);
                url.searchParams.set('bookmark', bookmark.id);
                window.history.pushState({}, '', url.toString());
                // Trigger a navigation check event or manually call module?
                // Sending a window message might be easiest if Module listens?
                // Or just reload if lazy.
                // Better: BookmarkModule listens for URL changes or we can dispatch a custom event.
                // Let's just set the URL and reload for reliability if we can't access module.
                // But wait, if we are in Single Page App, pushState doesn't verify.
                window.location.reload(); // Simplest forceful way to ensure scrolling happens
            } else {
                window.location.href = `${baseUrl}${path}?bookmark=${bookmark.id}`;
            }
        }
    }

    // --- Sub-Modals ---

    openNewCategoryModal() {
        const name = prompt('Category Name:');
        if (name) {
            const color = '#667eea'; // Default color for now, simplicity
            bookmarkStore.addCategory(name, color).then(() => this.refreshData());
        }
    }

    openFullText(bookmark) {
        // Content View Modal (Nested or separate?)
        // Let's create a full-screen-ish overlay on top of the manager

        const viewer = DOMUtils.createElement('div', {
            className: 'absolute inset-0 bg-bg-000 z-10 flex flex-col',
            style: { animation: 'fadeIn 0.2s ease' }
        });

        // Header
        const header = DOMUtils.createElement('div', {
            className: 'p-4 border-b border-border-200 flex justify-between items-center bg-bg-50 shrink-0'
        });
        header.innerHTML = `
        <div class="font-medium text-lg text-text-000">Parsed Content</div>
    `;
        const closeBtn = DOMUtils.createElement('button', {
            className: 'px-3 py-1 bg-bg-200 hover:bg-bg-300 rounded text-sm',
            textContent: 'Back',
            onclick: () => viewer.remove()
        });
        header.appendChild(closeBtn);

        // Content
        const contentContainer = DOMUtils.createElement('div', {
            className: 'flex-1 overflow-y-auto p-8'
        });

        // We render actual HTML here!
        const contentHtml = DOMUtils.createElement('div', {
            className: 'prose max-w-3xl mx-auto font-claude-message text-text-000 whitespace-pre-wrap break-words'
        });

        // Apply Claude message styles mostly
        // We interpret string. If it's HTML (future), innerHTML.
        // If it's text (legacy), textContent.
        // We'll detect if it looks like HTML.

        const text = bookmark.fullText || bookmark.previewText || '';
        if (text.trim().startsWith('<') && text.includes('>')) {
            contentHtml.innerHTML = text;
        } else {
            contentHtml.textContent = text;
        }

        contentContainer.appendChild(contentHtml);
        viewer.appendChild(header);
        viewer.appendChild(contentContainer);

        // Append to the modal content (not body, so it stays inside modal bounds)
        this.activeModal.element.querySelector('.bg-bg-000').appendChild(viewer);
    }
}
