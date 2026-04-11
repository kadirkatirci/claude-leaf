import { SCHEDULE_CLASSNAMES, SCHEDULE_ICON_PATH, SCHEDULE_SELECTORS } from './constants.js';
import {
  isNewChatPathname,
  normalizeConversationUrl,
  normalizeSnapshotText,
} from './ScheduleState.js';

function setDisabledState(control, disabled) {
  if (!control) {
    return;
  }

  if (disabled) {
    control.dataset.clSchedulePreviousDisabled = control.disabled ? 'true' : 'false';
    control.dataset.clSchedulePreviousAriaDisabled = control.getAttribute('aria-disabled') || '';
    control.disabled = true;
    control.setAttribute('aria-disabled', 'true');
    control.dataset.clScheduleLocked = 'true';
    return;
  }

  if (control.dataset.clSchedulePreviousDisabled === 'false') {
    control.disabled = false;
  }
  if (control.dataset.clSchedulePreviousAriaDisabled) {
    control.setAttribute('aria-disabled', control.dataset.clSchedulePreviousAriaDisabled);
  } else {
    control.removeAttribute('aria-disabled');
  }
  delete control.dataset.clSchedulePreviousDisabled;
  delete control.dataset.clSchedulePreviousAriaDisabled;
  delete control.dataset.clScheduleLocked;
}

function interceptControlPress(event) {
  event.preventDefault();
  event.stopPropagation();
}

export default class ComposerAdapter {
  constructor() {
    this.lockSnapshots = new WeakMap();
  }

  isConversationSurface() {
    return isNewChatPathname(window.location.pathname);
  }

  getConversationUrl() {
    return normalizeConversationUrl(window.location.href);
  }

  findChatContainer(root = document) {
    const explicitContainer = root.querySelector(SCHEDULE_SELECTORS.container);
    if (explicitContainer) {
      return explicitContainer;
    }

    const editors = Array.from(root.querySelectorAll(SCHEDULE_SELECTORS.editor));
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

    const explicitContainer = editor.closest(SCHEDULE_SELECTORS.container);
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
        : candidate.querySelector(SCHEDULE_SELECTORS.editor);
    if (!scopedEditor) {
      return false;
    }

    if (!candidate.querySelector(SCHEDULE_SELECTORS.addFilesButton)) {
      return false;
    }

    return !!(
      candidate.querySelector(SCHEDULE_SELECTORS.modelSelector) ||
      candidate.querySelector(SCHEDULE_SELECTORS.voiceButton) ||
      SCHEDULE_SELECTORS.sendButtonCandidates.some(selector => candidate.querySelector(selector))
    );
  }

  getEditor(container) {
    return container?.querySelector(SCHEDULE_SELECTORS.editor) || null;
  }

  getEditorFrame(container) {
    return (
      this.getEditor(container)?.closest('.w-full') ||
      this.getEditor(container)?.parentElement ||
      null
    );
  }

  getComposerShell(container) {
    return (
      this.getEditor(container)?.closest('.bg-bg-000') ||
      container?.querySelector('fieldset') ||
      null
    );
  }

  getStatusMount(container) {
    return this.getComposerShell(container) || container;
  }

  getAddFilesButton(container) {
    return container?.querySelector(SCHEDULE_SELECTORS.addFilesButton) || null;
  }

  getModelSelectorButton(container) {
    return container?.querySelector(SCHEDULE_SELECTORS.modelSelector) || null;
  }

  getVoiceButton(container) {
    return container?.querySelector(SCHEDULE_SELECTORS.voiceButton) || null;
  }

  getNativeSendButton(container) {
    if (!container) {
      return null;
    }

    for (const selector of SCHEDULE_SELECTORS.sendButtonCandidates) {
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

  getDraftText(container) {
    const editor = this.getEditor(container);
    return normalizeSnapshotText(editor?.textContent || '');
  }

  hasSendableDraft(container) {
    return this.getDraftText(container).length > 0;
  }

  getAttachmentState(container) {
    try {
      const fileUploadInput = container?.querySelector(SCHEDULE_SELECTORS.fileUpload);
      if (fileUploadInput?.files && fileUploadInput.files.length > 0) {
        return 'present';
      }

      if (
        SCHEDULE_SELECTORS.attachmentIndicators.some(selector => container?.querySelector(selector))
      ) {
        return 'present';
      }

      if (
        SCHEDULE_SELECTORS.attachmentUnknownIndicators.some(selector =>
          container?.querySelector(selector)
        )
      ) {
        return 'unknown';
      }
    } catch {
      return 'unknown';
    }

    return 'absent';
  }

  isComposerBusy(container) {
    const sendButton = this.getNativeSendButton(container);
    return !!sendButton && sendButton.disabled;
  }

  buildScheduleButton(referenceButton) {
    const wrapper = document.createElement('div');
    wrapper.className = `${SCHEDULE_CLASSNAMES.buttonRoot} flex items-center shrink-0`;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = referenceButton?.className || '';
    button.classList.add(SCHEDULE_CLASSNAMES.button);
    button.setAttribute('aria-label', 'Schedule Message');
    button.setAttribute('title', 'Schedule Message');
    button.innerHTML = `
      <div style="width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink: 0;">
          <path d="${SCHEDULE_ICON_PATH}"></path>
        </svg>
      </div>
    `;

    button.addEventListener('pointerdown', interceptControlPress);
    button.addEventListener('mousedown', interceptControlPress);
    wrapper.appendChild(button);
    return { wrapper, button };
  }

  ensureScheduleButton(container, onClick) {
    const addFilesButton = this.getAddFilesButton(container);
    const anchor = addFilesButton?.parentElement;
    if (!addFilesButton || !anchor) {
      return null;
    }

    const existing = container.querySelector(`.${SCHEDULE_CLASSNAMES.button}`);
    if (existing) {
      return existing;
    }

    const { wrapper, button } = this.buildScheduleButton(addFilesButton);
    button.addEventListener('click', onClick);
    anchor.after(wrapper);
    return button;
  }

  removeScheduleButton(container) {
    container?.querySelector(`.${SCHEDULE_CLASSNAMES.buttonRoot}`)?.remove();
  }

  lockComposer(container) {
    if (!container || this.lockSnapshots.has(container)) {
      return;
    }

    const editor = this.getEditor(container);
    const controls = [
      this.getAddFilesButton(container),
      this.getModelSelectorButton(container),
      this.getVoiceButton(container),
    ].filter(Boolean);

    const snapshot = {
      editor,
      controls,
      editorContentEditable: editor?.getAttribute('contenteditable') ?? null,
      editorAriaReadonly: editor?.getAttribute('aria-readonly') ?? null,
      editorTabIndex: editor?.getAttribute('tabindex') ?? null,
    };

    this.lockSnapshots.set(container, snapshot);

    if (editor) {
      editor.setAttribute('contenteditable', 'false');
      editor.setAttribute('aria-readonly', 'true');
      editor.setAttribute('tabindex', '-1');
      editor.dataset.clScheduleLocked = 'true';
    }

    controls.forEach(control => setDisabledState(control, true));
    this.getComposerShell(container)?.setAttribute('data-cl-schedule-locked', 'true');
  }

  unlockComposer(container) {
    const snapshot = this.lockSnapshots.get(container);
    if (!snapshot) {
      return;
    }

    if (snapshot.editor) {
      if (snapshot.editorContentEditable === null) {
        snapshot.editor.removeAttribute('contenteditable');
      } else {
        snapshot.editor.setAttribute('contenteditable', snapshot.editorContentEditable);
      }

      if (snapshot.editorAriaReadonly === null) {
        snapshot.editor.removeAttribute('aria-readonly');
      } else {
        snapshot.editor.setAttribute('aria-readonly', snapshot.editorAriaReadonly);
      }

      if (snapshot.editorTabIndex === null) {
        snapshot.editor.removeAttribute('tabindex');
      } else {
        snapshot.editor.setAttribute('tabindex', snapshot.editorTabIndex);
      }

      delete snapshot.editor.dataset.clScheduleLocked;
    }

    snapshot.controls.forEach(control => setDisabledState(control, false));
    this.getComposerShell(container)?.removeAttribute('data-cl-schedule-locked');
    this.lockSnapshots.delete(container);
  }
}
