/**
 * ClaudeProductivityApp - Ana uygulama yöneticisi
 * Tüm modülleri koordine eder
 */
import settingsManager from './utils/SettingsManager.js';
import { eventBus, Events } from './utils/EventBus.js';
import VisibilityManager from './utils/VisibilityManager.js';
import DOMUtils from './utils/DOMUtils.js';
import NavigationModule from './modules/NavigationModule.js';
import EditHistoryModule from './modules/EditHistoryModule.js';
import CompactViewModule from './modules/CompactViewModule.js';
import BookmarkModule from './modules/BookmarkModule.js';
import EmojiMarkerModule from './modules/EmojiMarkerModule.js';
import SidebarCollapseModule from './modules/SidebarCollapseModule.js';
import ContentFoldingModule from './modules/ContentFoldingModule.js';

class ClaudeProductivityApp {
  constructor() {
    this.modules = new Map();
    this.initialized = false;
    this.visibilityManager = null;
  }

  /**
   * Uygulamayı başlat
   */
  async init() {
    if (this.initialized) {
      console.warn('⚠️ Uygulama zaten başlatılmış');
      return;
    }

    console.log('🚀 Claude Productivity Extension başlatılıyor...');

    // Initialize DOMUtils with VisibilityManager support
    DOMUtils.init();

    // Initialize VisibilityManager (singleton will be created)
    this.visibilityManager = VisibilityManager;

    // Settings'i yükle
    await settingsManager.load();

    // Modülleri kaydet
    this.registerModules();

    // Modülleri başlat
    await this.initializeModules();

    // Global event listener'lar
    this.setupGlobalListeners();

    // Global CSS inject et
    this.injectGlobalStyles();

    this.initialized = true;

    console.log('✅ Claude Productivity Extension hazır!');
    console.log('📦 Aktif modüller:', Array.from(this.modules.keys()));
  }

  /**
   * Modülleri kaydet
   */
  registerModules() {
    // Navigation
    this.registerModule('navigation', new NavigationModule());

    // Edit History
    this.registerModule('editHistory', new EditHistoryModule());

    // Compact View
    this.registerModule('compactView', new CompactViewModule());

    // Bookmarks
    this.registerModule('bookmarks', new BookmarkModule());

    // Emoji Markers
    this.registerModule('emojiMarkers', new EmojiMarkerModule());

    // Sidebar Collapse
    this.registerModule('sidebarCollapse', new SidebarCollapseModule());

    // Content Folding
    this.registerModule('contentFolding', new ContentFoldingModule());
  }

  /**
   * Tek bir modül kaydet
   * @param {string} name - Modül adı
   * @param {BaseModule} module - Modül instance
   */
  registerModule(name, module) {
    if (this.modules.has(name)) {
      console.warn(`⚠️ ${name} modülü zaten kayıtlı`);
      return;
    }

    this.modules.set(name, module);
    console.log(`📦 ${name} modülü kaydedildi`);
  }

  /**
   * Tüm modülleri başlat
   */
  async initializeModules() {
    const promises = Array.from(this.modules.values()).map(module => 
      module.init().catch(err => {
        console.error(`❌ ${module.name} modülü başlatılamadı:`, err);
      })
    );

    await Promise.all(promises);
  }

  /**
   * Belirli bir modülü getir
   * @param {string} name - Modül adı
   * @returns {BaseModule|undefined}
   */
  getModule(name) {
    return this.modules.get(name);
  }

  /**
   * Global event listener'lar
   */
  setupGlobalListeners() {
    console.log('🔧 Setting up global listeners...');

    // Sayfa yeniden yüklendiğinde
    window.addEventListener('beforeunload', () => {
      this.destroy();
    });

    // Settings değişikliklerini logla
    eventBus.on(Events.SETTINGS_CHANGED, async (settings) => {
      console.log('⚙️ Settings güncellendi:', settings);

      // Eğer tema değiştiyse, CSS'i yeniden inject et
      if (settings.general) {
        await this.reinjectStyles();
      }
    });

    // Feature toggle'ları logla
    eventBus.on(Events.FEATURE_TOGGLED, ({ feature, enabled }) => {
      console.log(`🔄 ${feature} özelliği ${enabled ? 'açıldı' : 'kapatıldı'}`);
    });
  }

  /**
   * Setup SPA navigation detection (CENTRALIZED)
   * SIMPLE APPROACH: Restart entire app on navigation (like page refresh)
   */
  setupSPANavigationDetection() {
    this.currentUrl = window.location.href;
    this.isNavigating = false;

    console.log('🔗 Setting up SPA navigation detection...');
    console.log('📍 Current URL:', this.currentUrl);

    const handleNavigation = () => {
      const newUrl = window.location.href;
      console.log('🔍 Navigation check:', { current: this.currentUrl, new: newUrl, isNavigating: this.isNavigating });

      if (newUrl !== this.currentUrl && !this.isNavigating) {
        this.isNavigating = true;
        console.log(`🔄 SPA navigation detected: ${this.currentUrl} → ${newUrl}`);
        console.log('🔄 Restarting app (simulating page refresh)...');
        this.currentUrl = newUrl;

        // Wait a bit for DOM to settle, then restart everything (like refresh)
        setTimeout(async () => {
          console.log('⏰ Executing restart now...');
          await this.restart();
          console.log('✅ App restarted after navigation');
          this.isNavigating = false;
        }, 1000);
      }
    };

    // Listen to navigation events
    window.addEventListener('popstate', (e) => {
      console.log('🔙 popstate event triggered', e);
      handleNavigation();
    });

    // Intercept pushState/replaceState (this is the key!)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      console.log('🔀 pushState intercepted', args);
      originalPushState.apply(this, args);
      handleNavigation();
    };

    history.replaceState = function(...args) {
      console.log('🔀 replaceState intercepted', args);
      originalReplaceState.apply(this, args);
      handleNavigation();
    };

    console.log('✅ SPA navigation detection active');
    console.log('✅ History API intercepted');
  }

  /**
   * Wait for page content to stabilize before executing callback
   */
  waitForPageStabilization(callback, retryCount = 0, previousCount = 0, stableCount = 0) {
    const maxRetries = 40; // 20 seconds max
    const retryDelay = 500;
    const requiredStableChecks = 3; // Must be stable for 1.5 seconds

    // Simple message count check
    const messages = document.querySelectorAll('[data-is-streaming="false"]');
    const currentCount = messages.length;

    // Check if message count has stabilized
    if (currentCount > 0 && currentCount === previousCount) {
      const newStableCount = stableCount + 1;

      if (newStableCount >= requiredStableChecks) {
        // Page is stable!
        console.log(`✅ Page stabilized at ${currentCount} messages`);
        callback();
        return;
      } else {
        // Keep checking for stability
        setTimeout(() => {
          this.waitForPageStabilization(callback, retryCount + 1, currentCount, newStableCount);
        }, retryDelay);
      }
    } else if (retryCount < maxRetries) {
      // Message count changed or still at 0, reset stability counter
      setTimeout(() => {
        this.waitForPageStabilization(callback, retryCount + 1, currentCount, 0);
      }, retryDelay);
    } else {
      // Give up after max retries, execute anyway
      console.warn('⚠️ Page stabilization timeout, notifying modules anyway...');
      callback();
    }
  }

  /**
   * Global CSS stilleri inject et
   */
  async injectGlobalStyles() {
    // Tema renklerini al
    const settings = await settingsManager.getAll();
    const general = settings.general || {};
    const themeName = general.colorTheme || 'purple';
    const customColor = general.customColor || '#667eea';
    
    // Tema renklerini hesapla
    let primary, secondary;
    if (themeName === 'native') {
      primary = '#CC785C';
      secondary = '#8B7355';
    } else if (themeName === 'purple') {
      primary = '#667eea';
      secondary = '#764ba2';
    } else if (themeName === 'custom') {
      primary = customColor;
      // Biraz koyulaştır
      const hex = customColor.replace('#', '');
      const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - 30);
      const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - 30);
      const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - 30);
      secondary = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    const css = `
      /* Navigation highlight animasyonu */
      .claude-nav-highlight {
        animation: claude-highlight-pulse 0.5s ease-in-out;
        outline: 3px solid ${primary} !important;
        outline-offset: 4px;
        border-radius: 8px;
      }
      
      @keyframes claude-highlight-pulse {
        0%, 100% { outline-color: ${primary}; }
        50% { outline-color: ${secondary}; }
      }

      /* Edit History highlight */
      .claude-edit-highlighted {
        outline: 2px dashed ${primary} !important;
        outline-offset: 2px;
        border-radius: 8px;
      }

      /* Tooltip stilleri */
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

      /* Disabled button stilleri */
      .claude-nav-btn:disabled {
        opacity: 0.3 !important;
        cursor: not-allowed !important;
        transform: none !important;
      }

      .claude-nav-btn:disabled:hover {
        transform: none !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
      }

      /* Edit History Styles */
      .claude-edit-highlighted {
        position: relative;
      }

      .claude-edit-highlighted::before {
        content: '';
        position: absolute;
        top: -4px;
        left: -4px;
        right: -4px;
        bottom: -4px;
        border: 2px dashed #667eea;
        border-radius: 8px;
        pointer-events: none;
        opacity: 0.4;
      }

      /* Modal Animations */
      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes fadeOut {
        from {
          opacity: 1;
        }
        to {
          opacity: 0;
        }
      }

      @keyframes slideUp {
        from {
          transform: translateY(20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      /* Scrollbar for modal */
      .claude-edit-modal-content::-webkit-scrollbar {
        width: 8px;
      }

      .claude-edit-modal-content::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 4px;
      }

      .claude-edit-modal-content::-webkit-scrollbar-thumb {
        background: #667eea;
        border-radius: 4px;
      }

      .claude-edit-modal-content::-webkit-scrollbar-thumb:hover {
        background: #764ba2;
      }

      /* Future: TOC stilleri */
      .claude-toc {
        /* TODO: Gelecekte eklenecek */
      }
    `;

    const style = document.createElement('style');
    style.id = 'claude-productivity-global-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /**
   * CSS'i yeniden inject et (tema değişikliğinde)
   */
  async reinjectStyles() {
    const oldStyle = document.getElementById('claude-productivity-global-styles');
    if (oldStyle) {
      oldStyle.remove();
    }
    await this.injectGlobalStyles();
    console.log('🎨 Global CSS tema ile güncellendi');
  }

  /**
   * Uygulamayı durdur
   */
  destroy() {
    console.log('🗑️ Claude Productivity Extension durduruluyor...');

    // Tüm modülleri durdur
    this.modules.forEach(module => {
      module.destroy();
    });

    // Clean up VisibilityManager
    if (this.visibilityManager) {
      this.visibilityManager.destroy();
      this.visibilityManager = null;
    }

    // Event bus'ı temizle
    eventBus.clear();

    // Global stilleri kaldır
    const globalStyles = document.getElementById('claude-productivity-global-styles');
    if (globalStyles) {
      globalStyles.remove();
    }

    this.initialized = false;
    console.log('✅ Claude Productivity Extension durduruldu');
  }

  /**
   * Uygulamayı yeniden başlat
   */
  async restart() {
    this.destroy();
    await this.init();
  }

  /**
   * Debug bilgisi
   */
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

// Singleton instance
const app = new ClaudeProductivityApp();

// Global scope'a ekle (debugging için)
window.claudeProductivity = app;

export default app;
