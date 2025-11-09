/**
 * BaseModule - Tüm özellik modülleri için base class
 * Her modül bu class'tan türetilir
 */
import { eventBus, Events } from '../utils/EventBus.js';
import { settingsStore } from '../stores/index.js';
import DOMUtils from '../utils/DOMUtils.js';
import { getThemeColors } from '../config/themes.js';

class BaseModule {
  /**
   * @param {string} name - Modül adı (örn: 'navigation')
   * @param {Object} options - Modül seçenekleri
   */
  constructor(name, options = {}) {
    this.name = name;
    this.options = options;
    this.enabled = false;
    this.initialized = false;
    this.elements = {}; // DOM elements storage
    this.unsubscribers = []; // Event cleanup functions
    // ✅ Settings cache removed! Now using settingsStore directly
  }

  /**
   * Modülü başlat - Alt class'lar override etmeli
   */
  async init() {
    if (this.initialized) {
      console.warn(`⚠️ ${this.name} modülü zaten başlatılmış`);
      return;
    }

    console.log(`🔧 ${this.name} modülü başlatılıyor...`);

    // Settings'i yükle
    await this.loadSettings();

    // Eğer disabled ise başlatma
    const enabled = await this.isEnabled();
    if (!enabled) {
      console.log(`⏸️ ${this.name} modülü devre dışı`);
      return;
    }

    this.initialized = true;
    this.enabled = true;

    // Settings değişikliklerini dinle
    this.subscribeToSettings();

    // Listen to centralized SPA navigation events
    this.subscribeToURLChanges();
  }

  /**
   * Modülü durdur - Alt class'lar override etmeli
   */
  destroy() {
    console.log(`🗑️ ${this.name} modülü durduruluyor...`);

    // Event listener'ları temizle
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    // DOM elementlerini temizle
    Object.values(this.elements).forEach(element => {
      if (element && element.remove) {
        element.remove();
      }
    });
    this.elements = {};

    this.enabled = false;
    this.initialized = false;
  }

  /**
   * Modülü yeniden başlat
   */
  async restart() {
    this.destroy();
    await this.init();
  }

  /**
   * Settings'i yükle
   */
  async loadSettings() {
    await settingsStore.load();
    // No caching! settingsStore handles caching internally
  }

  /**
   * Modülün settings'ini getir
   */
  async getSettings() {
    return await settingsStore.get(this.name) || {};
  }

  /**
   * Belirli bir ayarı getir
   * @param {string} key - Ayar adı
   */
  async getSetting(key) {
    return await settingsStore.get(`${this.name}.${key}`);
  }

  /**
   * Belirli bir ayarı değiştir
   * @param {string} key - Ayar adı
   * @param {*} value - Yeni değer
   */
  async setSetting(key, value) {
    await settingsStore.set(`${this.name}.${key}`, value);
  }

  /**
   * Modülün aktif olup olmadığını kontrol et
   */
  async isEnabled() {
    const enabled = await this.getSetting('enabled');
    return enabled === true;
  }

  /**
   * Modülü aç/kapat
   */
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

  /**
   * Settings değişikliklerini dinle
   */
  subscribeToSettings() {
    // Subscribe to settingsStore changes
    const storeUnsub = settingsStore.subscribe(async (settings) => {
      const moduleSettings = settings[this.name];

      // Eğer sadece general değiştiyse (tema vb.)
      if (!moduleSettings && settings.general) {
        this.onSettingsChanged({});
        return;
      }

      if (!moduleSettings) return;

      // Eğer modül disabled olduysa, yok et
      if (!moduleSettings.enabled && this.enabled) {
        this.destroy();
        return;
      }

      // Eğer modül enabled olduysa ve henüz başlamamışsa, başlat
      if (moduleSettings.enabled && !this.enabled) {
        await this.init();
        return;
      }

      // Settings güncellendiginde modüle bildir
      this.onSettingsChanged(moduleSettings);
    });

    this.unsubscribers.push(storeUnsub);

    // Also listen to EventBus for backward compatibility (App.js emits this)
    const eventUnsub = eventBus.on('settings:changed', async (settings) => {
      // Just call onSettingsChanged, settingsStore subscription handles the rest
      const moduleSettings = settings[this.name];
      if (moduleSettings) {
        this.onSettingsChanged(moduleSettings);
      }
    });

    this.unsubscribers.push(eventUnsub);
  }

  /**
   * Settings değiştiğinde çağrılır - Alt class'lar override edebilir
   * @param {Object} settings - Yeni settings
   */
  onSettingsChanged(settings) {
    // Override edilebilir
  }

  /**
   * Event'e subscribe ol ve unsubscriber'ı sakla
   * @param {string} event - Event adı
   * @param {Function} callback - Callback fonksiyonu
   */
  subscribe(event, callback) {
    const unsub = eventBus.on(event, callback);
    this.unsubscribers.push(unsub);
    return unsub;
  }

  /**
   * Event emit et
   * @param {string} event - Event adı
   * @param {*} data - Event verisi
   */
  emit(event, data) {
    eventBus.emit(event, data);
  }

  /**
   * DOM Utils'e erişim
   */
  get dom() {
    return DOMUtils;
  }

  /**
   * Tema renklerini al
   * @returns {Object} Tema renkleri
   */
  getTheme() {
    // Get theme from settingsStore synchronously (using cache)
    // This is safe because settingsStore caches the data
    let themeName = 'purple';
    let customColor = '#667eea';

    // Try to get from store cache (synchronous access)
    if (settingsStore.store.cache) {
      const general = settingsStore.store.cache.general || {};
      themeName = general.colorTheme || 'purple';
      customColor = general.customColor || '#667eea';
    }

    return getThemeColors(themeName, customColor);
  }

  /**
   * Log helper
   */
  log(...args) {
    console.log(`[${this.name}]`, ...args);
  }

  /**
   * Warning helper
   */
  warn(...args) {
    console.warn(`[${this.name}]`, ...args);
  }

  /**
   * Error helper
   */
  error(...args) {
    console.error(`[${this.name}]`, ...args);
  }

  /**
   * Subscribe to centralized URL change events from App
   */
  subscribeToURLChanges() {
    const unsub = eventBus.on(Events.URL_CHANGED, (newUrl) => {
      this.log(`📩 Received URL_CHANGED event: ${newUrl}`);
      this.onUrlChanged(newUrl);
    });

    this.unsubscribers.push(unsub);
  }

  /**
   * Called when URL changes (SPA navigation) - Alt class'lar override edebilir
   * @param {string} newUrl - New URL
   */
  onUrlChanged(newUrl) {
    // Default behavior: reinitialize UI
    this.log('🔄 Reinitializing due to URL change...');
    this.reinitializeUI();
  }

  /**
   * Reinitialize UI without full restart - Alt class'lar override edebilir
   * This is called automatically on SPA navigation after page stabilizes
   */
  reinitializeUI() {
    // Default behavior - can be overridden by specific modules
    this.log('⚠️ Module should override reinitializeUI() for robust SPA support');
  }


  /**
   * Check if element is visible (has offsetParent or is body/html)
   * Elements in stale DOM trees will have offsetParent = null
   */
  isElementVisible(element) {
    if (!element) return false;

    // offsetParent is null for hidden elements
    // BUT it's also null for body/html and position:fixed elements, so check for those
    if (element.offsetParent !== null) return true;
    if (element === document.body || element === document.documentElement) return true;

    // Check element's own styles
    const elementStyle = window.getComputedStyle(element);
    if (elementStyle.display === 'none' || elementStyle.visibility === 'hidden') {
      return false;
    }

    // position:fixed elements also have null offsetParent but are visible
    if (elementStyle.position === 'fixed') return true;

    // If offsetParent is null and element is not fixed/body/html,
    // check if it's because a parent is hidden
    let parent = element.parentElement;
    while (parent && parent !== document.body) {
      const style = window.getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return false;
      }
      parent = parent.parentElement;
    }

    // If we got here and element has no offsetParent, it's likely detached/stale
    // unless it has position:fixed which we already checked
    return element.offsetParent !== null || elementStyle.position === 'fixed';
  }

  /**
   * Check if specific settings changed
   * @param {Array<string>} keys - Settings keys to check
   * @param {Object} newSettings - New settings object
   * @returns {boolean} True if any of the specified settings changed
   */
  settingsChanged(keys, newSettings) {
    return keys.some(key => {
      const newValue = key.includes('.')
        ? key.split('.').reduce((obj, k) => obj?.[k], newSettings)
        : newSettings[key];
      const oldValue = key.includes('.')
        ? key.split('.').reduce((obj, k) => obj?.[k], this.settings)
        : this.settings[key];
      return newValue !== oldValue;
    });
  }
}

export default BaseModule;
