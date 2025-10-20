/**
 * ClaudeProductivityApp - Ana uygulama yöneticisi
 * Tüm modülleri koordine eder
 */
import settingsManager from './utils/SettingsManager.js';
import { eventBus, Events } from './utils/EventBus.js';
import NavigationModule from './modules/NavigationModule.js';
// Future imports:
// import TOCModule from './modules/TOCModule.js';
// import EditHistoryModule from './modules/EditHistoryModule.js';

class ClaudeProductivityApp {
  constructor() {
    this.modules = new Map();
    this.initialized = false;
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

    // TODO: Gelecekteki modüller
    // this.registerModule('toc', new TOCModule());
    // this.registerModule('editHistory', new EditHistoryModule());
    // this.registerModule('export', new ExportModule());
    // this.registerModule('search', new SearchModule());
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
    // Sayfa yeniden yüklendiğinde
    window.addEventListener('beforeunload', () => {
      this.destroy();
    });

    // Settings değişikliklerini logla
    eventBus.on(Events.SETTINGS_CHANGED, (settings) => {
      console.log('⚙️ Settings güncellendi:', settings);
    });

    // Feature toggle'ları logla
    eventBus.on(Events.FEATURE_TOGGLED, ({ feature, enabled }) => {
      console.log(`🔄 ${feature} özelliği ${enabled ? 'açıldı' : 'kapatıldı'}`);
    });
  }

  /**
   * Global CSS stilleri inject et
   */
  injectGlobalStyles() {
    const css = `
      /* Navigation highlight animasyonu */
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

      /* Future: TOC stilleri */
      .claude-toc {
        /* TODO: Gelecekte eklenecek */
      }

      /* Future: Edit history stilleri */
      .claude-edit-badge {
        /* TODO: Gelecekte eklenecek */
      }
    `;

    const style = document.createElement('style');
    style.id = 'claude-productivity-global-styles';
    style.textContent = css;
    document.head.appendChild(style);
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
