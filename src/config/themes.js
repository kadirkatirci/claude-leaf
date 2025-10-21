/**
 * Theme Configurations
 * Claude native renkler ve custom tema seçenekleri
 */

export const THEMES = {
  // Claude Native Renkler (Claude.ai'den alındı)
  native: {
    name: 'Claude Native',
    primary: '#CC785C', // Claude'un ana turuncu/kahverengi tonu
    primaryHover: '#B86B4F',
    primaryLight: 'rgba(204, 120, 92, 0.1)',
    secondary: '#8B7355',
    gradient: 'linear-gradient(135deg, #CC785C 0%, #8B7355 100%)',
    text: '#2D2D2D',
    textLight: '#6B6B6B',
  },
  
  // Mor Tema (Mevcut)
  purple: {
    name: 'Purple',
    primary: '#667eea',
    primaryHover: '#764ba2',
    primaryLight: 'rgba(102, 126, 234, 0.1)',
    secondary: '#764ba2',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
    gradient: 'linear-gradient(135deg, #667eea 0%, #5568d3 100%)',
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
 * Custom renk için tema oluştur
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
    gradient: `linear-gradient(135deg, ${primaryColor} 0%, ${hoverColor} 100%)`,
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
  
  return THEMES[themeName] || THEMES.purple;
}

export default THEMES;
