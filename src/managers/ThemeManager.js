/**
 * ThemeManager - Centralized theme and CSS management
 * Handles theme injection and dynamic styling
 */

import themes from '../config/themes.js';

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
    const generalSettings = settings.general || {};
    const colorTheme = generalSettings.colorTheme || 'native';
    const customColor = generalSettings.customColor || '#8B5CF6';
    const opacity = generalSettings.opacity || 0.9;

    this.setTheme(colorTheme, customColor);
    this.setOpacity(opacity);
    this.injectGlobalStyles();
  }

  /**
   * Set the active theme
   */
  setTheme(themeName, customColor) {
    if (themeName === 'custom' && customColor) {
      this.currentTheme = this.createCustomTheme(customColor);
    } else {
      this.currentTheme = themes[themeName] || themes.native;
    }

    this.updateCSSProperties();
    return this.currentTheme;
  }

  /**
   * Create custom theme from color (gradient kaldırıldı - solid color)
   */
  createCustomTheme(color) {
    return {
      name: 'custom',
      primary: color,
      hover: this.lightenColor(color, 10),
      active: this.darkenColor(color, 10)
    };
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
    this.customProperties.set('--claude-productivity-opacity', opacity);
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
    const theme = this.getTheme();

    return `
      /* CSS Custom Properties */
      :root {
        --claude-productivity-primary: ${theme.primary || theme.accentColor || '#CC785C'};
        --claude-productivity-hover: ${theme.hover || theme.primary || '#CC785C'};
        --claude-productivity-active: ${theme.active || theme.primary || '#CC785C'};
        --claude-productivity-opacity: ${this.customProperties.get('--claude-productivity-opacity') || 0.9};

        /* Neutral background (for panels, badges) */
        --claude-productivity-neutral: rgba(0, 0, 0, 0.08);
        /* Accent color (for counters, action buttons) */
        --claude-productivity-accent: ${theme.accentColor || 'hsl(var(--accent-main-000))'};
      }

      /* Dark mode neutral background */
      @media (prefers-color-scheme: dark) {
        :root {
          --claude-productivity-neutral: rgba(255, 255, 255, 0.12);
        }
      }

      /* Base Styles */
      .claude-productivity-panel {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      /* Animations */
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }

      @keyframes slideDown {
        from {
          max-height: 0;
          opacity: 0;
        }
        to {
          max-height: 10000px;
          opacity: 1;
        }
      }

      @keyframes slideUp {
        from {
          max-height: 10000px;
          opacity: 1;
        }
        to {
          max-height: 0;
          opacity: 0;
        }
      }

      @keyframes claude-highlight-pulse {
        0% { background-color: transparent; }
        50% { background-color: var(--claude-productivity-primary); opacity: 0.3; }
        100% { background-color: transparent; }
      }

      /* Highlight Classes */
      .claude-nav-highlight {
        animation: claude-highlight-pulse 1s ease-in-out;
        scroll-margin-top: 100px;
      }

      .claude-edit-highlighted {
        background-color: rgba(255, 235, 59, 0.2) !important;
        border-left: 3px solid #FFC107 !important;
        padding-left: 12px !important;
        transition: all 0.3s ease;
      }

      .claude-bookmark-highlight {
        animation: claude-highlight-pulse 1s ease-in-out;
        scroll-margin-top: 100px;
      }

      /* Button Styles (solid color, no gradient) */
      .claude-productivity-button {
        background: var(--claude-productivity-primary);
        opacity: var(--claude-productivity-opacity);
        transition: all 0.3s ease;
      }

      .claude-productivity-button:hover {
        opacity: 1;
        transform: scale(1.05);
        background: var(--claude-productivity-hover);
      }

      /* Panel Styles */
      .claude-productivity-panel {
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
      }

      .claude-productivity-panel-header {
        background: var(--claude-productivity-primary);
        color: white;
        border-radius: 12px 12px 0 0;
      }

      /* Dark Mode Support */
      @media (prefers-color-scheme: dark) {
        .claude-productivity-panel {
          background: #1a1a1a;
          color: #e0e0e0;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .claude-productivity-panel-header {
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
      }

      /* Utility Classes */
      .claude-productivity-hidden {
        display: none !important;
      }

      .claude-productivity-invisible {
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }

      .claude-productivity-fade-in {
        animation: fadeIn 0.3s ease-in;
      }

      .claude-productivity-fade-out {
        animation: fadeOut 0.3s ease-out;
      }

      /* Scrollbar Styles */
      .claude-productivity-panel ::-webkit-scrollbar {
        width: 8px;
      }

      .claude-productivity-panel ::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.05);
        border-radius: 4px;
      }

      .claude-productivity-panel ::-webkit-scrollbar-thumb {
        background: var(--claude-productivity-primary);
        opacity: 0.5;
        border-radius: 4px;
      }

      .claude-productivity-panel ::-webkit-scrollbar-thumb:hover {
        opacity: 0.8;
      }
    `;
  }

  /**
   * Update CSS custom properties (gradient kaldırıldı)
   */
  updateCSSProperties() {
    if (!this.styleElement) {
      return;
    }

    const theme = this.getTheme();

    // Update CSS variables
    const root = document.documentElement;
    root.style.setProperty('--claude-productivity-primary', theme.primary || theme.accentColor || '#CC785C');
    root.style.setProperty('--claude-productivity-hover', theme.hover || theme.primary || '#CC785C');
    root.style.setProperty('--claude-productivity-active', theme.active || theme.primary || '#CC785C');

    // Update opacity if set
    const opacity = this.customProperties.get('--claude-productivity-opacity');
    if (opacity !== undefined) {
      root.style.setProperty('--claude-productivity-opacity', opacity);
    }
  }

  /**
   * Lighten a color
   */
  lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;

    return '#' + (0x1000000 + (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)).toString(16).slice(1);
  }

  /**
   * Darken a color
   */
  darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = (num >> 8 & 0x00FF) - amt;
    const B = (num & 0x0000FF) - amt;

    return '#' + (0x1000000 + (R > 0 ? R : 0) * 0x10000 +
      (G > 0 ? G : 0) * 0x100 +
      (B > 0 ? B : 0)).toString(16).slice(1);
  }

  /**
   * Apply theme to element (solid color, no gradient)
   */
  applyToElement(element, properties = {}) {
    if (!element) return;

    const theme = this.getTheme();

    // Apply theme-based styles
    if (properties.background) {
      element.style.background = theme.primary || theme.accentColor || '#CC785C';
    }

    if (properties.color) {
      element.style.color = theme.primary || theme.accentColor || '#CC785C';
    }

    if (properties.borderColor) {
      element.style.borderColor = theme.primary || theme.accentColor || '#CC785C';
    }

    // Apply opacity if specified
    if (properties.opacity) {
      const opacity = this.customProperties.get('--claude-productivity-opacity') || 0.9;
      element.style.opacity = opacity;
    }
  }

  /**
   * Get CSS value for property
   */
  getCSSValue(property) {
    const root = document.documentElement;
    return getComputedStyle(root).getPropertyValue(`--claude-productivity-${property}`);
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