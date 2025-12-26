/**
 * Design Tokens
 * Centralized design system tokens for the Claude Productivity Extension
 * These tokens ensure consistency across all UI components
 */

/**
 * Color Tokens
 * All colors use CSS custom properties for dynamic theming
 * No hardcoded hex values allowed in components!
 */
export const colors = {
  // Primary colors - dynamically set by ThemeManager
  primary: 'var(--claude-productivity-primary)',
  primaryHover: 'var(--claude-productivity-primary-hover)',
  primaryActive: 'var(--claude-productivity-primary-active)',

  // Semantic colors
  success: 'var(--claude-productivity-success, #10b981)',
  warning: 'var(--claude-productivity-warning, #f59e0b)',
  error: 'var(--claude-productivity-error, #ef4444)',
  info: 'var(--claude-productivity-info, #3b82f6)',

  // Neutral colors
  neutral: {
    50: 'var(--claude-productivity-neutral-50, #fafafa)',
    100: 'var(--claude-productivity-neutral-100, #f5f5f5)',
    200: 'var(--claude-productivity-neutral-200, #e5e5e5)',
    300: 'var(--claude-productivity-neutral-300, #d4d4d4)',
    400: 'var(--claude-productivity-neutral-400, #a3a3a3)',
    500: 'var(--claude-productivity-neutral-500, #737373)',
    600: 'var(--claude-productivity-neutral-600, #525252)',
    700: 'var(--claude-productivity-neutral-700, #404040)',
    800: 'var(--claude-productivity-neutral-800, #262626)',
    900: 'var(--claude-productivity-neutral-900, #171717)',
  },

  // Background colors
  background: {
    primary: 'var(--claude-productivity-bg-primary, #ffffff)',
    secondary: 'var(--claude-productivity-bg-secondary, #f8f9fa)',
    tertiary: 'var(--claude-productivity-bg-tertiary, #e9ecef)',
    overlay: 'var(--claude-productivity-bg-overlay, rgba(0, 0, 0, 0.5))',
    panel: 'var(--claude-productivity-bg-panel, #ffffff)',
  },

  // Text colors
  text: {
    primary: 'var(--claude-productivity-text-primary, #171717)',
    secondary: 'var(--claude-productivity-text-secondary, #525252)',
    tertiary: 'var(--claude-productivity-text-tertiary, #737373)',
    inverse: 'var(--claude-productivity-text-inverse, #ffffff)',
    link: 'var(--claude-productivity-text-link, #3b82f6)',
  },

  // Border colors
  border: {
    light: 'var(--claude-productivity-border-light, #e5e5e5)',
    default: 'var(--claude-productivity-border-default, #d4d4d4)',
    dark: 'var(--claude-productivity-border-dark, #a3a3a3)',
  },

  // Special colors (previously hardcoded)
  accent: {
    purple: 'var(--claude-productivity-accent-purple, #667eea)',
    red: 'var(--claude-productivity-accent-red, #ff4757)',
    orange: 'var(--claude-productivity-accent-orange, #CC785C)',
    blue: 'var(--claude-productivity-accent-blue, #3b82f6)',
  },
};

/**
 * Spacing Tokens
 * Consistent spacing scale based on 4px unit
 */
export const spacing = {
  xxs: 2, // 2px
  xs: 4, // 4px
  sm: 8, // 8px
  md: 12, // 12px
  lg: 16, // 16px
  xl: 20, // 20px
  xxl: 24, // 24px
  xxxl: 32, // 32px
};

/**
 * Typography Tokens
 */
export const typography = {
  fontSize: {
    xs: '11px',
    sm: '12px',
    base: '13px',
    md: '14px',
    lg: '16px',
    xl: '18px',
    xxl: '20px',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7,
  },
  fontFamily: {
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: '"SF Mono", Monaco, Consolas, "Courier New", monospace',
  },
};

/**
 * Border Radius Tokens
 */
export const borderRadius = {
  none: 0,
  sm: 4,
  base: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

/**
 * Shadow Tokens
 */
export const shadows = {
  none: 'none',
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  base: '0 2px 4px rgba(0, 0, 0, 0.1)',
  md: '0 4px 8px rgba(0, 0, 0, 0.15)',
  lg: '0 8px 16px rgba(0, 0, 0, 0.2)',
  xl: '0 12px 24px rgba(0, 0, 0, 0.25)',
  xxl: '0 20px 40px rgba(0, 0, 0, 0.3)',
  inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.05)',
};

/**
 * Z-Index Tokens
 */
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  overlay: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
};

/**
 * Animation Tokens
 */
export const animation = {
  duration: {
    instant: '0ms',
    fast: '150ms',
    normal: '250ms',
    slow: '350ms',
    slower: '500ms',
  },
  easing: {
    linear: 'linear',
    ease: 'ease',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

/**
 * Opacity Tokens
 */
export const opacity = {
  transparent: 0,
  disabled: 0.5,
  muted: 0.7,
  visible: 0.9,
  full: 1,
  // Dynamic opacity from settings
  dynamic: 'var(--claude-productivity-opacity, 0.9)',
};

/**
 * Size Tokens for common dimensions
 */
export const sizes = {
  button: {
    sm: { height: 28, padding: '6px 12px' },
    base: { height: 32, padding: '8px 16px' },
    md: { height: 36, padding: '10px 18px' },
    lg: { height: 40, padding: '12px 20px' },
  },
  icon: {
    xs: 12,
    sm: 16,
    base: 20,
    md: 24,
    lg: 28,
    xl: 32,
  },
  badge: {
    height: 18,
    minWidth: 18,
    padding: '0 6px',
  },
  panel: {
    width: {
      sm: 280,
      base: 320,
      md: 400,
      lg: 500,
    },
    maxHeight: '80vh',
  },
};

/**
 * Breakpoints for responsive design (future enhancement)
 */
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1536,
};

/**
 * Helper function to get pixel value with unit
 */
export const px = value => `${value}px`;

/**
 * Helper function to get spacing value with unit
 */
export const space = key => `${spacing[key]}px`;

/**
 * Helper function to get radius value with unit
 */
export const radius = key => `${borderRadius[key]}px`;

/**
 * Export all tokens as default for easy importing
 */
export default {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  zIndex,
  animation,
  opacity,
  sizes,
  breakpoints,
  // Helper functions
  px,
  space,
  radius,
};
