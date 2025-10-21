/**
 * BaseModule - Tüm özellik modülleri için base class
 * Her modül bu class'tan türetilir
 */
import { eventBus } from '../utils/EventBus.js';
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
      const moduleSettings = settings[this.name];
      
      if (!moduleSettings) return;

      // Eğer modül disabled olduysa, yok et
      if (!moduleSettings.enabled && this.enabled) {
        this.destroy();
      }
      
      // Eğer modül enabled olduysa ve henüz başlamamışsa, başlat
      if (moduleSettings.enabled && !this.enabled) {
        await this.init();
      }

      // Settings güncellendiğinde modüle bildir
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
    const themeName = this.getSetting('theme') || 'purple';
    const customColor = this.getSetting('customColor');
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
}

export default BaseModule;
