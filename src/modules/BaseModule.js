/**
 * BaseModule - Tüm özellik modülleri için base class
 * Her modül bu class'tan türetilir
 */
import { eventBus, Events } from '../utils/EventBus.js';
import settingsManager from '../utils/SettingsManager.js';
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
    this.elements = {}; // DOM elementleri sakla
    this.unsubscribers = []; // Event listener'ları temizlemek için
    this.settings = {}; // Global settings cache
    this.currentUrl = ''; // Track current URL for SPA navigation detection
    this.urlCheckInterval = null; // URL monitoring interval
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
    if (!this.isEnabled()) {
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
    await settingsManager.load();
    // Tüm settings'i cache'le
    this.settings = await settingsManager.getAll();
  }

  /**
   * Modülün settings'ini getir
   */
  getSettings() {
    return settingsManager.get(this.name) || {};
  }

  /**
   * Belirli bir ayarı getir
   * @param {string} key - Ayar adı
   */
  getSetting(key) {
    return settingsManager.get(`${this.name}.${key}`);
  }

  /**
   * Belirli bir ayarı değiştir
   * @param {string} key - Ayar adı
   * @param {*} value - Yeni değer
   */
  async setSetting(key, value) {
    await settingsManager.set(`${this.name}.${key}`, value);
  }

  /**
   * Modülün aktif olup olmadığını kontrol et
   */
  isEnabled() {
    return this.getSetting('enabled') === true;
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
    const unsub = eventBus.on('settings:changed', async (settings) => {
      // Tüm settings'ı güncelle (general dahil)
      this.settings = settings;
      
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

    this.unsubscribers.push(unsub);
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
    // Tema artık general ayarlarında
    const settings = this.settings || {};
    const general = settings.general || {};
    const themeName = general.colorTheme || 'purple';
    const customColor = general.customColor;
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
   * Wait for an element to appear in DOM using MutationObserver
   * More robust than polling - triggers immediately when element appears
   */
  waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      // Check if element already exists
      const existing = document.querySelector(selector);
      if (existing) {
        resolve(existing);
        return;
      }

      // Set up MutationObserver to watch for element
      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Timeout fallback
      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout waiting for ${selector}`));
      }, timeout);
    });
  }

  /**
   * Helper to ensure a UI element exists (creates if missing)
   * Centralized pattern to avoid duplication across modules
   */
  ensureElement(selector, createFn, retryCount = 0, maxRetries = 10) {
    const existing = document.querySelector(selector);

    // IMPORTANT: Check if element is in DOM AND has valid parent chain
    // During SPA navigation, old elements might still be in body but in stale/hidden DOM
    const isProperlyAttached = existing &&
                               document.body.contains(existing) &&
                               this.isElementVisible(existing);

    if (isProperlyAttached) {
      this.log(`✅ Element ${selector} already exists and is properly attached`);
      return existing;
    }

    if (existing) {
      const inBody = document.body.contains(existing);
      const isVisible = this.isElementVisible(existing);

      this.log(`🔍 Found ${selector}: inBody=${inBody}, isVisible=${isVisible}, offsetParent=${existing.offsetParent ? 'exists' : 'null'}`);

      if (!inBody) {
        this.log(`⚠️ Found ${selector} but it's detached, recreating...`);
      } else if (!isVisible) {
        this.log(`⚠️ Found ${selector} but it's in stale DOM tree, removing and recreating...`);
        existing.remove(); // Remove stale element
      }
    } else {
      this.log(`🔨 Creating ${selector} (attempt ${retryCount + 1}/${maxRetries})...`);
    }

    try {
      const created = createFn();
      if (created && document.body.contains(created)) {
        this.log(`✅ Successfully created ${selector}`);
        return created;
      }
    } catch (e) {
      this.error(`❌ Error creating ${selector}:`, e);
    }

    // Retry if creation failed and we haven't exceeded max retries
    if (retryCount < maxRetries) {
      setTimeout(() => {
        this.ensureElement(selector, createFn, retryCount + 1, maxRetries);
      }, 1000);
    } else {
      this.warn(`❌ Failed to ensure element ${selector} after 10 retries`);
    }

    return null;
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
