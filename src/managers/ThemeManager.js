/**
 * ThemeManager - Centralized theme and CSS management
 * Handles theme injection and dynamic styling
 */

import themes from '../config/themes.js';
import {
  DEFAULT_HIGHLIGHT_MARGIN,
  DEFAULT_HIGHLIGHT_PADDING,
  DEFAULT_OPACITY,
  resolveThemeSettings,
} from './theme/themeDefaults.js';
import { createCustomTheme, darkenColor, lightenColor } from './theme/themeColorUtils.js';
import { applyThemeProperties, generateGlobalCss } from './theme/themeCss.js';

class ThemeManager {
  constructor() {
    this.currentTheme = null;
    this.styleElement = null;
    this.customProperties = new Map();
  }

  /**
   * Initialize theme manager with settings
   */
  init(settings = {}) {
    const { colorTheme, customColor, opacity, highlightPadding, highlightMargin } =
      resolveThemeSettings(settings);

    this.setTheme(colorTheme, customColor);
    this.setOpacity(opacity);
    this.setHighlightPadding(highlightPadding);
    this.setHighlightMargin(highlightMargin);
    this.injectGlobalStyles();
  }

  /**
   * Set the active theme
   */
  setTheme(themeName, customColor) {
    if (themeName === 'custom' && customColor) {
      this.currentTheme = createCustomTheme(customColor);
    } else {
      this.currentTheme = themes[themeName] || themes.native;
    }

    this.updateCSSProperties();
    return this.currentTheme;
  }

  /**
   * Create custom theme from color (gradient removed - solid color)
   */
  createCustomTheme(color) {
    return createCustomTheme(color);
  }

  /**
   * Get the current theme
   */
  getTheme() {
    return this.currentTheme || themes.native;
  }

  /**
   * Set global opacity
   */
  setOpacity(opacity) {
    this.customProperties.set('--claude-productivity-opacity', opacity || DEFAULT_OPACITY);
    this.updateCSSProperties();
  }

  /**
   * Set highlight padding
   */
  setHighlightPadding(padding) {
    const {
      top = DEFAULT_HIGHLIGHT_PADDING.top,
      right = DEFAULT_HIGHLIGHT_PADDING.right,
      bottom = DEFAULT_HIGHLIGHT_PADDING.bottom,
      left = DEFAULT_HIGHLIGHT_PADDING.left,
    } = padding;
    this.customProperties.set('--claude-productivity-highlight-padding-top', `${top}px`);
    this.customProperties.set('--claude-productivity-highlight-padding-right', `${right}px`);
    this.customProperties.set('--claude-productivity-highlight-padding-bottom', `${bottom}px`);
    this.customProperties.set('--claude-productivity-highlight-padding-left', `${left}px`);
    this.updateCSSProperties();
  }

  /**
   * Set highlight margin
   */
  setHighlightMargin(margin) {
    const {
      top = DEFAULT_HIGHLIGHT_MARGIN.top,
      right = DEFAULT_HIGHLIGHT_MARGIN.right,
      bottom = DEFAULT_HIGHLIGHT_MARGIN.bottom,
      left = DEFAULT_HIGHLIGHT_MARGIN.left,
    } = margin;
    this.customProperties.set('--claude-productivity-highlight-margin-top', `${top}px`);
    this.customProperties.set('--claude-productivity-highlight-margin-right', `${right}px`);
    this.customProperties.set('--claude-productivity-highlight-margin-bottom', `${bottom}px`);
    this.customProperties.set('--claude-productivity-highlight-margin-left', `${left}px`);
    this.updateCSSProperties();
  }

  /**
   * Inject global CSS styles
   */
  injectGlobalStyles() {
    // Remove existing styles
    if (this.styleElement) {
      this.styleElement.remove();
    }

    // Create new style element
    this.styleElement = document.createElement('style');
    this.styleElement.id = 'claude-productivity-global-styles';
    this.styleElement.textContent = this.generateGlobalCSS();

    document.head.appendChild(this.styleElement);
  }

  /**
   * Generate global CSS content
   */
  generateGlobalCSS() {
    return generateGlobalCss(this.getTheme(), this.customProperties);
  }

  /**
   * Update CSS custom properties (gradient removed)
   */
  updateCSSProperties() {
    if (!this.styleElement) {
      return;
    }

    applyThemeProperties(document.documentElement, this.getTheme(), this.customProperties);
  }

  lightenColor(color, percent) {
    return lightenColor(color, percent);
  }

  darkenColor(color, percent) {
    return darkenColor(color, percent);
  }

  /**
   * Destroy theme manager
   */
  destroy() {
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }

    this.currentTheme = null;
    this.customProperties.clear();
  }
}

// Export singleton instance
export default new ThemeManager();
