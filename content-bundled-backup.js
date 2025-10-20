/**
 * Claude Productivity Extension - Bundled Version
 * All modules combined in a single file for Chrome Extension compatibility
 */

// ============================================================================
// EventBus
// ============================================================================
class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`EventBus error on event "${event}":`, error);
      }
    });
  }

  once(event, callback) {
    const wrappedCallback = (data) => {
      callback(data);
      this.off(event, wrappedCallback);
    };
    this.on(event, wrappedCallback);
  }

  clear() {
    this.listeners.clear();
  }
}

const eventBus = new EventBus();

const Events = {
  MESSAGES_UPDATED: 'messages:updated',
  MESSAGE_CLICKED: 'message:clicked',
  MESSAGE_SCROLLED: 'message:scrolled',
  SETTINGS_CHANGED: 'settings:changed',
  FEATURE_TOGGLED: 'feature:toggled',
  NAVIGATION_PREV: 'navigation:prev',
  NAVIGATION_NEXT: 'navigation:next',
  NAVIGATION_TOP: 'navigation:top',
  UI_READY: 'ui:ready',
  DOM_CHANGED: 'dom:changed',
};

// ============================================================================
// SettingsManager
// ============================================================================
class SettingsManager {
  constructor() {
    this.settings = null;
    this.defaults = {
      navigation: {
        enabled: true,
        position: 'right',
        showCounter: true,
        smoothScroll: true,
        highlightDuration: 2000,
        keyboardShortcuts: true,
      },
      toc: {
        enabled: false,
        position: 'right',
        autoCollapse: false,
        showOnHover: false,
      },
      editHistory: {
        enabled: false,
        showBadges: true,
        highlightEdited: true,
      },
      export: {
        enabled: false,
        defaultFormat: 'markdown',
        includeTimestamps: true,
      },
      search: {
        enabled: false,
        caseSensitive: false,
        regexSupport: false,
      },
      general: {
        theme: 'auto',
        opacity: 0.7,
        showNotifications: true,
      }
    };
  }

  async load() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['settings'], (result) => {
        this.settings = result.settings || this.defaults;
        this.settings = this.mergeWithDefaults(this.settings);
        console.log('⚙️ Settings yüklendi:', this.settings);
        resolve(this.settings);
      });
    });
  }

  async save() {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ settings: this.settings }, () => {
        console.log('💾 Settings kaydedildi');
        eventBus.emit(Events.SETTINGS_CHANGED, this.settings);
        resolve();
      });
    });
  }

  get(path) {
    const keys = path.split('.');
    let value = this.settings;
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    return value;
  }

  async set(path, value) {
    const keys = path.split('.');
    let current = this.settings;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key];
    }
    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;
    await this.save();
  }

  async toggleFeature(feature) {
    const currentValue = this.get(`${feature}.enabled`);
    await this.set(`${feature}.enabled`, !currentValue);
    eventBus.emit(Events.FEATURE_TOGGLED, { feature, enabled: !currentValue });
  }

  async reset() {
    this.settings = JSON.parse(JSON.stringify(this.defaults));
    await this.save();
  }

  mergeWithDefaults(settings) {
    const merged = JSON.parse(JSON.stringify(this.defaults));
    const merge = (target, source) => {
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key]) target[key] = {};
          merge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    };
    merge(merged, settings);
    return merged;
  }
}

const settingsManager = new SettingsManager();

// ============================================================================
// DOMUtils
// ============================================================================
const DOMUtils = {
  findMessages() {
    const selectors = [
      '[data-test-render-count]',
      '.font-claude-message',
      '[class*="Message"]',
      '[role="article"]',
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return Array.from(elements);
      }
    }

    const chatContainer = this.getChatContainer();
    if (chatContainer) {
      const allDivs = chatContainer.querySelectorAll('div');
      return Array.from(allDivs).filter(div => {
        return div.offsetHeight > 100 && div.textContent.trim().length > 50;
      });
    }

    return [];
  },

  getChatContainer() {
    return document.querySelector('main') || 
           document.querySelector('[role="main"]') ||
           document.body;
  },

  scrollToElement(element, block = 'center') {
    if (!element) return;
    element.scrollIntoView({
      behavior: 'smooth',
      block: block,
      inline: 'nearest'
    });
  },

  getCurrentVisibleMessageIndex() {
    const messages = this.findMessages();
    const scrollPosition = window.scrollY + window.innerHeight / 2;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const rect = msg.getBoundingClientRect();
      const elementTop = rect.top + window.scrollY;
      const elementBottom = elementTop + rect.height;

      if (scrollPosition >= elementTop && scrollPosition <= elementBottom) {
        return i;
      }
    }

    let closest = 0;
    let minDistance = Infinity;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const rect = msg.getBoundingClientRect();
      const elementTop = rect.top + window.scrollY;
      const distance = Math.abs(scrollPosition - elementTop);

      if (distance < minDistance) {
        minDistance = distance;
        closest = i;
      }
    }

    return closest;
  },

  observeDOM(callback, target = null) {
    const targetNode = target || this.getChatContainer();
    const config = {
      childList: true,
      subtree: true,
      attributes: false,
    };

    const observer = new MutationObserver((mutations) => {
      callback(mutations);
    });

    observer.observe(targetNode, config);
    return observer;
  },

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  flashClass(element, className, duration = 2000) {
    if (!element) return;
    element.classList.add(className);
    setTimeout(() => {
      element.classList.remove(className);
    }, duration);
  },

  createElement(tag, attrs = {}, content = '') {
    const element = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (key.startsWith('data-')) {
        element.setAttribute(key, value);
      } else {
        element[key] = value;
      }
    });

    if (content) {
      element.innerHTML = content;
    }

    return element;
  },
};

// ============================================================================
// BaseModule
// ============================================================================
class BaseModule {
  constructor(name, options = {}) {
    this.name = name;
    this.options = options;
    this.enabled = false;
    this.initialized = false;
    this.elements = {};
    this.unsubscribers = [];
  }

  async init() {
    if (this.initialized) {
      console.warn(`⚠️ ${this.name} modülü zaten başlatılmış`);
      return;
    }

    console.log(`🔧 ${this.name} modülü başlatılıyor...`);
    await this.loadSettings();

    if (!this.isEnabled()) {
      console.log(`⏸️ ${this.name} modülü devre dışı`);
      return;
    }

    this.initialized = true;
    this.enabled = true;
    this.subscribeToSettings();
  }

  destroy() {
    console.log(`🗑️ ${this.name} modülü durduruluyor...`);
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    Object.values(this.elements).forEach(element => {
      if (element && element.remove) {
        element.remove();
      }
    });
    this.elements = {};
    this.enabled = false;
    this.initialized = false;
  }

  async restart() {
    this.destroy();
    await this.init();
  }

  async loadSettings() {
    await settingsManager.load();
  }

  getSettings() {
    return settingsManager.get(this.name) || {};
  }

  getSetting(key) {
    return settingsManager.get(`${this.name}.${key}`);
  }

  async setSetting(key, value) {
    await settingsManager.set(`${this.name}.${key}`, value);
  }

  isEnabled() {
    return this.getSetting('enabled') === true;
  }

  async toggle() {
    const currentState = this.isEnabled();
    await this.setSetting('enabled', !currentState);
    if (!currentState) {
      await this.init();
    } else {
      this.destroy();
    }
    return !currentState;
  }

  subscribeToSettings() {
    const unsub = eventBus.on('settings:changed', async (settings) => {
      const moduleSettings = settings[this.name];
      if (!moduleSettings) return;
      if (!moduleSettings.enabled && this.enabled) {
        this.destroy();
      }
      if (moduleSettings.enabled && !this.enabled) {
        await this.init();
      }
      this.onSettingsChanged(moduleSettings);
    });
    this.unsubscribers.push(unsub);
  }

  onSettingsChanged(settings) {
    // Override edilebilir
  }

  subscribe(event, callback) {
    const unsub = eventBus.on(event, callback);
    this.unsubscribers.push(unsub);
    return unsub;
  }

  emit(event, data) {
    eventBus.emit(event, data);
  }

  get dom() {
    return DOMUtils;
  }

  log(...args) {
    console.log(`[${this.name}]`, ...args);
  }

  warn(...args) {
    console.warn(`[${this.name}]`, ...args);
  }

  error(...args) {
    console.error(`[${this.name}]`, ...args);
  }
}

// ============================================================================
// NavigationModule
// ============================================================================
class NavigationModule extends BaseModule {
  constructor() {
    super('navigation');
    this.messages = [];
    this.currentIndex = -1;
    this.observerTimeout = null;
    this.scrollTimeout = null;
  }

  async init() {
    await super.init();
    if (!this.enabled) return;

    this.log('Navigation başlatılıyor...');
    this.createUI();
    this.findMessages();
    this.observeMessages();

    if (this.getSetting('keyboardShortcuts')) {
      this.setupKeyboardShortcuts();
    }

    this.setupScrollListener();
    this.log(`✅ ${this.messages.length} mesaj bulundu`);
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    super.destroy();
  }

  createUI() {
    const position = this.getSetting('position') || 'right';
    const showCounter = this.getSetting('showCounter');

    const container = this.dom.createElement('div', {
      id: 'claude-nav-buttons',
      className: 'claude-nav-buttons',
      style: {
        position: 'fixed',
        [position]: '30px',
        bottom: '100px',
        zIndex: '9999',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        opacity: this.getSetting('opacity') || 0.7,
        transition: 'opacity 0.2s ease',
      }
    });

    const topBtn = this.createButton('⇈', 'En üste git (Alt+Home)', () => this.navigateToTop());
    topBtn.id = 'claude-nav-top';

    const prevBtn = this.createButton('↑', 'Önceki mesaj (Alt+↑)', () => this.navigatePrevious());
    prevBtn.id = 'claude-nav-prev';

    const nextBtn = this.createButton('↓', 'Sonraki mesaj (Alt+↓)', () => this.navigateNext());
    nextBtn.id = 'claude-nav-next';

    if (showCounter) {
      const counter = this.dom.createElement('div', {
        id: 'claude-nav-counter',
        className: 'claude-nav-counter',
        textContent: '0/0',
        style: {
          position: 'absolute',
          top: '-8px',
          right: '-8px',
          background: '#ff4757',
          color: 'white',
          borderRadius: '12px',
          padding: '2px 6px',
          fontSize: '10px',
          fontWeight: 'bold',
          minWidth: '20px',
          textAlign: 'center',
        }
      });
      prevBtn.appendChild(counter);
    }

    container.appendChild(topBtn);
    container.appendChild(prevBtn);
    container.appendChild(nextBtn);

    container.addEventListener('mouseenter', () => {
      container.style.opacity = '1';
    });
    container.addEventListener('mouseleave', () => {
      container.style.opacity = this.getSetting('opacity') || 0.7;
    });

    document.body.appendChild(container);
    this.elements.container = container;
    this.elements.topBtn = topBtn;
    this.elements.prevBtn = prevBtn;
    this.elements.nextBtn = nextBtn;
  }

  createButton(icon, tooltip, onClick) {
    const btn = this.dom.createElement('button', {
      className: 'claude-nav-btn',
      innerHTML: icon,
      'data-tooltip': tooltip,
      style: {
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        transition: 'all 0.2s ease',
        color: 'white',
        fontSize: '20px',
        fontWeight: 'bold',
        position: 'relative',
      }
    });

    btn.addEventListener('click', onClick);

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.1)';
      btn.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.25)';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    });

    btn.addEventListener('mousedown', () => {
      btn.style.transform = 'scale(0.95)';
    });

    btn.addEventListener('mouseup', () => {
      btn.style.transform = 'scale(1.1)';
    });

    return btn;
  }

  findMessages() {
    this.messages = this.dom.findMessages();
    this.updateCounter();
    this.emit(Events.MESSAGES_UPDATED, this.messages);
  }

  observeMessages() {
    this.observer = this.dom.observeDOM(() => {
      clearTimeout(this.observerTimeout);
      this.observerTimeout = setTimeout(() => {
        const oldLength = this.messages.length;
        this.findMessages();
        if (this.messages.length !== oldLength) {
          this.log(`Mesaj sayısı güncellendi: ${oldLength} → ${this.messages.length}`);
        }
      }, 500);
    });
  }

  navigatePrevious() {
    if (this.messages.length === 0) return;
    this.currentIndex = this.dom.getCurrentVisibleMessageIndex();
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.scrollToMessage(this.currentIndex);
      this.emit(Events.NAVIGATION_PREV, this.currentIndex);
    }
  }

  navigateNext() {
    if (this.messages.length === 0) return;
    this.currentIndex = this.dom.getCurrentVisibleMessageIndex();
    if (this.currentIndex < this.messages.length - 1) {
      this.currentIndex++;
      this.scrollToMessage(this.currentIndex);
      this.emit(Events.NAVIGATION_NEXT, this.currentIndex);
    }
  }

  navigateToTop() {
    if (this.messages.length === 0) return;
    this.currentIndex = 0;
    this.scrollToMessage(0);
    this.emit(Events.NAVIGATION_TOP, 0);
  }

  scrollToMessage(index) {
    if (index < 0 || index >= this.messages.length) return;

    const message = this.messages[index];
    const smoothScroll = this.getSetting('smoothScroll');
    
    if (smoothScroll) {
      this.dom.scrollToElement(message, 'center');
    } else {
      message.scrollIntoView({ block: 'center' });
    }

    const duration = this.getSetting('highlightDuration') || 2000;
    this.dom.flashClass(message, 'claude-nav-highlight', duration);
    
    this.updateCounter();
    this.emit(Events.MESSAGE_SCROLLED, { index, message });

    this.log(`Mesaj ${index + 1}/${this.messages.length} gösteriliyor`);
  }

  updateCounter() {
    const counter = document.getElementById('claude-nav-counter');
    if (!counter) return;

    if (this.messages.length > 0) {
      const current = this.dom.getCurrentVisibleMessageIndex() + 1;
      counter.textContent = `${current}/${this.messages.length}`;
    } else {
      counter.textContent = '0/0';
    }

    this.updateButtonStates();
  }

  updateButtonStates() {
    const { prevBtn, nextBtn, topBtn } = this.elements;
    if (!prevBtn || !nextBtn || !topBtn) return;

    const currentIdx = this.dom.getCurrentVisibleMessageIndex();
    
    prevBtn.disabled = currentIdx === 0 || this.messages.length === 0;
    nextBtn.disabled = currentIdx === this.messages.length - 1 || this.messages.length === 0;
    topBtn.disabled = this.messages.length === 0;

    [prevBtn, nextBtn, topBtn].forEach(btn => {
      if (btn.disabled) {
        btn.style.opacity = '0.3';
        btn.style.cursor = 'not-allowed';
      } else {
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
      }
    });
  }

  setupKeyboardShortcuts() {
    const handleKeydown = (e) => {
      if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigatePrevious();
      }
      if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateNext();
      }
      if (e.altKey && e.key === 'Home') {
        e.preventDefault();
        this.navigateToTop();
      }
    };

    document.addEventListener('keydown', handleKeydown);
    this.keydownHandler = handleKeydown;
    this.unsubscribers.push(() => {
      document.removeEventListener('keydown', handleKeydown);
    });

    this.log('Klavye kısayolları aktif');
  }

  setupScrollListener() {
    const handleScroll = this.dom.throttle(() => {
      this.updateCounter();
    }, 100);

    window.addEventListener('scroll', handleScroll);
    this.unsubscribers.push(() => {
      window.removeEventListener('scroll', handleScroll);
    });
  }

  onSettingsChanged(settings) {
    this.log('Settings güncellendi:', settings);

    if (this.elements.container) {
      const position = settings.position || 'right';
      this.elements.container.style.left = position === 'left' ? '30px' : 'auto';
      this.elements.container.style.right = position === 'right' ? '30px' : 'auto';
    }

    if (this.elements.container && settings.opacity !== undefined) {
      this.elements.container.style.opacity = settings.opacity;
    }

    const counter = document.getElementById('claude-nav-counter');
    if (counter) {
      counter.style.display = settings.showCounter ? 'block' : 'none';
    }

    if (settings.keyboardShortcuts !== this.getSetting('keyboardShortcuts')) {
      if (settings.keyboardShortcuts) {
        this.setupKeyboardShortcuts();
      } else if (this.keydownHandler) {
        document.removeEventListener('keydown', this.keydownHandler);
      }
    }
  }
}

// ============================================================================
// ClaudeProductivityApp
// ============================================================================
class ClaudeProductivityApp {
  constructor() {
    this.modules = new Map();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) {
      console.warn('⚠️ Uygulama zaten başlatılmış');
      return;
    }

    console.log('🚀 Claude Productivity Extension başlatılıyor...');

    await settingsManager.load();
    this.registerModules();
    await this.initializeModules();
    this.setupGlobalListeners();
    this.injectGlobalStyles();

    this.initialized = true;

    console.log('✅ Claude Productivity Extension hazır!');
    console.log('📦 Aktif modüller:', Array.from(this.modules.keys()));
  }

  registerModules() {
    this.registerModule('navigation', new NavigationModule());
  }

  registerModule(name, module) {
    if (this.modules.has(name)) {
      console.warn(`⚠️ ${name} modülü zaten kayıtlı`);
      return;
    }

    this.modules.set(name, module);
    console.log(`📦 ${name} modülü kaydedildi`);
  }

  async initializeModules() {
    const promises = Array.from(this.modules.values()).map(module => 
      module.init().catch(err => {
        console.error(`❌ ${module.name} modülü başlatılamadı:`, err);
      })
    );

    await Promise.all(promises);
  }

  getModule(name) {
    return this.modules.get(name);
  }

  setupGlobalListeners() {
    window.addEventListener('beforeunload', () => {
      this.destroy();
    });

    eventBus.on(Events.SETTINGS_CHANGED, (settings) => {
      console.log('⚙️ Settings güncellendi:', settings);
    });

    eventBus.on(Events.FEATURE_TOGGLED, ({ feature, enabled }) => {
      console.log(`🔄 ${feature} özelliği ${enabled ? 'açıldı' : 'kapatıldı'}`);
    });
  }

  injectGlobalStyles() {
    const css = `
      .claude-nav-highlight {
        animation: claude-highlight-pulse 0.5s ease-in-out;
        outline: 3px solid #667eea !important;
        outline-offset: 4px;
        border-radius: 8px;
      }
      
      @keyframes claude-highlight-pulse {
        0%, 100% { outline-color: #667eea; }
        50% { outline-color: #764ba2; }
      }

      .claude-nav-btn::after {
        content: attr(data-tooltip);
        position: absolute;
        right: 60px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 12px;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
      }

      .claude-nav-btn:hover::after {
        opacity: 1;
      }

      .claude-nav-btn:disabled {
        opacity: 0.3 !important;
        cursor: not-allowed !important;
        transform: none !important;
      }

      .claude-nav-btn:disabled:hover {
        transform: none !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
      }
    `;

    const style = document.createElement('style');
    style.id = 'claude-productivity-global-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  destroy() {
    console.log('🗑️ Claude Productivity Extension durduruluyor...');

    this.modules.forEach(module => {
      module.destroy();
    });

    eventBus.clear();

    const globalStyles = document.getElementById('claude-productivity-global-styles');
    if (globalStyles) {
      globalStyles.remove();
    }

    this.initialized = false;
    console.log('✅ Claude Productivity Extension durduruldu');
  }

  async restart() {
    this.destroy();
    await this.init();
  }

  getDebugInfo() {
    return {
      initialized: this.initialized,
      modules: Array.from(this.modules.keys()),
      activeModules: Array.from(this.modules.values())
        .filter(m => m.enabled)
        .map(m => m.name),
      settings: settingsManager.settings,
    };
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================
const app = new ClaudeProductivityApp();

// Global scope'a ekle (debugging için)
window.claudeProductivity = app;

// Sayfa yüklendiğinde başlat
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initExtension());
} else {
  initExtension();
}

async function initExtension() {
  try {
    console.log('🎯 Claude Productivity Extension yükleniyor...');
    
    // URL kontrolü
    if (!window.location.hostname.includes('claude.ai')) {
      console.log('⏸️ Claude.ai olmayan bir sitede, extension pasif');
      return;
    }

    // Uygulamayı başlat
    await app.init();
    
    // Debugging bilgisi
    console.log('💡 İpucu: window.claudeProductivity ile extension\'a erişebilirsiniz');
    console.log('💡 Örnek: window.claudeProductivity.getDebugInfo()');
    
  } catch (error) {
    console.error('❌ Claude Productivity Extension başlatılamadı:', error);
  }
}
