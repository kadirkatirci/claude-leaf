/**
 * Theme Configurations
 * Claude native renkler ve custom tema seçenekleri
 */

export const THEMES = {
  // Claude Native - Always uses Claude's native classes
  native: {
    name: 'Claude Native',
    // Button classes from Claude.ai
    buttonClasses:
      'z-[1] size-9 inline-flex items-center justify-center border-0.5 overflow-hidden !rounded-full p-1 shadow-md hover:shadow-lg bg-bg-000/80 hover:bg-bg-000 backdrop-blur transition-opacity duration-200 border-border-300 opacity-100 pointer-events-auto',
    // Accent color - for counters and action buttons
    accentColor: 'hsl(var(--accent-main-000)/var(--tw-bg-opacity))',
  },

  // Orange Theme - Simple solid color
  orange: {
    name: 'Orange',
    simpleStyle: true, // No fancy effects
    buttonClasses:
      'z-[1] size-9 inline-flex items-center justify-center border-0.5 overflow-hidden !rounded-full p-1 transition-opacity duration-200 border-border-300 opacity-100 pointer-events-auto bg-bg-000 hover:bg-bg-000',
    accentColor: 'hsl(var(--accent-main-000)/var(--tw-bg-opacity))',
  },

  // Custom - User's custom color (using native classes with accent override)
  custom: {
    name: 'Custom',
    accentColor: '#667eea', // Default, user will change
  },
};

/**
 * Get theme configuration
 * @param {string} themeName - Theme name
 * @param {string} customColor - Custom accent color (hex)
 * @returns {Object} Theme configuration
 */
export function getThemeColors(themeName, customColor = null) {
  const theme = THEMES[themeName] || THEMES.native;

  // For custom theme, override accent color
  if (themeName === 'custom' && customColor) {
    return {
      ...theme,
      accentColor: customColor,
    };
  }

  return theme;
}

export default THEMES;
