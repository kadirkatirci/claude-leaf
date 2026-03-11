import DOMUtils from '../../utils/DOMUtils.js';
import IconLibrary from '../../components/primitives/IconLibrary.js';
import { bookmarkStore } from '../../stores/index.js';
import { trackEvent } from '../../analytics/Analytics.js';
import { cn } from '../../utils/ClassNames.js';

export class BookmarkManagerModal {
  constructor() {
    this.activeModal = null;
    this.openSource = 'unknown';
    this.searchDebounceTimer = null;
    this.state = {
      bookmarks: [],
      categories: [],
      activeCategory: 'all',
      activeSenderFilter: 'all', // 'all', 'user', 'assistant'
      searchQuery: '',
      viewMode: 'grid', // 'grid' | 'list'
      selectedBookmarkId: null, // For list view selection
    };
  }

  createMarkupNode(markup) {
    const template = document.createElement('template');
    template.innerHTML = markup.trim();
    return template.content.firstElementChild || document.createTextNode('');
  }

  async show({ source = 'unknown' } = {}) {
    this.openSource = source;
    // Load Data
    await this.loadData();

    trackEvent('bookmark_manager_open', {
      module: 'bookmarks',
      method: source,
      count: this.state.bookmarks.length,
      view_mode: this.state.viewMode,
    });

    // Create Modal Structure
    // Use CSS transitions (not animations) to avoid FOUC flash:
    // Element starts at opacity:0, then transitions to opacity:1 on next frame
    const modal = DOMUtils.createElement('div', {
      className:
        'fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/60 backdrop-blur-md opacity-0 transition-opacity duration-200',
    });

    const content = DOMUtils.createElement('div', {
      className:
        'bg-bg-000 rounded-xl overflow-hidden shadow-2xl flex flex-row w-full h-[85vh] max-w-[1200px] opacity-0 translate-y-5 transition-all duration-300',
    });

    // Sidebar
    const sidebar = this.createSidebar();

    // Main Area
    const main = this.createMainArea();

    content.appendChild(sidebar);
    content.appendChild(main);
    modal.appendChild(content);

    // Close on click outside
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        this.close('backdrop');
      }
    });

    // ESC to close
    const escHandler = e => {
      if (e.key === 'Escape') {
        this.close('escape');
      }
    };
    document.addEventListener('keydown', escHandler);

    this.activeModal = { element: modal, content, escHandler };
    document.body.appendChild(modal);

    // Trigger transition on next frame (after element is in DOM)
    requestAnimationFrame(() => {
      modal.classList.remove('opacity-0');
      modal.classList.add('opacity-100');
      content.classList.remove('opacity-0', 'translate-y-5');
      content.classList.add('opacity-100', 'translate-y-0');
    });

    // Initial Render
    this.renderCategories();
    this.renderBookmarks();
  }

  close(reason = 'unknown') {
    if (!this.activeModal) {
      return;
    }
    trackEvent('bookmark_manager_close', {
      module: 'bookmarks',
      method: reason,
    });
    const { element, content, escHandler } = this.activeModal;
    // Fade out via transition
    element.classList.remove('opacity-100');
    element.classList.add('opacity-0');
    if (content) {
      content.classList.remove('opacity-100', 'translate-y-0');
      content.classList.add('opacity-0', 'translate-y-5');
    }
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

  getSegmentButtonClass(isActive, { iconOnly = false } = {}) {
    return cn(
      iconOnly
        ? 'p-1.5 rounded-md transition-all flex items-center justify-center'
        : 'px-3 py-1 text-xs rounded-md transition-all',
      isActive
        ? 'bg-bg-000 text-text-000 shadow-sm font-medium'
        : 'text-text-300 hover:text-text-100'
    );
  }

  getActionButtonClass(variant = 'ghost') {
    const variantMap = {
      ghost: 'p-1.5 text-text-300 hover:text-text-000 hover:bg-bg-200 rounded transition-colors',
      ghostDanger:
        'p-1.5 text-text-300 hover:text-danger-100 hover:bg-danger-100/10 rounded transition-colors',
      close:
        'ml-4 p-2 text-text-300 hover:text-text-000 hover:bg-bg-100 rounded-md transition-colors',
      secondary:
        'px-3 py-1.5 bg-bg-000 border border-border-300 hover:bg-bg-100 rounded text-sm flex items-center gap-2 transition-colors',
      primary:
        'px-3 py-1.5 bg-accent-main-100 text-white hover:opacity-90 rounded text-sm flex items-center gap-2 transition-colors',
      primaryLg:
        'px-4 py-2 bg-accent-main-100 text-white hover:opacity-90 rounded-lg text-sm flex items-center gap-2 transition-colors',
      sidebarCreate:
        'm-3 p-2 bg-bg-000 border border-border-300 border-dashed rounded-lg text-text-300 hover:text-accent-main-100 hover:border-accent-main-100 hover:bg-bg-000 transition-all flex items-center justify-center gap-2 text-sm',
    };

    return variantMap[variant] || variantMap.ghost;
  }

  getLayoutClass(section) {
    const sectionMap = {
      sidebar: 'w-[260px] bg-bg-100 border-r border-border-200 flex flex-col shrink-0 min-h-0',
      sidebarList: 'flex-1 overflow-y-auto p-3 space-y-1 min-h-0',
      main: 'bg-bg-000 relative flex flex-1 flex-col min-h-0 min-w-0',
      mainHeader:
        'p-6 border-b border-border-200 bg-bg-000 flex items-center justify-between shrink-0',
      gridContainer: 'p-8 flex flex-1 flex-col min-h-0 overflow-y-auto',
      viewColumn: 'flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden',
      viewRow: 'flex flex-1 flex-row min-h-0 min-w-0 overflow-hidden',
      subHeader:
        'p-4 border-b border-border-100 bg-bg-50 flex items-center justify-between shrink-0',
      scrollBody: 'p-8 flex-1 min-h-0 overflow-y-auto',
      masterPanel: 'border-r border-border-200 min-h-0 flex flex-col shrink-0',
      masterList: 'divide-y divide-border-100 flex-1 min-h-0 overflow-y-auto',
      detailPanel: 'bg-bg-000 flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden',
      detailBody: 'p-6 flex-1 min-h-0 overflow-y-auto',
      detailFooter: 'p-4 border-t border-border-100 bg-bg-50 flex justify-end shrink-0',
    };

    return sectionMap[section] || '';
  }

  getComponentClass(section, options = {}) {
    const { active = false, selected = false } = options;
    const sectionMap = {
      categoryItem: cn(
        'flex items-center px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors group',
        active
          ? 'bg-accent-main-100/10 text-accent-main-100 font-medium'
          : 'text-text-200 hover:bg-bg-200 hover:text-text-000'
      ),
      categoryDot: 'w-2.5 h-2.5 rounded-full mr-3',
      categoryDelete:
        'ml-2 p-1 text-text-300 hover:text-danger-100 hover:bg-danger-100/10 rounded opacity-0 group-hover:opacity-100 transition-opacity',
      categoryCount: 'text-xs opacity-60 ml-2',
      card: 'bg-bg-000 border border-border-200 rounded-xl overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all flex flex-col h-[280px] cursor-pointer group',
      sectionHeader: 'p-4 border-b border-border-100 bg-bg-50 flex items-center justify-between',
      sectionFooter: 'p-3 border-t border-border-100 bg-bg-50 flex items-center justify-between',
      cardBody: 'p-4 flex-1 overflow-hidden relative',
      rowGap2: 'flex items-center gap-2',
      rowGap3: 'flex items-center gap-3',
      actionRow: 'flex gap-1',
      listItem: cn(
        'p-3 cursor-pointer border-l-2 transition-colors',
        selected
          ? 'bg-accent-main-100/10 border-accent-main-100'
          : 'border-transparent hover:bg-bg-100'
      ),
      listMetaRow: 'flex items-center justify-between text-xs text-text-300',
      contentDetail:
        'prose max-w-none font-claude-message text-text-000 whitespace-pre-wrap break-words',
      contentFull:
        'prose max-w-3xl mx-auto font-claude-message text-text-000 whitespace-pre-wrap break-words',
      dateLabel: 'text-sm text-text-300',
    };

    return sectionMap[section] || '';
  }

  setHidden(element, hidden) {
    if (!element) {
      return;
    }
    element.classList.toggle('hidden', hidden);
  }

  setDisplay(element, visible, displayValue = 'block') {
    if (!element) {
      return;
    }
    element.style.display = visible ? displayValue : 'none';
  }

  updateSegmentButtons(container, activeId, datasetKey, options = {}) {
    if (!container) {
      return;
    }

    Array.from(container.children).forEach(child => {
      child.className = this.getSegmentButtonClass(child.dataset[datasetKey] === activeId, options);
    });
  }

  createEmptyState(icon, title, description, className = '') {
    const container = DOMUtils.createElement('div', {
      className: cn('text-text-300 flex flex-col items-center justify-center', className),
    });

    const iconEl = DOMUtils.createElement('div', {
      className: 'text-4xl mb-4',
      textContent: icon,
    });
    const titleEl = DOMUtils.createElement('div', {
      className: 'text-lg font-medium',
      textContent: title,
    });

    container.appendChild(iconEl);
    container.appendChild(titleEl);
    if (description) {
      const descEl = DOMUtils.createElement('div', {
        className: 'text-sm',
        textContent: description,
      });
      container.appendChild(descEl);
    }
    return container;
  }

  createSenderBadge(sender, className = '') {
    const isUser = sender === 'user';
    return DOMUtils.createElement('span', {
      className: cn(
        'rounded border text-[10px] font-medium',
        isUser
          ? 'bg-text-500/10 text-text-500 border-text-500/20'
          : 'bg-accent-main-100/10 text-accent-main-100 border-accent-main-100/20',
        className
      ),
      textContent: isUser ? 'User' : 'Claude',
    });
  }

  createCategoryBadge(category, className = '') {
    const badge = DOMUtils.createElement('span', {
      className: cn('rounded font-medium', className),
      textContent: category.name,
    });

    badge.style.backgroundColor = `${category.color}20`;
    badge.style.color = category.color;
    return badge;
  }

  createConversationLocation(conversationName) {
    const location = DOMUtils.createElement('div', {
      className: 'text-xs text-text-300 flex items-center gap-1',
    });
    location.appendChild(
      DOMUtils.createElement('span', {
        className: 'opacity-50',
        textContent: '📍',
      })
    );
    location.appendChild(
      DOMUtils.createElement('span', {
        textContent: conversationName,
      })
    );
    return location;
  }

  extractPreviewText(bookmark, maxLength = 200) {
    if (bookmark.previewText) {
      return bookmark.previewText.substring(0, maxLength);
    }

    if (!bookmark.fullText) {
      return '';
    }

    const tmp = document.createElement('div');
    tmp.innerHTML = bookmark.fullText;
    return tmp.textContent.trim().substring(0, maxLength);
  }

  getBookmarkCategory(bookmark) {
    return (
      this.state.categories.find(c => c.id === bookmark.categoryId) ||
      this.state.categories.find(c => c.id === 'default') || {
        name: 'Unknown',
        color: '#ccc',
      }
    );
  }

  getBookmarkDate(bookmark) {
    return new Date(bookmark.createdAt || bookmark.timestamp).toLocaleDateString();
  }

  getBookmarkConversationName(bookmark) {
    try {
      const urlPart = bookmark.conversationUrl.split('/').pop();
      return `${urlPart.substring(0, 8)}...`;
    } catch {
      return 'Conversation';
    }
  }

  removeBookmarkContentArtifacts(contentRoot) {
    const selectors = [
      '.claude-expand-footer',
      '.claude-expand-button-container',
      '.claude-expand-btn',
      '.absolute.bottom-0.right-2',
      '[data-testid="action-bar-copy"]',
      'button[aria-label="Copy"]',
      'button[aria-label="Give positive feedback"]',
      'button[aria-label="Give negative feedback"]',
      '.group\\/btn',
    ];

    const toRemove = contentRoot.querySelectorAll(selectors.join(', '));
    toRemove.forEach(el => el.remove());
  }

  createBookmarkContentNode(bookmark, variant = 'detail') {
    const contentHtml = DOMUtils.createElement('div', {
      className:
        variant === 'full'
          ? this.getComponentClass('contentFull')
          : this.getComponentClass('contentDetail'),
    });

    const text = bookmark.fullText || bookmark.previewText || '';
    if (text.trim().startsWith('<') && text.includes('>')) {
      contentHtml.innerHTML = text;
    } else {
      contentHtml.textContent = text;
    }

    this.removeBookmarkContentArtifacts(contentHtml);
    return contentHtml;
  }

  // --- UI Creation ---

  createSidebar() {
    const sidebar = DOMUtils.createElement('div', {
      className: this.getLayoutClass('sidebar'),
    });

    // Header
    const header = DOMUtils.createElement('div', {
      className: 'p-4 border-border-200 flex items-center gap-2',
    });
    header.appendChild(this.createMarkupNode(IconLibrary.bookmark(false, 'currentColor', 20)));
    header.appendChild(
      DOMUtils.createElement('span', {
        className: 'font-semibold text-lg',
        textContent: 'Bookmarks',
      })
    );

    // Category List Container
    const listContainer = DOMUtils.createElement('div', {
      className: this.getLayoutClass('sidebarList'),
      id: 'bm-category-list',
    });

    // New Category Button
    const newBtn = DOMUtils.createElement('button', {
      className: this.getActionButtonClass('sidebarCreate'),
      textContent: '+ New Category',
      onclick: () => {
        trackEvent('bookmark_manager_category_create_open', {
          module: 'bookmarks',
          method: 'sidebar_button',
        });
        this.showCategoryCreationModal();
      },
    });

    sidebar.appendChild(header);
    sidebar.appendChild(listContainer);
    sidebar.appendChild(newBtn);

    return sidebar;
  }

  createMainArea() {
    const main = DOMUtils.createElement('div', {
      className: this.getLayoutClass('main'),
    });

    // Header
    const header = DOMUtils.createElement('div', {
      className: this.getLayoutClass('mainHeader'),
    });

    // Title & Filter Info
    const titleArea = DOMUtils.createElement('div', {
      className: 'flex items-center gap-3',
    });
    const title = DOMUtils.createElement('h2', {
      className: 'text-xl font-bold text-text-000',
      id: 'bm-current-category-title',
      textContent: 'All Bookmarks',
    });
    titleArea.appendChild(title);

    // Sender Filter
    const senderFilter = DOMUtils.createElement('div', {
      className: 'flex bg-bg-100 rounded-lg p-1 ml-4 border border-border-200',
    });

    const filterOptions = [
      { id: 'all', label: 'All' },
      { id: 'user', label: 'User' },
      { id: 'assistant', label: 'Claude' },
    ];

    filterOptions.forEach(opt => {
      const btn = DOMUtils.createElement('button', {
        className: this.getSegmentButtonClass(this.state.activeSenderFilter === opt.id),
        textContent: opt.label,
        'data-filter-id': opt.id,
        onclick: () => {
          this.state.activeSenderFilter = opt.id;
          this.updateSegmentButtons(senderFilter, opt.id, 'filterId');
          this.renderBookmarks();
          const filteredCount = this.getFilteredBookmarks().length;
          trackEvent('bookmark_manager_sender_filter', {
            module: 'bookmarks',
            sender: opt.id,
            count: filteredCount,
          });
        },
      });
      senderFilter.appendChild(btn);
    });
    titleArea.appendChild(senderFilter);

    // View Toggle (Grid / List)
    const viewToggle = DOMUtils.createElement('div', {
      className: 'flex bg-bg-100 rounded-lg p-1 ml-4 border border-border-200',
      id: 'bm-view-toggle',
    });

    const viewOptions = [
      { id: 'grid', icon: IconLibrary.grid('currentColor', 16), title: 'Grid View' },
      { id: 'list', icon: IconLibrary.list('currentColor', 16), title: 'List View' },
    ];

    viewOptions.forEach(opt => {
      const btn = DOMUtils.createElement('button', {
        className: this.getSegmentButtonClass(this.state.viewMode === opt.id, { iconOnly: true }),
        title: opt.title,
        onclick: () => this.setViewMode(opt.id),
      });
      btn.appendChild(this.createMarkupNode(opt.icon));
      btn.dataset.viewMode = opt.id;
      viewToggle.appendChild(btn);
    });
    titleArea.appendChild(viewToggle);

    // Search
    const searchWrapper = DOMUtils.createElement('div', {
      className: 'relative w-[300px]',
    });
    searchWrapper.appendChild(
      DOMUtils.createElement('div', {
        className: 'absolute left-3 top-1/2 -translate-y-1/2 text-text-300 text-lg',
        textContent: '🔍',
      })
    );
    const searchInput = DOMUtils.createElement('input', {
      className:
        'w-full pl-10 pr-4 py-2 bg-bg-100 border border-border-200 rounded-lg text-sm text-text-000 focus:border-accent-main-100 focus:outline-none transition-colors',
      placeholder: 'Search bookmarks...',
      oninput: e => {
        this.state.searchQuery = e.target.value.toLowerCase();
        this.renderBookmarks();
        if (this.searchDebounceTimer) {
          clearTimeout(this.searchDebounceTimer);
        }
        this.searchDebounceTimer = setTimeout(() => {
          const filteredCount = this.getFilteredBookmarks().length;
          trackEvent('bookmark_manager_search', {
            module: 'bookmarks',
            query_length: this.state.searchQuery.length,
            count: filteredCount,
          });
        }, 400);
      },
    });
    searchWrapper.appendChild(searchInput);

    // Close Button
    const closeBtn = DOMUtils.createElement('button', {
      className: this.getActionButtonClass('close'),
      onclick: () => this.close('close_btn'),
    });
    closeBtn.appendChild(this.createMarkupNode(IconLibrary.close('currentColor', 20)));

    header.appendChild(titleArea);

    const rightSide = DOMUtils.createElement('div', { className: 'flex items-center' });
    rightSide.appendChild(searchWrapper);
    rightSide.appendChild(closeBtn);

    header.appendChild(rightSide);

    // --- Content Views ---

    // 1. Grid View Container
    const gridContainer = DOMUtils.createElement('div', {
      className: this.getLayoutClass('gridContainer'),
      id: 'bm-grid-container',
    });

    // Grid Empty State (hidden by default)
    const gridEmptyState = this.createEmptyState(
      '🔖',
      'No bookmarks found',
      'Try changing filters or add some bookmarks.',
      'flex-1'
    );
    gridEmptyState.id = 'bm-grid-empty';
    this.setDisplay(gridEmptyState, false);
    gridContainer.appendChild(gridEmptyState);

    // Adjusted Grid: Force 2 columns
    const grid = DOMUtils.createElement('div', {
      className: 'grid grid-cols-2 gap-6 pb-10',
      id: 'bm-grid',
    });
    gridContainer.appendChild(grid);

    // 2. Full View Container (Hidden by default)
    const fullViewContainer = DOMUtils.createElement('div', {
      className: this.getLayoutClass('viewColumn'),
      id: 'bm-full-view-container',
    });
    this.setDisplay(fullViewContainer, false);

    // Header for Full View (Back button + Go to Message)
    const fullViewHeader = DOMUtils.createElement('div', {
      className: this.getLayoutClass('subHeader'),
    });
    const backBtn = DOMUtils.createElement('button', {
      className: this.getActionButtonClass('secondary'),
      textContent: '← Back to List',
      onclick: () => this.showGridView('back'),
    });

    const gotoMsgBtn = DOMUtils.createElement('button', {
      className: this.getActionButtonClass('primary'),
      textContent: 'Go to Message ↗️',
      id: 'bm-full-view-goto-btn',
    });

    fullViewHeader.appendChild(backBtn);
    fullViewHeader.appendChild(gotoMsgBtn);

    const fullViewContent = DOMUtils.createElement('div', {
      className: this.getLayoutClass('scrollBody'),
      id: 'bm-full-view-content',
    });

    fullViewContainer.appendChild(fullViewHeader);
    fullViewContainer.appendChild(fullViewContent);

    // 3. List View Container (Split Pane - Master/Detail)
    const listViewContainer = DOMUtils.createElement('div', {
      className: this.getLayoutClass('viewRow'),
      id: 'bm-list-view-container',
    });
    this.setDisplay(listViewContainer, false);

    // Master Panel (Left - List)
    const masterPanel = DOMUtils.createElement('div', {
      className: this.getLayoutClass('masterPanel'),
      id: 'bm-master-panel',
      style: {
        width: 'clamp(260px, 30%, 320px)',
        flexBasis: 'clamp(260px, 30%, 320px)',
      },
    });

    const masterList = DOMUtils.createElement('div', {
      className: this.getLayoutClass('masterList'),
      id: 'bm-master-list',
    });
    masterPanel.appendChild(masterList);

    // Detail Panel (Right - Content)
    const detailPanel = DOMUtils.createElement('div', {
      className: this.getLayoutClass('detailPanel'),
      id: 'bm-detail-panel',
    });

    // Detail panel empty state
    const detailEmpty = this.createEmptyState(
      '📖',
      'Select a bookmark',
      'Choose a bookmark from the list to view its content',
      'flex-1'
    );
    detailEmpty.id = 'bm-detail-empty';
    detailPanel.appendChild(detailEmpty);

    // Detail content container (hidden initially)
    const detailContent = DOMUtils.createElement('div', {
      className: this.getLayoutClass('viewColumn'),
      id: 'bm-detail-content',
    });
    this.setDisplay(detailContent, false);

    // Detail header
    const detailHeader = DOMUtils.createElement('div', {
      className: this.getLayoutClass('subHeader'),
      id: 'bm-detail-header',
    });
    detailContent.appendChild(detailHeader);

    // Detail body
    const detailBody = DOMUtils.createElement('div', {
      className: this.getLayoutClass('detailBody'),
      id: 'bm-detail-body',
    });
    detailContent.appendChild(detailBody);

    // Detail footer
    const detailFooter = DOMUtils.createElement('div', {
      className: this.getLayoutClass('detailFooter'),
      id: 'bm-detail-footer',
    });
    const gotoMsgBtnList = DOMUtils.createElement('button', {
      className: this.getActionButtonClass('primaryLg'),
      textContent: 'Go to Message ↗️',
      id: 'bm-detail-goto-btn',
    });
    detailFooter.appendChild(gotoMsgBtnList);
    detailContent.appendChild(detailFooter);

    detailPanel.appendChild(detailContent);

    listViewContainer.appendChild(masterPanel);
    listViewContainer.appendChild(detailPanel);

    // Append all views
    main.appendChild(header);
    main.appendChild(gridContainer);
    main.appendChild(fullViewContainer);
    main.appendChild(listViewContainer);

    return main;
  }

  // --- View Switching ---

  showGridView(reason = null) {
    const grid = this.activeModal.element.querySelector('#bm-grid-container');
    const full = this.activeModal.element.querySelector('#bm-full-view-container');
    const list = this.activeModal.element.querySelector('#bm-list-view-container');
    this.setDisplay(grid, true, 'flex');
    this.setDisplay(full, false);
    this.setDisplay(list, false);
    this.state.viewMode = 'grid';
    this.updateViewToggle();
    if (reason) {
      trackEvent('bookmark_manager_view_change', {
        module: 'bookmarks',
        method: reason,
        view_mode: 'grid',
      });
    }
  }

  showFullView() {
    const grid = this.activeModal.element.querySelector('#bm-grid-container');
    const full = this.activeModal.element.querySelector('#bm-full-view-container');
    const list = this.activeModal.element.querySelector('#bm-list-view-container');
    this.setDisplay(grid, false);
    this.setDisplay(full, true, 'flex');
    this.setDisplay(list, false);
  }

  updateViewToggle() {
    const viewToggle = this.activeModal.element.querySelector('#bm-view-toggle');
    this.updateSegmentButtons(viewToggle, this.state.viewMode, 'viewMode', { iconOnly: true });
  }

  // --- Rendering ---

  renderCategories() {
    const container = this.activeModal.element.querySelector('#bm-category-list');
    if (!container) {
      return;
    }
    DOMUtils.clearElement(container);

    // "All" Item
    container.appendChild(
      this.createCategoryItem(
        {
          id: 'all',
          name: 'All Bookmarks',
          color: '#333',
        },
        this.state.bookmarks.length
      )
    );

    // Category Items
    this.state.categories.forEach(cat => {
      const count = this.state.bookmarks.filter(b => b.categoryId === cat.id).length;
      container.appendChild(this.createCategoryItem(cat, count));
    });
  }

  createCategoryItem(category, count) {
    const isActive = this.state.activeCategory === category.id;
    const item = DOMUtils.createElement('div', {
      className: this.getComponentClass('categoryItem', { active: isActive }),
      onclick: () => {
        this.state.activeCategory = category.id;
        const titleEl = this.activeModal.element.querySelector('#bm-current-category-title');
        if (titleEl) {
          titleEl.textContent = category.name;
        }
        this.showGridView(); // Ensure we are on grid view
        this.renderCategories();
        this.renderBookmarks();
        const filteredCount = this.getFilteredBookmarks().length;
        trackEvent('bookmark_manager_category_select', {
          module: 'bookmarks',
          category_id: category.id,
          count: filteredCount,
        });
      },
    });

    const dot = DOMUtils.createElement('div', {
      className: this.getComponentClass('categoryDot'),
      style: { backgroundColor: category.color || '#ccc' },
    });

    const name = DOMUtils.createElement('span', {
      className: 'flex-1 truncate',
      textContent: category.name,
    });

    item.appendChild(dot);
    item.appendChild(name);

    // Delete Button (Before Badge)
    if (category.id !== 'all' && category.id !== 'default' && !category.isDefault) {
      const delBtn = DOMUtils.createElement('button', {
        className: this.getComponentClass('categoryDelete'),
        title: 'Delete Category',
        onclick: e => {
          e.stopPropagation();
          this.deleteCategory(category);
        },
      });
      delBtn.appendChild(this.createMarkupNode(IconLibrary.trash('currentColor', 14)));
      item.appendChild(delBtn);
    }

    // Badge (Last element to align right)
    const badge = DOMUtils.createElement('span', {
      className: this.getComponentClass('categoryCount'),
      textContent: count,
    });
    item.appendChild(badge);

    return item;
  }

  renderBookmarks() {
    // Render grid view
    const grid = this.activeModal.element.querySelector('#bm-grid');
    const gridEmptyState = this.activeModal.element.querySelector('#bm-grid-empty');

    if (grid) {
      DOMUtils.clearElement(grid);

      const filtered = this.getFilteredBookmarks();

      if (filtered.length === 0) {
        this.setDisplay(grid, false);
        this.setDisplay(gridEmptyState, true, 'flex');
      } else {
        this.setDisplay(grid, true, 'grid');
        this.setDisplay(gridEmptyState, false);
        filtered.forEach(b => {
          grid.appendChild(this.createBookmarkCard(b));
        });
      }
    }

    // Also update list view if it's active
    if (this.state.viewMode === 'list') {
      this.renderMasterList();

      // Update detail panel if selected bookmark still exists
      const filtered = this.getFilteredBookmarks();
      if (this.state.selectedBookmarkId) {
        const selected = filtered.find(b => b.id === this.state.selectedBookmarkId);
        if (selected) {
          this.renderDetailPanel(selected);
        } else {
          // Selected bookmark was filtered out, show empty or select first
          this.state.selectedBookmarkId = null;
          const emptyState = this.activeModal.element.querySelector('#bm-detail-empty');
          const content = this.activeModal.element.querySelector('#bm-detail-content');
          this.setDisplay(emptyState, true, 'flex');
          this.setDisplay(content, false);
        }
      }
    }
  }

  createBookmarkCard(bookmark) {
    const category = this.getBookmarkCategory(bookmark);

    const card = DOMUtils.createElement('div', {
      className: this.getComponentClass('card'),
      onclick: e => {
        if (!e.target.closest('button')) {
          trackEvent('bookmark_manager_bookmark_open', {
            module: 'bookmarks',
            method: 'grid_card',
            view_mode: 'grid',
          });
          this.openFullText(bookmark);
        }
      },
    });

    const dateStr = this.getBookmarkDate(bookmark);
    const header = DOMUtils.createElement('div', {
      className: this.getComponentClass('sectionHeader'),
    });

    const headerLeft = DOMUtils.createElement('div', {
      className: this.getComponentClass('rowGap2'),
    });
    headerLeft.appendChild(this.createSenderBadge(bookmark.sender, 'px-1.5 py-0.5'));
    headerLeft.appendChild(this.createCategoryBadge(category, 'px-2 py-0.5 text-[11px]'));

    const headerDate = DOMUtils.createElement('span', {
      className: 'text-xs text-text-300',
      textContent: dateStr,
    });

    header.appendChild(headerLeft);
    header.appendChild(headerDate);

    const body = DOMUtils.createElement('div', {
      className: this.getComponentClass('cardBody'),
    });

    // Preview text extraction (strip HTML tags if fullText is HTML)
    const preview = this.extractPreviewText(bookmark, 200);

    const previewText = DOMUtils.createElement('div', {
      className: 'text-sm text-text-200 line-clamp-[6]',
      textContent: preview || '',
    });

    const fade = DOMUtils.createElement('div', {
      className:
        'absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-bg-000 to-transparent pointer-events-none',
    });

    body.appendChild(previewText);
    body.appendChild(fade);

    const footer = DOMUtils.createElement('div', {
      className: this.getComponentClass('sectionFooter'),
    });

    const loc = this.createConversationLocation(this.getBookmarkConversationName(bookmark));

    const actions = DOMUtils.createElement('div', {
      className: this.getComponentClass('actionRow'),
    });

    const gotoBtn = DOMUtils.createElement('button', {
      className: this.getActionButtonClass('ghost'),
      title: 'Go to Message',
      textContent: '↗️',
      onclick: e => {
        e.stopPropagation();
        this.navigateToBookmark(bookmark, 'grid_card_button');
      },
    });

    const delBtn = DOMUtils.createElement('button', {
      className: this.getActionButtonClass('ghostDanger'),
      title: 'Delete',
      onclick: e => {
        e.stopPropagation();
        this.deleteBookmark(bookmark.id, 'grid_card');
      },
    });
    delBtn.appendChild(this.createMarkupNode(IconLibrary.trash('currentColor', 16)));

    actions.appendChild(gotoBtn);
    actions.appendChild(delBtn);

    footer.appendChild(loc);
    footer.appendChild(actions);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);

    return card;
  }

  // --- List View Methods ---

  createBookmarkListItem(bookmark, isSelected) {
    const category = this.getBookmarkCategory(bookmark);

    const item = DOMUtils.createElement('div', {
      className: this.getComponentClass('listItem', { selected: isSelected }),
    });

    // Use addEventListener for reliable click handling
    item.addEventListener('click', () => {
      this.selectBookmark(bookmark, { method: 'list_click', track: true });
    });

    // Top row: Sender badge + Preview
    const topRow = DOMUtils.createElement('div', {
      className: cn(this.getComponentClass('rowGap2'), 'mb-1'),
    });

    const senderBadge = this.createSenderBadge(bookmark.sender, 'px-1.5 py-0.5 shrink-0');

    // Preview text
    const preview = this.extractPreviewText(bookmark, 100);

    const previewText = DOMUtils.createElement('span', {
      className: 'text-sm text-text-100 truncate flex-1',
      textContent: preview || 'No preview',
    });

    topRow.appendChild(senderBadge);
    topRow.appendChild(previewText);

    // Bottom row: Category + Date
    const bottomRow = DOMUtils.createElement('div', {
      className: this.getComponentClass('listMetaRow'),
    });

    const categoryBadge = this.createCategoryBadge(category, 'px-1.5 py-0.5 text-[10px]');

    const dateStr = this.getBookmarkDate(bookmark);
    const dateSpan = DOMUtils.createElement('span', {
      textContent: dateStr,
    });

    bottomRow.appendChild(categoryBadge);
    bottomRow.appendChild(dateSpan);

    item.appendChild(topRow);
    item.appendChild(bottomRow);

    return item;
  }

  selectBookmark(bookmark, { method = 'list_click', track = true } = {}) {
    this.state.selectedBookmarkId = bookmark.id;
    this.renderMasterList();
    this.renderDetailPanel(bookmark);
    if (track) {
      trackEvent('bookmark_manager_list_select', {
        module: 'bookmarks',
        method,
        view_mode: 'list',
      });
    }
  }

  renderMasterList() {
    const container = this.activeModal.element.querySelector('#bm-master-list');
    if (!container) {
      return;
    }

    DOMUtils.clearElement(container);

    const filtered = this.getFilteredBookmarks();

    if (filtered.length === 0) {
      container.appendChild(
        this.createEmptyState('🔖', 'No bookmarks found', '', 'min-h-[200px] h-full text-sm')
      );
      return;
    }

    filtered.forEach(b => {
      const isSelected = this.state.selectedBookmarkId === b.id;
      container.appendChild(this.createBookmarkListItem(b, isSelected));
    });
  }

  renderDetailPanel(bookmark) {
    const emptyState = this.activeModal.element.querySelector('#bm-detail-empty');
    const content = this.activeModal.element.querySelector('#bm-detail-content');
    const header = this.activeModal.element.querySelector('#bm-detail-header');
    const body = this.activeModal.element.querySelector('#bm-detail-body');
    const gotoBtn = this.activeModal.element.querySelector('#bm-detail-goto-btn');

    if (!content || !header || !body) {
      return;
    }

    // Hide empty state, show content
    this.setDisplay(emptyState, false);
    this.setDisplay(content, true, 'flex');

    // Update goto button
    if (gotoBtn) {
      gotoBtn.onclick = () => this.navigateToBookmark(bookmark, 'detail_button');
    }

    // Build header
    const category = this.getBookmarkCategory(bookmark);
    const dateStr = this.getBookmarkDate(bookmark);

    DOMUtils.clearElement(header);

    const headerLeft = DOMUtils.createElement('div', {
      className: this.getComponentClass('rowGap3'),
    });
    headerLeft.appendChild(this.createSenderBadge(bookmark.sender, 'px-2 py-1 text-xs'));
    headerLeft.appendChild(this.createCategoryBadge(category, 'px-2 py-1 text-xs'));

    const headerRight = DOMUtils.createElement('div', {
      className: this.getComponentClass('rowGap3'),
    });
    headerRight.appendChild(
      DOMUtils.createElement('span', {
        className: this.getComponentClass('dateLabel'),
        textContent: dateStr,
      })
    );

    const deleteBtn = DOMUtils.createElement('button', {
      className: this.getActionButtonClass('ghostDanger'),
      title: 'Delete',
      id: 'bm-detail-delete-btn',
    });
    deleteBtn.appendChild(this.createMarkupNode(IconLibrary.trash('currentColor', 16)));
    headerRight.appendChild(deleteBtn);

    header.appendChild(headerLeft);
    header.appendChild(headerRight);

    // Attach delete handler
    if (deleteBtn) {
      deleteBtn.onclick = () => this.deleteBookmark(bookmark.id, 'detail_header');
    }

    // Build body content
    DOMUtils.clearElement(body);
    body.appendChild(this.createBookmarkContentNode(bookmark));
  }

  getFilteredBookmarks() {
    const filtered = this.state.bookmarks.filter(b => {
      if (this.state.activeCategory !== 'all' && b.categoryId !== this.state.activeCategory) {
        return false;
      }

      if (this.state.activeSenderFilter !== 'all') {
        const sender = b.sender || 'assistant';
        if (sender !== this.state.activeSenderFilter) {
          return false;
        }
      }

      if (this.state.searchQuery) {
        const q = this.state.searchQuery;
        const content = b.fullText || '';
        const preview = b.previewText || '';
        return content.toLowerCase().includes(q) || preview.toLowerCase().includes(q);
      }
      return true;
    });

    filtered.sort(
      (a, b) =>
        new Date(b.createdAt || b.timestamp).getTime() -
        new Date(a.createdAt || a.timestamp).getTime()
    );

    return filtered;
  }

  setViewMode(mode) {
    const prevMode = this.state.viewMode;
    if (prevMode === mode) {
      return;
    }
    this.state.viewMode = mode;

    const gridContainer = this.activeModal.element.querySelector('#bm-grid-container');
    const fullViewContainer = this.activeModal.element.querySelector('#bm-full-view-container');
    const listViewContainer = this.activeModal.element.querySelector('#bm-list-view-container');

    // Hide all containers
    this.setDisplay(gridContainer, false);
    this.setDisplay(fullViewContainer, false);
    this.setDisplay(listViewContainer, false);

    // Show the appropriate container
    if (mode === 'grid') {
      this.setDisplay(gridContainer, true, 'flex');
    } else if (mode === 'list') {
      this.setDisplay(listViewContainer, true, 'flex');
      this.renderMasterList();

      // Auto-select first bookmark if none selected
      const filtered = this.getFilteredBookmarks();
      if (filtered.length > 0 && !this.state.selectedBookmarkId) {
        this.selectBookmark(filtered[0], { method: 'auto', track: false });
      } else if (this.state.selectedBookmarkId) {
        const selected = filtered.find(b => b.id === this.state.selectedBookmarkId);
        if (selected) {
          this.renderDetailPanel(selected);
        }
      }
    }

    // Update toggle button states
    this.updateViewToggle();

    const filteredCount = this.getFilteredBookmarks().length;
    trackEvent('bookmark_manager_view_change', {
      module: 'bookmarks',
      method: 'toggle',
      view_mode: mode,
      count: filteredCount,
    });
  }

  // --- Actions ---

  async deleteBookmark(id, method = 'unknown') {
    if (!confirm('Delete this bookmark?')) {
      return;
    }
    trackEvent('bookmark_manager_bookmark_delete', {
      module: 'bookmarks',
      method,
      view_mode: this.state.viewMode,
    });
    await bookmarkStore.remove(id);
    await this.refreshData();
  }

  async deleteCategory(category) {
    const count = this.state.bookmarks.filter(b => b.categoryId === category.id).length;
    if (
      !confirm(`Delete category "${category.name}"?\n${count} bookmarks will be moved to General.`)
    ) {
      return;
    }

    trackEvent('bookmark_manager_category_delete', {
      module: 'bookmarks',
      category_id: category.id,
      count,
    });

    await bookmarkStore.removeCategory(category.id);
    if (this.state.activeCategory === category.id) {
      this.state.activeCategory = 'all';
    }

    await this.refreshData();
  }

  navigateToBookmark(bookmark, method = 'unknown') {
    trackEvent('bookmark_manager_bookmark_navigate', {
      module: 'bookmarks',
      method,
      view_mode: this.state.viewMode,
      result: 'requested',
    });
    this.close('navigate');
    if (bookmark.conversationUrl) {
      const baseUrl = 'https://claude.ai';
      const path = bookmark.conversationUrl.startsWith('/')
        ? bookmark.conversationUrl
        : '/' + bookmark.conversationUrl;

      const currentPath = window.location.pathname;
      if (currentPath === path || currentPath === bookmark.conversationUrl) {
        const url = new URL(window.location.href);
        url.searchParams.set('bookmark', bookmark.id);
        window.history.pushState({}, '', url.toString());
        window.location.reload();
      } else {
        window.open(`${baseUrl}${path}?bookmark=${bookmark.id}`, '_blank', 'noopener');
      }
    }
  }

  // --- Sub-Modals ---

  showCategoryCreationModal() {
    // Create a dialog overlay for adding category
    const overlay = DOMUtils.createElement('div', {
      className:
        'fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/50 backdrop-blur-sm opacity-0 transition-opacity duration-150',
    });

    const dialog = DOMUtils.createElement('div', {
      className:
        'bg-bg-000 p-6 rounded-lg shadow-xl w-[350px] opacity-0 scale-95 transition-all duration-150',
    });

    const title = DOMUtils.createElement('h3', {
      className: 'text-lg font-semibold mb-4',
      textContent: 'New Category',
    });
    const nameField = DOMUtils.createElement('div', { className: 'mb-4' });
    nameField.appendChild(
      DOMUtils.createElement('label', {
        className: 'block text-xs font-medium text-text-300 mb-1',
        textContent: 'Name',
      })
    );
    const input = DOMUtils.createElement('input', {
      id: 'new-cat-name',
      type: 'text',
      className:
        'w-full px-3 py-2 bg-bg-100 border border-border-200 rounded text-sm focus:border-accent-main-100 outline-none',
      placeholder: 'e.g. Ideas',
    });
    nameField.appendChild(input);

    const colorField = DOMUtils.createElement('div', { className: 'mb-6' });
    colorField.appendChild(
      DOMUtils.createElement('label', {
        className: 'block text-xs font-medium text-text-300 mb-1',
        textContent: 'Color',
      })
    );
    const colorInput = DOMUtils.createElement('input', {
      id: 'new-cat-color',
      type: 'color',
      className: 'w-full h-10 p-1 bg-bg-100 border border-border-200 rounded cursor-pointer',
      value: '#667eea',
    });
    colorField.appendChild(colorInput);

    const actions = DOMUtils.createElement('div', {
      className: 'flex justify-end gap-2',
    });
    const cancelBtn = DOMUtils.createElement('button', {
      id: 'btn-cat-cancel',
      className: 'px-3 py-1.5 text-text-300 hover:bg-bg-100 rounded text-sm',
      textContent: 'Cancel',
    });
    const saveBtn = DOMUtils.createElement('button', {
      id: 'btn-cat-save',
      className: 'px-3 py-1.5 bg-accent-main-100 text-white rounded text-sm hover:opacity-90',
      textContent: 'Create',
    });
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);

    dialog.appendChild(title);
    dialog.appendChild(nameField);
    dialog.appendChild(colorField);
    dialog.appendChild(actions);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Trigger transition
    requestAnimationFrame(() => {
      overlay.classList.remove('opacity-0');
      overlay.classList.add('opacity-100');
      dialog.classList.remove('opacity-0', 'scale-95');
      dialog.classList.add('opacity-100', 'scale-100');
    });

    input.focus();

    const close = (reason = 'close') => {
      trackEvent('bookmark_manager_category_create', {
        module: 'bookmarks',
        method: reason,
        result: 'cancel',
      });
      overlay.remove();
    };

    cancelBtn.onclick = () => close('cancel_button');
    saveBtn.onclick = async () => {
      const name = input.value.trim();
      const color = colorInput.value;
      if (name) {
        trackEvent('bookmark_manager_category_create', {
          module: 'bookmarks',
          method: 'save',
          result: 'success',
        });
        await bookmarkStore.addCategory(name, color);
        await this.refreshData();
        overlay.remove();
      }
    };

    // Close on click outside
    overlay.onclick = e => {
      if (e.target === overlay) {
        close('backdrop');
      }
    };
  }

  openFullText(bookmark) {
    this.showFullView();

    // Update Go to Button action
    const gotoBtn = this.activeModal.element.querySelector('#bm-full-view-goto-btn');
    if (gotoBtn) {
      gotoBtn.onclick = () => this.navigateToBookmark(bookmark, 'full_view_button');
    }

    const container = this.activeModal.element.querySelector('#bm-full-view-content');
    if (!container) {
      return;
    }

    DOMUtils.clearElement(container);

    container.appendChild(this.createBookmarkContentNode(bookmark, 'full'));
  }
}
