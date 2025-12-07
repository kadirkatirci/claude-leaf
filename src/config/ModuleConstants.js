/**
 * Module Constants - Hardcoded defaults
 * These are NOT stored in chrome.storage
 * These are NOT configurable by users
 * Modules import these directly
 */

export const MODULE_CONSTANTS = {
    navigation: {
        position: 'right',
        showCounter: true,
        smoothScroll: true,
        highlightDuration: 2000,
        keyboardShortcuts: true,
        opacity: 0.7
    },

    compactView: {
        autoCollapse: false,
        keyboardShortcuts: true,
        minLines: 30,
        previewLines: 8
    },

    bookmarks: {
        keyboardShortcuts: true,
        showOnHover: true,
        storageType: 'local'
    },

    emojiMarkers: {
        favoriteEmojis: ['⚠️', '❓', '💡', '⭐', '📌', '🔥'],
        showBadges: true,
        showOnHover: true
    },

    editHistory: {
        showBadges: true,
        highlightEdited: true
    },

    sidebarCollapse: {
        defaultState: 'expanded',
        rememberState: true
    },

    contentFolding: {
        headings: { enabled: true },
        codeBlocks: {
            enabled: true,
            minLines: 15,
            previewLines: 5,
            autoCollapse: false
        },
        messages: {
            enabled: true,
            previewLines: 3
        },
        rememberState: true
    },

    general: {
        opacity: 0.7,
        colorTheme: 'native',
        customColor: '#667eea',
        debugMode: false
    }
};
