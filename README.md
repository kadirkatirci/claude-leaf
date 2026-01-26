# Claude Productivity Tools

A Chrome extension that enhances the Claude.ai web interface with productivity features for managing long conversations.

## Features

### Navigation
- **Message Navigation** - Jump between messages with keyboard shortcuts or buttons
- **Counter Display** - Shows current position and total message count

### Organization
- **Bookmarks** - Save important messages with categories and notes
- **Emoji Markers** - Mark messages with custom emojis for quick reference
- **Edit History** - Track edited prompts with version history and branching visualization

### UI Enhancements
- **Compact View** - Collapse long responses to see more context
- **Content Folding** - Fold headings and code blocks within messages
- **Sidebar Collapse** - Collapsible sidebar sections for cleaner navigation

## Installation

### From Source (Developer Mode)

1. Clone the repository:
   ```bash
   git clone https://github.com/kadirkatirci/claude-productivity-ext.git
   cd claude-productivity-ext
   ```

2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

3. Load in Chrome:
   - Open `chrome://extensions`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the extension folder

4. Navigate to [claude.ai](https://claude.ai) to use the extension

## Usage

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + ↑` | Previous message |
| `Alt + ↓` | Next message |
| `Alt + Home` | First message |
| `Alt + End` | Last message |
| `Alt + B` | Toggle bookmark on current message |

### Buttons

The extension adds floating buttons on the right side of the conversation:
- **Navigation** - Up/down arrows with message counter
- **Bookmarks** - Star icon, click to bookmark current message
- **Markers** - Emoji icon, click to add emoji marker
- **Edit History** - History icon, shows edit versions and branches

### Settings

Click the extension icon in the Chrome toolbar to:
- Enable/disable individual features
- View storage usage

## Development

```bash
npm run dev      # Watch mode with auto-rebuild
npm run build    # Production build
npm run lint     # Run ESLint
npm run lint:fix # Fix ESLint issues
npm run format   # Format with Prettier
```

### Project Structure

```
src/
├── content.js          # Entry point
├── App.js              # Main application manager
├── core/               # Core infrastructure
│   ├── storage/        # Storage adapters (Local, Sync, IndexedDB)
│   └── ...
├── modules/            # Feature modules
│   ├── NavigationModule.js
│   ├── BookmarkModule.js
│   ├── EmojiMarkerModule.js
│   ├── EditHistoryModule.js
│   ├── CompactViewModule.js
│   ├── ContentFoldingModule/
│   └── SidebarCollapseModule.js
├── stores/             # State management
├── managers/           # Singleton managers
├── utils/              # Utility functions
└── config/             # Configuration

popup/                  # Extension popup UI
```

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation.

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Quick Start

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Run linting: `npm run lint:fix`
5. Commit with a descriptive message
6. Push and create a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Built for [Claude.ai](https://claude.ai) by Anthropic
- Uses [Rollup](https://rollupjs.org) for bundling
