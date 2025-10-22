# Claude Productivity Extension

Chrome extension for Claude.ai with productivity tools.

## Features

- 🧭 **Navigation Buttons** - Quick navigation between messages
- ✏️ **Edit History** - Track and view edited prompts
- 🎨 **Themes** - Customizable color themes

## Development

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

### Watch Mode (Development)

```bash
npm run watch
```

The build process bundles all source files into `dist/content.bundle.js`.

## Project Structure

```
src/
├── content.js                      # Entry point
├── App.js                          # Main app
├── modules/
│   ├── BaseModule.js              # Base class for all modules
│   ├── NavigationModule.js        # Navigation buttons
│   ├── EditHistoryModule.js       # Edit history coordinator
│   └── EditHistoryModule/         # Edit history components
│       ├── EditScanner.js         # Scan for edits
│       ├── EditBadge.js           # Badge management
│       ├── EditPanel.js           # Floating panel
│       ├── EditModal.js           # Modal dialog
│       └── EditUI.js              # UI components
├── utils/
│   ├── EventBus.js               # Event system
│   ├── DOMUtils.js               # DOM helpers
│   └── SettingsManager.js        # Settings management
└── config/
    └── themes.js                  # Theme definitions

popup/                             # Settings UI
dist/                              # Built files (generated)
```

## Installation

1. Run `npm run build`
2. Open Chrome Extensions (`chrome://extensions`)
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the extension folder

## License

MIT
