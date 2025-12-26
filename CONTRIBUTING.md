# Contributing to Claude Productivity Tools

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork locally
3. **Install** dependencies: `npm install`
4. **Build** the extension: `npm run build`
5. **Load** in Chrome (Developer mode) to test

## Development Workflow

### Setting Up

```bash
npm install      # Install dependencies
npm run dev      # Start watch mode
```

The extension auto-rebuilds when you modify files. Reload the extension in `chrome://extensions` to see changes.

### Code Style

We use ESLint and Prettier for consistent code style:

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
npm run format      # Format code
```

Pre-commit hooks automatically run linting on staged files.

### Commit Messages

Use clear, descriptive commit messages:

- `feat: add keyboard shortcut for bookmarks`
- `fix: resolve counter not updating on navigation`
- `refactor: simplify message detection logic`
- `docs: update installation instructions`

## Architecture Overview

### Module System

All features are implemented as modules extending `BaseModule`:

```javascript
import { BaseModule } from './BaseModule.js';

export class YourModule extends BaseModule {
  static id = 'yourModule';
  static settingsKey = 'yourModule';

  async init() {
    await super.init();
    if (!this.enabled) return;

    // Your initialization code
  }

  destroy() {
    // Cleanup code
    super.destroy();
  }
}
```

### Adding a New Module

1. Create module file in `src/modules/`
2. Extend `BaseModule`
3. Add settings key to `src/stores/SettingsStore.js` defaults
4. Register in `src/App.js` module list
5. Add UI toggle in `popup/popup.html` and `popup/popup.js`

### Key Patterns

- **Event Communication**: Use `EventBus` for cross-module events
- **DOM Operations**: Use `DOMManager` for safe HTML manipulation
- **Timers**: Use `AsyncManager` for centralized timer management
- **Storage**: Use stores in `src/stores/` for persistent data

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation.

## Pull Request Process

1. **Create a feature branch** from `main`
2. **Make focused changes** - one feature or fix per PR
3. **Test thoroughly** on claude.ai
4. **Run linting**: `npm run lint:fix`
5. **Update documentation** if needed
6. **Submit PR** with clear description

### PR Checklist

- [ ] Code follows project style (passes `npm run lint`)
- [ ] Changes tested on claude.ai
- [ ] No console.log statements (use `debugLog` for debug output)
- [ ] New features have corresponding settings toggle
- [ ] Documentation updated if needed

## Testing

Currently, testing is manual:

1. Load extension in Chrome Developer mode
2. Navigate to claude.ai
3. Test the specific feature/fix
4. Check browser console for errors
5. Test with features enabled/disabled

## Reporting Issues

When reporting bugs, please include:

- Browser version
- Extension version
- Steps to reproduce
- Expected vs actual behavior
- Console errors (if any)

## Code of Conduct

- Be respectful and constructive
- Focus on the code, not the person
- Welcome newcomers and help them learn

## Questions?

Open an issue with the "question" label or start a discussion.
