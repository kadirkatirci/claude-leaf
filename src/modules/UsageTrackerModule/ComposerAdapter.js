import { USAGE_SELECTORS } from './constants.js';

export default class ComposerAdapter {
  findChatContainer(root = document) {
    const explicitContainer = root.querySelector(USAGE_SELECTORS.container);
    if (explicitContainer) {
      return explicitContainer;
    }

    const editors = Array.from(root.querySelectorAll(USAGE_SELECTORS.editor));
    for (const editor of editors) {
      const container = this.findContainerForEditor(editor);
      if (container) {
        return container;
      }
    }

    return null;
  }

  findContainerForEditor(editor) {
    if (!editor) {
      return null;
    }

    const explicitContainer = editor.closest(USAGE_SELECTORS.container);
    if (explicitContainer) {
      return explicitContainer;
    }

    let current = editor.parentElement;
    while (current && current !== document.documentElement) {
      if (this.isComposerContainer(current, editor)) {
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }

  isComposerContainer(candidate, editor = null) {
    if (!(candidate instanceof HTMLElement)) {
      return false;
    }

    const scopedEditor =
      editor && candidate.contains(editor)
        ? editor
        : candidate.querySelector(USAGE_SELECTORS.editor);
    if (!scopedEditor) {
      return false;
    }

    if (!candidate.querySelector(USAGE_SELECTORS.addFilesButton)) {
      return false;
    }

    return !!(
      candidate.querySelector(USAGE_SELECTORS.modelSelector) ||
      candidate.querySelector(USAGE_SELECTORS.voiceButton) ||
      USAGE_SELECTORS.sendButtonCandidates.some(selector => candidate.querySelector(selector))
    );
  }

  getEditor(container) {
    return container?.querySelector(USAGE_SELECTORS.editor) || null;
  }

  getComposerShell(container) {
    return (
      this.getEditor(container)?.closest('.bg-bg-000') ||
      container?.querySelector('fieldset') ||
      container ||
      null
    );
  }

  getUsageMount(container) {
    return this.getComposerShell(container);
  }

  getAddFilesButton(container) {
    return container?.querySelector(USAGE_SELECTORS.addFilesButton) || null;
  }

  getModelSelectorButton(container) {
    return container?.querySelector(USAGE_SELECTORS.modelSelector) || null;
  }

  getVoiceButton(container) {
    return container?.querySelector(USAGE_SELECTORS.voiceButton) || null;
  }

  getNativeSendButton(container) {
    if (!container) {
      return null;
    }

    for (const selector of USAGE_SELECTORS.sendButtonCandidates) {
      const match = container.querySelector(selector);
      if (match) {
        return match;
      }
    }

    const ignoredButtons = new Set([
      this.getAddFilesButton(container),
      this.getModelSelectorButton(container),
      this.getVoiceButton(container),
    ]);

    const fallbackButtons = Array.from(container.querySelectorAll('button')).filter(button => {
      if (!button || ignoredButtons.has(button)) {
        return false;
      }

      const ariaLabel = button.getAttribute('aria-label') || '';
      if (
        ariaLabel === 'Scroll to bottom' ||
        ariaLabel === 'Add files, connectors, and more' ||
        ariaLabel === 'Use voice mode'
      ) {
        return false;
      }

      if (button.closest('[data-testid="wiggle-controls-actions"]')) {
        return false;
      }

      return button.offsetParent !== null || button.getClientRects().length > 0;
    });

    return fallbackButtons.at(-1) || null;
  }

  isComposerBusy(container) {
    const sendButton = this.getNativeSendButton(container);
    return !!sendButton && sendButton.disabled;
  }
}
