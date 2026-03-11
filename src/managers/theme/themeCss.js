function getPropertyValue(customProperties, key, fallback) {
  return customProperties.get(key) || fallback;
}

export function generateGlobalCss(theme, customProperties) {
  const primary = theme.primary || theme.accentColor || '#CC785C';
  const hover = theme.hover || theme.primary || primary;
  const active = theme.active || theme.primary || primary;
  const opacity = getPropertyValue(customProperties, '--claude-productivity-opacity', 0.9);
  const highlightPaddingTop = getPropertyValue(
    customProperties,
    '--claude-productivity-highlight-padding-top',
    '0px'
  );
  const highlightPaddingRight = getPropertyValue(
    customProperties,
    '--claude-productivity-highlight-padding-right',
    '10px'
  );
  const highlightPaddingBottom = getPropertyValue(
    customProperties,
    '--claude-productivity-highlight-padding-bottom',
    '0px'
  );
  const highlightPaddingLeft = getPropertyValue(
    customProperties,
    '--claude-productivity-highlight-padding-left',
    '10px'
  );
  const highlightMarginTop = getPropertyValue(
    customProperties,
    '--claude-productivity-highlight-margin-top',
    '5px'
  );
  const highlightMarginRight = getPropertyValue(
    customProperties,
    '--claude-productivity-highlight-margin-right',
    '5px'
  );
  const highlightMarginBottom = getPropertyValue(
    customProperties,
    '--claude-productivity-highlight-margin-bottom',
    '10px'
  );
  const highlightMarginLeft = getPropertyValue(
    customProperties,
    '--claude-productivity-highlight-margin-left',
    '5px'
  );

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

    `;
}

export function applyThemeProperties(root, theme, customProperties) {
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
  root.style.setProperty('--claude-productivity-hover', theme.hover || theme.primary || '#CC785C');
  root.style.setProperty(
    '--claude-productivity-active',
    theme.active || theme.primary || '#CC785C'
  );

  const propertyKeys = [
    '--claude-productivity-opacity',
    '--claude-productivity-highlight-padding-top',
    '--claude-productivity-highlight-padding-right',
    '--claude-productivity-highlight-padding-bottom',
    '--claude-productivity-highlight-padding-left',
    '--claude-productivity-highlight-margin-top',
    '--claude-productivity-highlight-margin-right',
    '--claude-productivity-highlight-margin-bottom',
    '--claude-productivity-highlight-margin-left',
  ];

  propertyKeys.forEach(key => {
    const value = customProperties.get(key);
    if (value !== undefined) {
      root.style.setProperty(key, value);
    }
  });
}
