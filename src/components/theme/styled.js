/**
 * Styled Utilities
 * Helper functions for creating styled components with consistent theming
 */

import tokens from './tokens.js';

/**
 * Creates a style object from tokens
 * Allows components to use design tokens easily
 */
export const createStyles = (styleFactory) => {
  if (typeof styleFactory === 'function') {
    return styleFactory(tokens);
  }
  return styleFactory;
};

/**
 * Converts a style object to CSS string for inline styles
 */
export const toInlineStyle = (styles) => {
  return Object.entries(styles)
    .map(([key, value]) => {
      const cssKey = key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);
      return `${cssKey}: ${value}`;
    })
    .join('; ');
};

/**
 * Generates CSS class styles
 * This will be injected by ThemeManager
 */
export const generateComponentCSS = () => {
  return `
    /* Base Component Styles using Design Tokens */

    /* Button Styles */
    .cp-btn {
      font-family: ${tokens.typography.fontFamily.sans};
      font-size: ${tokens.typography.fontSize.base};
      font-weight: ${tokens.typography.fontWeight.medium};
      line-height: ${tokens.typography.lineHeight.normal};
      border-radius: ${tokens.radius('md')};
      cursor: pointer;
      transition: all ${tokens.animation.duration.fast} ${tokens.animation.easing.easeOut};
      opacity: ${tokens.opacity.dynamic};
      border: none;
      outline: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: ${tokens.space('xs')};
      user-select: none;
    }

    .cp-btn:hover {
      transform: scale(1.05);
      opacity: 1;
    }

    .cp-btn:active {
      transform: scale(0.98);
    }

    /* Button Variants */
    .cp-btn-primary {
      background: ${tokens.colors.primary};
      color: ${tokens.colors.text.inverse};
    }

    .cp-btn-primary:hover {
      background: ${tokens.colors.primaryHover};
      box-shadow: ${tokens.shadows.md};
    }

    .cp-btn-secondary {
      background: ${tokens.colors.neutral[100]};
      color: ${tokens.colors.text.primary};
      border: 1px solid ${tokens.colors.border.default};
    }

    .cp-btn-secondary:hover {
      background: ${tokens.colors.neutral[200]};
      border-color: ${tokens.colors.border.dark};
    }

    .cp-btn-ghost {
      background: transparent;
      color: ${tokens.colors.text.secondary};
    }

    .cp-btn-ghost:hover {
      background: ${tokens.colors.neutral[100]};
      color: ${tokens.colors.text.primary};
    }

    /* Button Sizes */
    .cp-btn-sm {
      height: ${tokens.sizes.button.sm.height}px;
      padding: ${tokens.sizes.button.sm.padding};
      font-size: ${tokens.typography.fontSize.sm};
    }

    .cp-btn-base {
      height: ${tokens.sizes.button.base.height}px;
      padding: ${tokens.sizes.button.base.padding};
    }

    .cp-btn-lg {
      height: ${tokens.sizes.button.lg.height}px;
      padding: ${tokens.sizes.button.lg.padding};
      font-size: ${tokens.typography.fontSize.md};
    }

    /* Fixed Button Styles */
    .cp-btn-fixed {
      position: fixed;
      z-index: ${tokens.zIndex.fixed};
      width: 36px;
      height: 36px;
      padding: 0;
      border-radius: ${tokens.radius('full')};
      box-shadow: ${tokens.shadows.lg};
    }

    .cp-btn-fixed:hover {
      box-shadow: ${tokens.shadows.xl};
    }

    /* Icon Button */
    .cp-btn-icon {
      padding: ${tokens.space('sm')};
      background: transparent;
      color: ${tokens.colors.text.secondary};
      min-width: 32px;
      height: 32px;
    }

    .cp-btn-icon:hover {
      background: ${tokens.colors.neutral[100]};
      color: ${tokens.colors.text.primary};
    }

    /* Icon content inside buttons - mode adaptive */
    .cp-btn-icon-content {
      /* Let Claude's native text-text-200 class handle the color */
      font-weight: 600; /* Make it bolder for better visibility */
    }

    /* Fallback for non-native themes */
    .cp-btn-icon-content:not(.text-text-200) {
      color: rgba(0, 0, 0, 0.7); /* Dark gray for light mode */
    }

    @media (prefers-color-scheme: dark) {
      .cp-btn-icon-content:not(.text-text-200) {
        color: rgba(255, 255, 255, 0.9); /* Light gray for dark mode */
      }
    }

    /* Chevron Button */
    .cp-btn-chevron {
      width: 20px;
      height: 20px;
      padding: 2px;
      background: transparent;
      color: ${tokens.colors.text.tertiary};
      border-radius: ${tokens.radius('sm')};
    }

    .cp-btn-chevron:hover {
      background: ${tokens.colors.neutral[200]};
      color: ${tokens.colors.text.primary};
    }

    /* Badge Styles */
    .cp-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: ${tokens.sizes.badge.height}px;
      min-width: ${tokens.sizes.badge.minWidth}px;
      padding: ${tokens.sizes.badge.padding};
      border-radius: ${tokens.radius('full')};
      font-size: ${tokens.typography.fontSize.xs};
      font-weight: ${tokens.typography.fontWeight.semibold};
      line-height: 1;
      transition: all ${tokens.animation.duration.fast} ${tokens.animation.easing.easeOut};
    }

    .cp-badge-primary {
      background: ${tokens.colors.primary};
      color: ${tokens.colors.text.inverse};
    }

    .cp-badge-success {
      background: ${tokens.colors.success};
      color: ${tokens.colors.text.inverse};
    }

    .cp-badge-warning {
      background: ${tokens.colors.warning};
      color: ${tokens.colors.text.inverse};
    }

    .cp-badge-error {
      background: ${tokens.colors.error};
      color: ${tokens.colors.text.inverse};
    }

    .cp-badge-neutral {
      background: ${tokens.colors.neutral[200]};
      color: ${tokens.colors.text.primary};
    }

    /* Panel Styles */
    .cp-panel {
      position: fixed;
      background: ${tokens.colors.background.panel};
      border-radius: ${tokens.radius('lg')};
      box-shadow: ${tokens.shadows.xl};
      overflow: hidden;
      z-index: ${tokens.zIndex.modal};
      display: flex;
      flex-direction: column;
      opacity: ${tokens.opacity.dynamic};
    }

    .cp-panel-header {
      padding: ${tokens.space('md')} ${tokens.space('lg')};
      background: ${tokens.colors.primary};
      color: ${tokens.colors.text.inverse};
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: ${tokens.typography.fontWeight.semibold};
      font-size: ${tokens.typography.fontSize.md};
    }

    .cp-panel-content {
      flex: 1;
      overflow-y: auto;
      padding: ${tokens.space('lg')};
    }

    .cp-panel-footer {
      padding: ${tokens.space('md')} ${tokens.space('lg')};
      border-top: 1px solid ${tokens.colors.border.light};
      display: flex;
      gap: ${tokens.space('sm')};
      justify-content: flex-end;
    }

    /* Card/List Item Styles */
    .cp-card {
      background: ${tokens.colors.background.primary};
      border: 1px solid ${tokens.colors.border.light};
      border-radius: ${tokens.radius('md')};
      padding: ${tokens.space('md')};
      transition: all ${tokens.animation.duration.fast} ${tokens.animation.easing.easeOut};
      cursor: pointer;
    }

    .cp-card:hover {
      background: ${tokens.colors.background.secondary};
      border-color: ${tokens.colors.border.default};
      box-shadow: ${tokens.shadows.sm};
      transform: translateY(-1px);
    }

    .cp-card-title {
      font-weight: ${tokens.typography.fontWeight.semibold};
      color: ${tokens.colors.text.primary};
      margin-bottom: ${tokens.space('xs')};
    }

    .cp-card-description {
      color: ${tokens.colors.text.secondary};
      font-size: ${tokens.typography.fontSize.sm};
      line-height: ${tokens.typography.lineHeight.relaxed};
    }

    .cp-card-meta {
      display: flex;
      align-items: center;
      gap: ${tokens.space('sm')};
      margin-top: ${tokens.space('sm')};
      color: ${tokens.colors.text.tertiary};
      font-size: ${tokens.typography.fontSize.xs};
    }

    /* Modal/Overlay Styles */
    .cp-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: ${tokens.colors.background.overlay};
      z-index: ${tokens.zIndex.overlay};
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn ${tokens.animation.duration.fast} ${tokens.animation.easing.easeOut};
    }

    .cp-modal {
      background: ${tokens.colors.background.primary};
      border-radius: ${tokens.radius('xl')};
      box-shadow: ${tokens.shadows.xxl};
      max-width: 90%;
      max-height: 90%;
      overflow: hidden;
      animation: slideUp ${tokens.animation.duration.normal} ${tokens.animation.easing.easeOut};
    }

    /* Dark Mode Support */
    @media (prefers-color-scheme: dark) {
      .cp-panel {
        background: ${tokens.colors.neutral[800]};
      }

      .cp-panel-content {
        color: ${tokens.colors.neutral[100]};
      }

      .cp-card {
        background: ${tokens.colors.neutral[900]};
        border-color: ${tokens.colors.neutral[700]};
      }

      .cp-card:hover {
        background: ${tokens.colors.neutral[800]};
        border-color: ${tokens.colors.neutral[600]};
      }

      .cp-modal {
        background: ${tokens.colors.neutral[800]};
        color: ${tokens.colors.neutral[100]};
      }

      .cp-btn-secondary {
        background: ${tokens.colors.neutral[700]};
        color: ${tokens.colors.neutral[100]};
        border-color: ${tokens.colors.neutral[600]};
      }

      .cp-btn-secondary:hover {
        background: ${tokens.colors.neutral[600]};
        border-color: ${tokens.colors.neutral[500]};
      }
    }

    /* Animations */
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Utility Classes */
    .cp-truncate {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cp-line-clamp-2 {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
    }

    .cp-line-clamp-3 {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
      overflow: hidden;
    }

    .cp-hidden {
      display: none !important;
    }

    .cp-invisible {
      visibility: hidden;
    }

    .cp-fade {
      opacity: ${tokens.opacity.muted};
    }

    .cp-disabled {
      opacity: ${tokens.opacity.disabled};
      pointer-events: none;
    }
  `;
};

/**
 * Helper to apply conditional styles
 */
export const conditionalStyle = (condition, trueStyle, falseStyle = {}) => {
  return condition ? trueStyle : falseStyle;
};

/**
 * Merges multiple style objects
 */
export const mergeStyles = (...styles) => {
  return Object.assign({}, ...styles);
};

/**
 * Creates a className string from conditionals
 */
export const classNames = (...classes) => {
  return classes
    .filter(Boolean)
    .map(cls => {
      if (typeof cls === 'object') {
        return Object.entries(cls)
          .filter(([, value]) => value)
          .map(([key]) => key)
          .join(' ');
      }
      return cls;
    })
    .join(' ');
};

/**
 * Export styled utilities
 */
export default {
  createStyles,
  toInlineStyle,
  generateComponentCSS,
  conditionalStyle,
  mergeStyles,
  classNames,
};