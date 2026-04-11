export const DEFAULT_SETTINGS = {
  navigation: {
    enabled: true,
    showFloatingUI: true,
    position: 'center',
    showCounter: true,
    keyboardShortcuts: true,
    highlightDuration: 2000,
    scrollBehavior: 'smooth',
    scrollOffset: 100,
  },
  editHistory: {
    enabled: true,
    showFloatingUI: true,
    showBadges: true,
    highlightEdited: true,
    showPanel: true,
    trackVersions: true,
  },
  compactView: {
    enabled: true,
    minHeight: 200,
    maxHeight: 400,
    previewLines: 3,
    autoCollapse: false,
    animationDuration: 300,
  },
  bookmarks: {
    enabled: true,
    showFloatingUI: true,
    keyboardShortcuts: true,
    showInSidebar: true,
    exportFormat: 'json',
    showTimestamp: true,
  },
  emojiMarkers: {
    enabled: true,
    showFloatingUI: true,
    favoriteEmojis: ['⚠️', '❓', '💡', '⭐', '📌', '🔥'],
    showPanel: true,
  },
  sidebarCollapse: {
    enabled: true,
    defaultState: 'expanded',
    rememberState: true,
    animationDuration: 300,
  },
  contentFolding: {
    enabled: true,
    headings: true,
    codeBlocks: true,
    messages: true,
    rememberState: true,
    autoCollapseCode: true,
    codeBlockThreshold: 15,
  },
  scheduledMessage: {
    enabled: false,
  },
  general: {
    opacity: 0.7,
    colorTheme: 'purple',
    customColor: '#667eea',
    debugMode: false,
    performanceMode: false,
    cacheTimeout: 30000,
  },
};

export function cloneDefaultSettings() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}
