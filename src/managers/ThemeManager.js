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
    const highlightPadding = generalSettings.highlightPadding || {
      top: 0,
      right: 10,
      bottom: 0,
      left: 10,
    };
    const highlightMargin = generalSettings.highlightMargin || {
      top: 5,
      right: 5,
      bottom: 10,
      left: 5,
    };

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
      this.currentTheme = this.createCustomTheme(customColor);
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
    return {
      name: 'custom',
      primary: color,
      hover: this.lightenColor(color, 10),
      active: this.darkenColor(color, 10),
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
   * Set highlight padding
   */
  setHighlightPadding(padding) {
    const { top = 0, right = 10, bottom = 0, left = 10 } = padding;
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
    const { top = 5, right = 5, bottom = 10, left = 5 } = margin;
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
    const theme = this.getTheme();
    const primary = theme.primary || theme.accentColor || '#CC785C';
    const hover = theme.hover || theme.primary || primary;
    const active = theme.active || theme.primary || primary;
    const opacity = this.customProperties.get('--claude-productivity-opacity') || 0.9;
    const highlightPaddingTop =
      this.customProperties.get('--claude-productivity-highlight-padding-top') || '0px';
    const highlightPaddingRight =
      this.customProperties.get('--claude-productivity-highlight-padding-right') || '10px';
    const highlightPaddingBottom =
      this.customProperties.get('--claude-productivity-highlight-padding-bottom') || '0px';
    const highlightPaddingLeft =
      this.customProperties.get('--claude-productivity-highlight-padding-left') || '10px';
    const highlightMarginTop =
      this.customProperties.get('--claude-productivity-highlight-margin-top') || '5px';
    const highlightMarginRight =
      this.customProperties.get('--claude-productivity-highlight-margin-right') || '5px';
    const highlightMarginBottom =
      this.customProperties.get('--claude-productivity-highlight-margin-bottom') || '10px';
    const highlightMarginLeft =
      this.customProperties.get('--claude-productivity-highlight-margin-left') || '5px';

    return `
      :root {
        --claude-productivity-primary: ${primary};
        --claude-productivity-primary-hover: ${hover};
        --claude-productivity-primary-active: ${active};
        --claude-productivity-hover: ${hover};
        --claude-productivity-active: ${active};
        --claude-productivity-opacity: ${opacity};
        --claude-productivity-highlight-padding-top: ${highlightPaddingTop};
        --claude-productivity-highlight-padding-right: ${highlightPaddingRight};
        --claude-productivity-highlight-padding-bottom: ${highlightPaddingBottom};
        --claude-productivity-highlight-padding-left: ${highlightPaddingLeft};
        --claude-productivity-highlight-margin-top: ${highlightMarginTop};
        --claude-productivity-highlight-margin-right: ${highlightMarginRight};
        --claude-productivity-highlight-margin-bottom: ${highlightMarginBottom};
        --claude-productivity-highlight-margin-left: ${highlightMarginLeft};
        --claude-productivity-neutral: rgba(0, 0, 0, 0.08);
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --claude-productivity-neutral: rgba(255, 255, 255, 0.12);
        }
      }

      .claude-productivity-panel {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes claude-highlight-pulse {
        0% { background-color: transparent; }
        50% { background-color: var(--claude-productivity-primary); opacity: 0.3; }
        100% { background-color: transparent; }
      }

      .claude-nav-highlight {
        animation: claude-highlight-pulse 1s ease-in-out;
        scroll-margin-top: 100px;
      }

      .claude-edit-highlighted {
        background-color: transparent !important;
        border: 1px dashed #fe914642 !important;
        padding-top: var(--claude-productivity-highlight-padding-top) !important;
        padding-right: var(--claude-productivity-highlight-padding-right) !important;
        padding-bottom: var(--claude-productivity-highlight-padding-bottom) !important;
        padding-left: var(--claude-productivity-highlight-padding-left) !important;
        margin-top: var(--claude-productivity-highlight-margin-top) !important;
        margin-right: var(--claude-productivity-highlight-margin-right) !important;
        margin-bottom: var(--claude-productivity-highlight-margin-bottom) !important;
        margin-left: var(--claude-productivity-highlight-margin-left) !important;
        border-radius: 6px !important;
        transition: border-color 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease;
      }

      .claude-bookmark-highlight {
        animation: claude-highlight-pulse 1s ease-in-out;
        scroll-margin-top: 100px;
      }

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
   * Update CSS custom properties (gradient removed)
   */
  updateCSSProperties() {
    if (!this.styleElement) {
      return;
    }

    const theme = this.getTheme();

    // Update CSS variables
    const root = document.documentElement;
    root.style.setProperty(
      '--claude-productivity-primary',
      theme.primary || theme.accentColor || '#CC785C'
    );
    root.style.setProperty(
      '--claude-productivity-primary-hover',
      theme.hover || theme.primary || '#CC785C'
    );
    root.style.setProperty(
      '--claude-productivity-primary-active',
      theme.active || theme.primary || '#CC785C'
    );

    // Legacy support
    root.style.setProperty(
      '--claude-productivity-hover',
      theme.hover || theme.primary || '#CC785C'
    );
    root.style.setProperty(
      '--claude-productivity-active',
      theme.active || theme.primary || '#CC785C'
    );

    // Update opacity if set
    const opacity = this.customProperties.get('--claude-productivity-opacity');
    if (opacity !== undefined) {
      root.style.setProperty('--claude-productivity-opacity', opacity);
    }

    // Update highlight padding if set
    const paddingTop = this.customProperties.get('--claude-productivity-highlight-padding-top');
    const paddingRight = this.customProperties.get('--claude-productivity-highlight-padding-right');
    const paddingBottom = this.customProperties.get(
      '--claude-productivity-highlight-padding-bottom'
    );
    const paddingLeft = this.customProperties.get('--claude-productivity-highlight-padding-left');

    if (paddingTop !== undefined) {
      root.style.setProperty('--claude-productivity-highlight-padding-top', paddingTop);
    }
    if (paddingRight !== undefined) {
      root.style.setProperty('--claude-productivity-highlight-padding-right', paddingRight);
    }
    if (paddingBottom !== undefined) {
      root.style.setProperty('--claude-productivity-highlight-padding-bottom', paddingBottom);
    }
    if (paddingLeft !== undefined) {
      root.style.setProperty('--claude-productivity-highlight-padding-left', paddingLeft);
    }

    // Update highlight margin if set
    const marginTop = this.customProperties.get('--claude-productivity-highlight-margin-top');
    const marginRight = this.customProperties.get('--claude-productivity-highlight-margin-right');
    const marginBottom = this.customProperties.get('--claude-productivity-highlight-margin-bottom');
    const marginLeft = this.customProperties.get('--claude-productivity-highlight-margin-left');

    if (marginTop !== undefined) {
      root.style.setProperty('--claude-productivity-highlight-margin-top', marginTop);
    }
    if (marginRight !== undefined) {
      root.style.setProperty('--claude-productivity-highlight-margin-right', marginRight);
    }
    if (marginBottom !== undefined) {
      root.style.setProperty('--claude-productivity-highlight-margin-bottom', marginBottom);
    }
    if (marginLeft !== undefined) {
      root.style.setProperty('--claude-productivity-highlight-margin-left', marginLeft);
    }
  }

  /**
   * Lighten a color
   */
  lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;

    return (
      '#' +
      (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      )
        .toString(16)
        .slice(1)
    );
  }

  /**
   * Darken a color
   */
  darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = ((num >> 8) & 0x00ff) - amt;
    const B = (num & 0x0000ff) - amt;

    return (
      '#' +
      (0x1000000 + (R > 0 ? R : 0) * 0x10000 + (G > 0 ? G : 0) * 0x100 + (B > 0 ? B : 0))
        .toString(16)
        .slice(1)
    );
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
