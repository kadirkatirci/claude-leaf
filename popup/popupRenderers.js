import { isModuleDevDisabled } from './popupState.js';

export function renderTabs(config) {
  const container = document.getElementById('tabs-nav');
  container.innerHTML = config.tabs
    .filter(tab => tab.id !== 'shortcuts')
    .map(
      (tab, index) => `
    <button class="tab ${index === 0 ? 'active' : ''}" data-tab="${tab.id}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="${tab.icon}"/>
      </svg>
      <span>${tab.label}</span>
    </button>
  `
    )
    .join('');
}

export function getInitialTabId(config) {
  const first = config.tabs.find(tab => tab.id !== 'shortcuts');
  return first ? first.id : 'features';
}

export function renderFeatures({ config, currentSettings, devConfig, onToggle, onSettingsClick }) {
  const container = document.getElementById('feature-list');
  const enabledModules = Object.entries(config.modules).filter(
    ([id]) => !isModuleDevDisabled(devConfig, id)
  );

  container.innerHTML = enabledModules
    .map(
      ([id, module]) => `
    <div class="feature-item" data-module="${id}">
      <div class="feature-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="${module.iconFill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="${module.icon}"/>
        </svg>
      </div>
      <div class="feature-info">
        <span class="feature-name">${module.name}</span>
        <button class="info-btn" data-tooltip="${module.tooltip}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="${config.icons.info}"/>
          </svg>
        </button>
      </div>
      <div class="feature-actions">
        <label class="toggle">
          <input type="checkbox" id="${id}-enabled" ${currentSettings[id]?.enabled ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>
  `
    )
    .join('');

  enabledModules.forEach(([id]) => {
    const toggle = document.getElementById(`${id}-enabled`);
    if (toggle) {
      toggle.addEventListener('change', event => {
        onToggle(id, event.target.checked);
      });
    }
  });

  document.querySelectorAll('.settings-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      onSettingsClick(btn.dataset.module);
    });
  });
}

export function renderShortcuts(config, devConfig) {
  const container = document.getElementById('shortcuts-list');
  if (!container) {
    return;
  }

  const enabledShortcuts = config.shortcuts.filter(
    group => !group.module || !isModuleDevDisabled(devConfig, group.module)
  );

  container.innerHTML = enabledShortcuts
    .map(
      group => `
    <div class="shortcut-group">
      <h3 class="shortcut-group-title">${group.group}</h3>
      ${group.items
        .map(
          item => `
        <div class="shortcut-item">
          <span class="shortcut-keys">
            ${item.keys.map(key => `<kbd>${key}</kbd>`).join(' + ')}
          </span>
          <span class="shortcut-desc">${item.description}</span>
        </div>
      `
        )
        .join('')}
    </div>
  `
    )
    .join('');
}

export function renderDataSection(config) {
  const container = document.getElementById('data-section');
  const { export: exportOpts, clear: clearOpts } = config.dataOptions;

  container.innerHTML = `
    <!-- Export Section -->
    <div class="data-group">
      <h3 class="data-group-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="${config.icons.export}"/>
        </svg>
        Export
      </h3>
      <div class="checkbox-group">
        ${exportOpts
          .map(
            opt => `
          <label class="checkbox-item">
            <input type="checkbox" id="${opt.id}" checked>
            <span>${opt.label}</span>
          </label>
        `
          )
          .join('')}
      </div>
      <button class="btn btn-primary" id="export-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="${config.icons.export}"/>
        </svg>
        Export Selected
      </button>
    </div>
    
    <!-- Import Section -->
    <div class="data-group">
      <h3 class="data-group-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="${config.icons.import}"/>
        </svg>
        Import
      </h3>
      <button class="btn btn-secondary" id="import-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="${config.icons.import}"/>
        </svg>
        Import from File
      </button>
    </div>
    
    <!-- Clear Section -->
    <div class="data-group data-group-danger">
      <h3 class="data-group-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="${config.icons.trash}"/>
        </svg>
        Clear Data
      </h3>
      <div class="checkbox-group">
        ${clearOpts
          .map(
            opt => `
          <label class="checkbox-item">
            <input type="checkbox" id="${opt.id}">
            <span>${opt.label}</span>
          </label>
        `
          )
          .join('')}
      </div>
      <button class="btn btn-danger" id="clear-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="${config.icons.trash}"/>
        </svg>
        Clear Selected
      </button>
    </div>
  `;
}

export function renderHelpSection(trackEvent) {
  const container = document.getElementById('help-section');
  const helpItems = [
    {
      url: 'https://github.com/anthropics/claude-code/issues',
      icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
      title: 'Documentation',
      description: 'Learn how to use Claude Leaf features and keyboard shortcuts.',
      linkText: 'Read the Docs',
    },
    {
      url: 'https://github.com/anthropics/claude-code/issues/new?labels=bug',
      icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 14v-4m0-4h.01',
      title: 'Report an Issue',
      description: 'Found a bug or something not working as expected? Let us know.',
      linkText: 'Report Issue',
    },
    {
      url: 'https://github.com/anthropics/claude-code/issues/new?labels=enhancement',
      icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
      title: 'Request a Feature',
      description: 'Have a great idea? Suggest new features or improvements.',
      linkText: 'Request Feature',
    },
    {
      url: 'https://buymeacoffee.com/tedaitesnim',
      icon: 'M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z M6 1v3 M9 1v3 M12 1v3',
      title: 'Buy Me a Coffee',
      description: 'Support the development of Claude Leaf with a coffee ☕',
      linkText: 'Support via Buy Me a Coffee',
    },
  ];

  container.innerHTML = `
    <div class="help-container">
      ${helpItems
        .map(
          (item, index) => `
        <div class="help-item${index === helpItems.length - 1 ? ' help-item-featured' : ''}" data-url="${item.url}" data-index="${index}">
          <div class="help-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="${item.icon}"/>
            </svg>
          </div>
          <div class="help-content">
            <h3>${item.title}</h3>
            <p>${item.description}</p>
            <a href="javascript:void(0)" class="help-link" onclick="event.stopPropagation()">
              ${item.linkText}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </a>
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  `;

  document.querySelectorAll('.help-item').forEach(item => {
    item.addEventListener('click', () => {
      const url = item.getAttribute('data-url');
      if (url) {
        const index = item.getAttribute('data-index') || 'unknown';
        trackEvent('popup_help_click', {
          module: 'popup',
          link_id: index,
        });
        chrome.tabs.create({ url });
      }
    });
  });
}

export function setupTabListeners(switchToTab) {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchToTab(tab.dataset.tab));
  });
}

export function setupTooltips() {
  const tooltip = document.getElementById('tooltip');

  document.querySelectorAll('.info-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      const text = btn.dataset.tooltip;
      if (!text) {
        return;
      }

      tooltip.textContent = text;
      tooltip.classList.remove('hidden');

      const rect = btn.getBoundingClientRect();
      let left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2;
      const top = rect.bottom + 8;

      if (left < 8) {
        left = 8;
      }
      if (left + tooltip.offsetWidth > window.innerWidth - 8) {
        left = window.innerWidth - tooltip.offsetWidth - 8;
      }

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    });

    btn.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));
  });
}

export function setupActionButtons(handlers) {
  document.getElementById('save-btn')?.addEventListener('click', handlers.onSave);
  document.getElementById('export-btn')?.addEventListener('click', handlers.onExport);
  document.getElementById('import-btn')?.addEventListener('click', handlers.onImport);
  document.getElementById('clear-btn')?.addEventListener('click', handlers.onClear);
}

export function renderFavoriteEmojis({ currentSettings, trackEvent, onFavoritesChanged }) {
  const container = document.getElementById('emojiMarkers-favorites-container');
  if (!container) {
    return;
  }

  const emojis = currentSettings.emojiMarkers?.favoriteEmojis || [];
  container.innerHTML = '';

  emojis.forEach((emoji, index) => {
    const chip = document.createElement('div');
    chip.className = 'emoji-chip';
    chip.draggable = true;
    chip.dataset.index = index;
    chip.innerHTML = `<span>${emoji}</span><button title="Remove">×</button>`;

    chip.querySelector('button').addEventListener('click', event => {
      event.stopPropagation();
      currentSettings.emojiMarkers.favoriteEmojis.splice(index, 1);
      onFavoritesChanged();
      trackEvent('popup_emoji_favorite_remove', {
        module: 'popup',
        count: currentSettings.emojiMarkers.favoriteEmojis.length,
      });
    });

    chip.addEventListener('dragstart', event => {
      event.dataTransfer.setData('text/plain', index);
      chip.classList.add('dragging');
    });
    chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
    chip.addEventListener('dragover', event => event.preventDefault());
    chip.addEventListener('drop', event => {
      event.preventDefault();
      const from = parseInt(event.dataTransfer.getData('text/plain'));
      const to = parseInt(chip.dataset.index);
      if (from !== to) {
        const favorites = currentSettings.emojiMarkers.favoriteEmojis;
        const [item] = favorites.splice(from, 1);
        favorites.splice(to, 0, item);
        onFavoritesChanged();
      }
    });

    container.appendChild(chip);
  });
}

export function showEmojiPicker({
  config,
  currentSettings,
  trackEvent,
  showToast,
  onFavoritesChanged,
}) {
  trackEvent('popup_emoji_picker_open', { module: 'popup' });
  const modal = document.createElement('div');
  modal.className = 'emoji-modal';

  const picker = document.createElement('div');
  picker.className = 'emoji-picker';

  const title = document.createElement('h3');
  title.className = 'emoji-picker-title';
  title.textContent = 'Select Emoji';
  picker.appendChild(title);

  Object.entries(config.emojiCategories).forEach(([name, emojis]) => {
    const section = document.createElement('div');
    section.className = 'emoji-picker-section';

    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'emoji-picker-section-title';
    sectionTitle.textContent = name;
    section.appendChild(sectionTitle);

    const grid = document.createElement('div');
    grid.className = 'emoji-picker-grid';

    emojis.forEach(emoji => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'emoji-picker-button';
      btn.textContent = emoji;
      btn.addEventListener('click', () => {
        if (!currentSettings.emojiMarkers) {
          currentSettings.emojiMarkers = {};
        }
        if (!currentSettings.emojiMarkers.favoriteEmojis) {
          currentSettings.emojiMarkers.favoriteEmojis = [];
        }

        if (currentSettings.emojiMarkers.favoriteEmojis.includes(emoji)) {
          showToast('Already in favorites', 'warning');
          trackEvent('popup_emoji_favorite_add', {
            module: 'popup',
            result: 'duplicate',
            count: currentSettings.emojiMarkers.favoriteEmojis.length,
          });
        } else {
          currentSettings.emojiMarkers.favoriteEmojis.push(emoji);
          onFavoritesChanged();
          showToast(`${emoji} added`, 'success');
          trackEvent('popup_emoji_favorite_add', {
            module: 'popup',
            result: 'success',
            count: currentSettings.emojiMarkers.favoriteEmojis.length,
          });
        }
        modal.remove();
      });
      grid.appendChild(btn);
    });

    section.appendChild(grid);
    picker.appendChild(section);
  });

  modal.appendChild(picker);
  modal.addEventListener('click', event => {
    if (event.target === modal) {
      modal.remove();
    }
  });
  document.body.appendChild(modal);
}

export function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.className = `toast ${type}`;
  setTimeout(() => toast.classList.add('hidden'), 3000);
}
