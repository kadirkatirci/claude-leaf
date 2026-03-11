export const DEFAULT_CUSTOM_COLOR = '#8B5CF6';
export const DEFAULT_OPACITY = 0.9;

export const DEFAULT_HIGHLIGHT_PADDING = {
  top: 0,
  right: 10,
  bottom: 0,
  left: 10,
};

export const DEFAULT_HIGHLIGHT_MARGIN = {
  top: 5,
  right: 5,
  bottom: 10,
  left: 5,
};

export function resolveThemeSettings(settings = {}) {
  const generalSettings = settings.general || {};

  return {
    colorTheme: generalSettings.colorTheme || 'native',
    customColor: generalSettings.customColor || DEFAULT_CUSTOM_COLOR,
    opacity: generalSettings.opacity || DEFAULT_OPACITY,
    highlightPadding: generalSettings.highlightPadding || DEFAULT_HIGHLIGHT_PADDING,
    highlightMargin: generalSettings.highlightMargin || DEFAULT_HIGHLIGHT_MARGIN,
  };
}
