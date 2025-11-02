/**
 * Theme Configurations
 * Claude native renkler ve custom tema seçenekleri
 */

export const THEMES = {
  // Claude Native - Claude'un gerçek class'larını kullanır
  native: {
    name: 'Claude Native',
    useNativeClasses: true, // Claude'un gerçek CSS class'larını kullan
    // Button classes from Claude.ai (bg-bg-000/80 = neutral background)
    buttonClasses: 'z-[1] size-9 inline-flex items-center justify-center border-0.5 overflow-hidden !rounded-full p-1 shadow-md hover:shadow-lg bg-bg-000/80 hover:bg-bg-000 backdrop-blur transition-opacity duration-200 border-border-300 opacity-100 pointer-events-auto',
    // Neutral background (for panels, badges) - will use CSS variable
    neutralBg: '', // Handled by ThemeManager CSS variable
    // Accent color (turuncu) - for counters and action buttons
    accentColor: 'hsl(var(--accent-main-000)/var(--tw-bg-opacity))',
    // Primary is neutral (for compatibility)
    primary: '', // Use CSS variable --claude-productivity-neutral
    text: '#2D2D2D',
    textLight: '#6B6B6B',
  },

  // Turuncu Tema - Basit solid renk
  orange: {
    name: 'Orange',
    useNativeClasses: true, // Claude class'ları kullan ama basit
    simpleStyle: true, // Fancy efektler olmadan
    buttonClasses: 'z-[1] size-9 inline-flex items-center justify-center border-0.5 overflow-hidden !rounded-full p-1 transition-opacity duration-200 border-border-300 opacity-100 pointer-events-auto bg-bg-000 hover:bg-bg-000',
    accentColor: 'hsl(var(--accent-main-000)/var(--tw-bg-opacity))',
    primary: 'hsl(var(--accent-main-000))', // Claude'un turuncu rengi
    text: '#333333',
    textLight: '#666666',
  },

  // Custom - Kullanıcının seçeceği renk
  custom: {
    name: 'Custom',
    primary: '#667eea', // Default, kullanıcı değiştirecek
    primaryHover: '#5568d3',
    primaryLight: 'rgba(102, 126, 234, 0.1)',
    secondary: '#5568d3',
    text: '#333333',
    textLight: '#666666',
  },
};

/**
 * Hex renkten RGB'ye çevir
 */
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Custom renk için tema oluştur (gradient kaldırıldı - solid color)
 */
export function createCustomTheme(primaryColor) {
  const rgb = hexToRgb(primaryColor);
  if (!rgb) return THEMES.custom;

  // Hover rengi (biraz daha koyu)
  const darken = (val) => Math.max(0, val - 30);
  const hoverColor = `#${darken(rgb.r).toString(16).padStart(2, '0')}${darken(rgb.g).toString(16).padStart(2, '0')}${darken(rgb.b).toString(16).padStart(2, '0')}`;

  return {
    name: 'Custom',
    primary: primaryColor,
    primaryHover: hoverColor,
    primaryLight: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`,
    secondary: hoverColor,
    text: '#333333',
    textLight: '#666666',
  };
}

/**
 * Tema rengini al
 */
export function getThemeColors(themeName, customColor = null) {
  if (themeName === 'custom' && customColor) {
    return createCustomTheme(customColor);
  }

  return THEMES[themeName] || THEMES.native;
}

export default THEMES;
