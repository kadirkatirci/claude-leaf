import DOMUtils from '../../utils/DOMUtils.js';
import IconLibrary from '../../components/primitives/IconLibrary.js';
import { bookmarkStore } from '../../stores/index.js';

export class BookmarkManagerModal {
    constructor() {
        this.activeModal = null;
        this.state = {
            bookmarks: [],
            categories: [],
            activeCategory: 'all',
            activeSenderFilter: 'all', // 'all', 'user', 'assistant'
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
        const data = await bookmarkStore.getAll();
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
            onclick: () => this.showCategoryCreationModal()
        });

        sidebar.appendChild(header);
        sidebar.appendChild(listContainer);
        sidebar.appendChild(newBtn);

        return sidebar;
    }

    createMainArea() {
        const main = DOMUtils.createElement('div', {
            className: 'flex-1 flex flex-col bg-bg-000 min-w-0 relative' // relative for positioning overlays if needed
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

        // Sender Filter
        const senderFilter = DOMUtils.createElement('div', {
            className: 'flex bg-bg-100 rounded-lg p-1 ml-4 border border-border-200'
        });

        const filterOptions = [
            { id: 'all', label: 'All' },
            { id: 'user', label: 'User' },
            { id: 'assistant', label: 'Claude' }
        ];

        filterOptions.forEach(opt => {
            const btn = DOMUtils.createElement('button', {
                className: `px-3 py-1 text-xs rounded-md transition-all ${this.state.activeSenderFilter === opt.id ? 'bg-bg-000 text-text-000 shadow-sm font-medium' : 'text-text-300 hover:text-text-100'}`,
                textContent: opt.label,
                onclick: () => {
                    this.state.activeSenderFilter = opt.id;
                    // Update active state visual
                    Array.from(senderFilter.children).forEach(child => {
                        child.className = `px-3 py-1 text-xs rounded-md transition-all ${child.textContent === opt.label ? 'bg-bg-000 text-text-000 shadow-sm font-medium' : 'text-text-300 hover:text-text-100'}`;
                    });
                    this.renderBookmarks();
                }
            });
            senderFilter.appendChild(btn);
        });
        titleArea.appendChild(senderFilter);

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

        // Close Button
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

        // --- Content Views ---

        // 1. Grid View Container
        const gridContainer = DOMUtils.createElement('div', {
            className: 'flex-1 overflow-y-auto p-8',
            id: 'bm-grid-container'
        });

        // Adjusted Grid: Force 2 columns
        const grid = DOMUtils.createElement('div', {
            className: 'grid grid-cols-2 gap-6 pb-10',
            id: 'bm-grid'
        });
        gridContainer.appendChild(grid);

        // 2. Full View Container (Hidden by default)
        const fullViewContainer = DOMUtils.createElement('div', {
            className: 'flex-1 flex flex-col overflow-hidden hidden', // Hidden initially
            id: 'bm-full-view-container'
        });

        // Header for Full View (Back button + Go to Message)
        const fullViewHeader = DOMUtils.createElement('div', {
            className: 'p-4 border-b border-border-100 bg-bg-50 flex justify-between items-center'
        });
        const backBtn = DOMUtils.createElement('button', {
            className: 'px-3 py-1.5 bg-bg-000 border border-border-300 hover:bg-bg-100 rounded text-sm flex items-center gap-2 transition-colors',
            innerHTML: '← Back to List',
            onclick: () => this.showGridView()
        });

        const gotoMsgBtn = DOMUtils.createElement('button', {
            className: 'px-3 py-1.5 bg-accent-main-100 text-white hover:opacity-90 rounded text-sm flex items-center gap-2 transition-colors',
            innerHTML: 'Go to Message ↗️',
            id: 'bm-full-view-goto-btn'
        });

        fullViewHeader.appendChild(backBtn);
        fullViewHeader.appendChild(gotoMsgBtn);

        const fullViewContent = DOMUtils.createElement('div', {
            className: 'flex-1 overflow-y-auto p-8',
            id: 'bm-full-view-content'
        });

        fullViewContainer.appendChild(fullViewHeader);
        fullViewContainer.appendChild(fullViewContent);

        // Append both views
        main.appendChild(header);
        main.appendChild(gridContainer);
        main.appendChild(fullViewContainer);

        return main;
    }

    // --- View Switching ---

    showGridView() {
        const grid = this.activeModal.element.querySelector('#bm-grid-container');
        const full = this.activeModal.element.querySelector('#bm-full-view-container');
        if (grid) grid.classList.remove('hidden');
        if (full) full.classList.add('hidden');
    }

    showFullView() {
        const grid = this.activeModal.element.querySelector('#bm-grid-container');
        const full = this.activeModal.element.querySelector('#bm-full-view-container');
        if (grid) grid.classList.add('hidden');
        if (full) full.classList.remove('hidden');
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
                this.showGridView(); // Ensure we are on grid view
                this.renderCategories();
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

        let filtered = this.state.bookmarks.filter(b => {
            if (this.state.activeCategory !== 'all' && b.categoryId !== this.state.activeCategory) return false;

            // Sender Filter
            if (this.state.activeSenderFilter !== 'all') {
                // If existing bookmark doesn't have sender, we treat it as visible or try to guess? 
                // Let's assume old ones are 'assistant' usually, or just don't filter them out aggressively?
                // Actually, strict filtering is better.
                // But wait, existing bookmarks don't have this field. 
                // Simple fix: if no sender, show in 'all' only? 
                // Or try to infer? 'assistant' is safe default for old bookmarks generally.
                const sender = b.sender || 'assistant';
                if (sender !== this.state.activeSenderFilter) return false;
            }

            if (this.state.searchQuery) {
                const q = this.state.searchQuery;
                const content = b.fullText || '';
                const preview = b.previewText || '';
                return content.toLowerCase().includes(q) || preview.toLowerCase().includes(q);
            }
            return true;
        });

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

        const dateStr = new Date(bookmark.createdAt || bookmark.timestamp).toLocaleDateString();
        const header = DOMUtils.createElement('div', {
            className: 'p-4 border-b border-border-100 flex justify-between items-center bg-bg-50'
        });

        const isUser = bookmark.sender === 'user';
        const senderBadge = isUser
            ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-text-500/10 text-text-500 border border-text-500/20">User</span>`
            : `<span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent-main-100/10 text-accent-main-100 border border-accent-main-100/20">Claude</span>`;

        header.innerHTML = `
            <div class="flex items-center gap-2">
                ${senderBadge}
                <span class="px-2 py-0.5 rounded text-[11px] font-medium" style="background: ${category.color}20; color: ${category.color}">
                    ${category.name}
                </span>
            </div>
            <span class="text-xs text-text-300">${dateStr}</span>
        `;

        const body = DOMUtils.createElement('div', {
            className: 'p-4 flex-1 overflow-hidden relative'
        });

        // Preview text extraction (strip HTML tags if fullText is HTML)
        let preview = bookmark.previewText;
        if (!preview && bookmark.fullText) {
            const tmp = document.createElement('div');
            tmp.innerHTML = bookmark.fullText;
            preview = tmp.textContent.substring(0, 200);
        }

        const previewText = DOMUtils.createElement('div', {
            className: 'text-sm text-text-200 line-clamp-[6]',
            textContent: preview || ''
        });

        const fade = DOMUtils.createElement('div', {
            className: 'absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-bg-000 to-transparent pointer-events-none'
        });

        body.appendChild(previewText);
        body.appendChild(fade);

        const footer = DOMUtils.createElement('div', {
            className: 'p-3 border-t border-border-100 bg-bg-50 flex justify-between items-center'
        });

        let convoName = 'Conversation';
        try {
            const urlPart = bookmark.conversationUrl.split('/').pop();
            convoName = urlPart.substring(0, 8) + '...';
        } catch (e) { }

        const loc = DOMUtils.createElement('div', {
            className: 'text-xs text-text-300 flex items-center gap-1',
            innerHTML: `<span class="opacity-50">📍</span> ${convoName}`
        });

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
        if (bookmark.conversationUrl) {
            const baseUrl = 'https://claude.ai';
            const path = bookmark.conversationUrl.startsWith('/') ? bookmark.conversationUrl : '/' + bookmark.conversationUrl;

            const currentPath = window.location.pathname;
            if (currentPath === path || currentPath === bookmark.conversationUrl) {
                const url = new URL(window.location.href);
                url.searchParams.set('bookmark', bookmark.id);
                window.history.pushState({}, '', url.toString());
                window.location.reload();
            } else {
                window.location.href = `${baseUrl}${path}?bookmark=${bookmark.id}`;
            }
        }
    }

    // --- Sub-Modals ---

    showCategoryCreationModal() {
        // Create a dialog overlay for adding category
        const overlay = DOMUtils.createElement('div', {
            className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-[5100]',
            style: { animation: 'fadeIn 0.1s ease' }
        });

        const dialog = DOMUtils.createElement('div', {
            className: 'bg-bg-000 p-6 rounded-lg shadow-xl w-[350px]',
            style: { animation: 'scaleIn 0.1s ease' }
        });

        dialog.innerHTML = `
            <h3 class="text-lg font-semibold mb-4">New Category</h3>
            <div class="mb-4">
                <label class="block text-xs font-medium text-text-300 mb-1">Name</label>
                <input type="text" id="new-cat-name" class="w-full px-3 py-2 bg-bg-100 border border-border-200 rounded text-sm focus:border-accent-main-100 outline-none" placeholder="e.g. Ideas">
            </div>
            <div class="mb-6">
                <label class="block text-xs font-medium text-text-300 mb-1">Color</label>
                <input type="color" id="new-cat-color" class="w-full h-10 p-1 bg-bg-100 border border-border-200 rounded cursor-pointer" value="#667eea">
            </div>
            <div class="flex justify-end gap-2">
                <button id="btn-cat-cancel" class="px-3 py-1.5 text-text-300 hover:bg-bg-100 rounded text-sm">Cancel</button>
                <button id="btn-cat-save" class="px-3 py-1.5 bg-accent-main-100 text-white rounded text-sm hover:opacity-90">Create</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        const input = dialog.querySelector('#new-cat-name');
        input.focus();

        const close = () => overlay.remove();

        dialog.querySelector('#btn-cat-cancel').onclick = close;
        dialog.querySelector('#btn-cat-save').onclick = async () => {
            const name = input.value.trim();
            const color = dialog.querySelector('#new-cat-color').value;
            if (name) {
                await bookmarkStore.addCategory(name, color);
                await this.refreshData();
                close();
            }
        };

        // Close on click outside
        overlay.onclick = (e) => {
            if (e.target === overlay) close();
        };
    }

    openFullText(bookmark) {
        this.showFullView();

        // Update Go to Button action
        const gotoBtn = this.activeModal.element.querySelector('#bm-full-view-goto-btn');
        if (gotoBtn) {
            gotoBtn.onclick = () => this.navigateToBookmark(bookmark);
        }

        const container = this.activeModal.element.querySelector('#bm-full-view-content');
        if (!container) return;

        container.innerHTML = '';

        // Render Content
        const contentHtml = DOMUtils.createElement('div', {
            className: 'prose max-w-3xl mx-auto font-claude-message text-text-000 whitespace-pre-wrap break-words'
        });

        const text = bookmark.fullText || bookmark.previewText || '';
        if (text.trim().startsWith('<') && text.includes('>')) {
            contentHtml.innerHTML = text;
        } else {
            contentHtml.textContent = text;
        }

        // Clean up content
        // Remove 'claude-expand-footer' and other specific artifacts
        // We use a comprehensive list of selectors to catch all unwanted UI elements
        const selectors = [
            '.claude-expand-footer',
            '.claude-expand-button-container',
            '.claude-expand-btn',
            '.absolute.bottom-0.right-2',
            '[data-testid="action-bar-copy"]',
            'button[aria-label="Copy"]',
            'button[aria-label="Give positive feedback"]',
            'button[aria-label="Give negative feedback"]',
            '.group\\/btn' // Matches the button group class seen in user snippet
        ];

        const toRemove = contentHtml.querySelectorAll(selectors.join(', '));
        toRemove.forEach(el => {
            el.remove();
        });

        // Also remove any elements purely for layout of these buttons if they are left empty or just specific containers
        // The user snippet showed the copy button container has "absolute bottom-0 right-2"
        const remainingOverlays = contentHtml.querySelectorAll('.absolute.bottom-0.right-2');
        remainingOverlays.forEach(el => el.remove());

        container.appendChild(contentHtml);
    }
}