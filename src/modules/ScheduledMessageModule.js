import BaseModule from './BaseModule.js';
import DOMUtils from '../utils/DOMUtils.js';
import ObserverManager from '../managers/ObserverManager.js';
import { trackEvent } from '../analytics/Analytics.js';
import { debugLog } from '../config/debug.js';
import ComposerAdapter from './ScheduledMessageModule/ComposerAdapter.js';
import ScheduleBackgroundClient from './ScheduledMessageModule/ScheduleBackgroundClient.js';
import SchedulePopover from './ScheduledMessageModule/SchedulePopover.js';
import ScheduleStatusView from './ScheduledMessageModule/ScheduleStatusView.js';
import {
  SCHEDULE_CLASSNAMES,
  SCHEDULE_MESSAGE_TYPES,
  SCHEDULE_STATUS,
} from './ScheduledMessageModule/constants.js';
import {
  buildFailureMessage,
  isActiveSchedule,
  normalizeConversationUrl,
  normalizeSnapshotText,
} from './ScheduledMessageModule/ScheduleState.js';

export default class ScheduledMessageModule extends BaseModule {
  constructor() {
    super('scheduledMessage');
    this.adapter = new ComposerAdapter();
    this.client = new ScheduleBackgroundClient();
    this.popover = new SchedulePopover();
    this.statusView = new ScheduleStatusView();
    this.observerId = 'scheduled-message-v2-observer';
    this.currentSchedule = null;
    this.currentContainer = null;
    this.ignoreNextNativeSendFor = null;
    this.pendingDisableCancellation = null;
    this.runtimeListener = this.handleRuntimeMessage.bind(this);
    this.nativeSendListener = this.handleDocumentClick.bind(this);
    this.beforeUnloadListener = this.handleBeforeUnload.bind(this);
    this.scheduleButtonClick = event => {
      event.preventDefault();
      event.stopPropagation();
      this.togglePopover(event.currentTarget);
    };
  }

  async init() {
    const initStart = performance.now();
    await super.init();
    if (!this.enabled) {
      return;
    }

    debugLog('scheduledMessage', 'Initializing Scheduled Message V2');

    if (this.pendingDisableCancellation) {
      await this.pendingDisableCancellation;
      this.pendingDisableCancellation = null;
    }

    chrome.runtime?.onMessage?.addListener?.(this.runtimeListener);
    document.addEventListener('click', this.nativeSendListener, true);
    window.addEventListener('beforeunload', this.beforeUnloadListener);

    this.setupObserver();
    await this.reinitializeUI();

    trackEvent('perf_init', {
      module: 'scheduledMessage',
      init_ms: Math.round(performance.now() - initStart),
    });
  }

  destroy() {
    if (this.shouldCancelOnDisable()) {
      const schedule = this.currentSchedule;
      this.pendingDisableCancellation = this.client
        .cancel({
          conversationUrl: schedule.conversationUrl,
          id: schedule.id,
        })
        .catch(error => {
          debugLog('scheduledMessage', 'Failed to cancel schedule during module disable', error);
        });
    }

    document.removeEventListener('click', this.nativeSendListener, true);
    window.removeEventListener('beforeunload', this.beforeUnloadListener);
    chrome.runtime?.onMessage?.removeListener?.(this.runtimeListener);
    ObserverManager.disconnect(this.observerId);
    this.popover.close();
    this.teardownComposerState(this.currentContainer);
    this.currentContainer = null;
    this.currentSchedule = null;
    super.destroy();
  }

  shouldCancelOnDisable() {
    return (
      isActiveSchedule(this.currentSchedule) &&
      this.settings?.scheduledMessage?.enabled === false &&
      this.previousSettings?.scheduledMessage?.enabled === true
    );
  }

  setupObserver() {
    ObserverManager.observe(
      this.observerId,
      document.body,
      () => {
        this.syncComposerUI();
      },
      {
        childList: true,
        subtree: true,
        debounce: 100,
      }
    );
  }

  async reinitializeUI() {
    if (!this.enabled) {
      return;
    }

    this.popover.close();
    this.syncComposerUI();
    await this.rehydrateCurrentConversation();
  }

  syncComposerUI() {
    const container = this.adapter.findChatContainer();
    if (!container) {
      this.teardownComposerState(this.currentContainer);
      this.currentContainer = null;
      return;
    }

    this.currentContainer = container;
    this.adapter.ensureScheduleButton(container, this.scheduleButtonClick);

    if (this.currentSchedule && isActiveSchedule(this.currentSchedule)) {
      this.adapter.lockComposer(container);
      this.renderStatus(container, this.currentSchedule);
    }
  }

  async rehydrateCurrentConversation() {
    if (this.pendingDisableCancellation) {
      await this.pendingDisableCancellation;
      this.pendingDisableCancellation = null;
    }

    const conversationUrl = this.getConversationUrl();
    if (!conversationUrl) {
      this.clearScheduleState();
      return;
    }

    try {
      const { schedule = null } = await this.client.getForConversation(conversationUrl);
      if (!schedule) {
        this.clearScheduleState();
        return;
      }

      if (isActiveSchedule(schedule)) {
        await this.applyPendingSchedule(schedule, { fromHydration: true });
        return;
      }

      this.applyFailureState(schedule);
    } catch (error) {
      debugLog('scheduledMessage', 'Failed to rehydrate current conversation', error);
      this.showInlineFailure({
        status: SCHEDULE_STATUS.FAILED,
        lastErrorCode: 'composer_not_ready',
      });
    }
  }

  getConversationUrl() {
    if (DOMUtils.isOnConversationPage() || window.location.pathname.startsWith('/new')) {
      return normalizeConversationUrl(window.location.href);
    }

    return '';
  }

  togglePopover(anchorButton) {
    if (!this.currentContainer) {
      return;
    }

    if (this.popover.element) {
      this.popover.close();
      return;
    }

    this.popover.open({
      anchorButton,
      hasPendingSchedule: isActiveSchedule(this.currentSchedule),
      onPresetSelect: delayMs => {
        this.popover.close();
        void this.createOrUpdateSchedule(Date.now() + delayMs);
      },
      onDatetimeSelect: rawValue => {
        this.popover.close();
        void this.createOrUpdateSchedule(new Date(rawValue).getTime());
      },
      onClose: () => {
        this.popover.close();
      },
    });
  }

  showValidationMessage(message) {
    debugLog('scheduledMessage', 'Validation message:', message);

    if (typeof window?.alert === 'function') {
      window.alert(message);
    }
  }

  async createOrUpdateSchedule(scheduledForMs) {
    const container = this.currentContainer || this.adapter.findChatContainer();
    if (!container) {
      this.showValidationMessage('Composer is not ready yet.');
      return;
    }

    if (!Number.isFinite(scheduledForMs) || scheduledForMs <= Date.now()) {
      this.showValidationMessage('Choose a future time.');
      return;
    }

    const snapshotText = this.adapter.getDraftText(container);
    const attachmentState = this.adapter.getAttachmentState(container);
    const hasDraft = snapshotText.length > 0;
    const hasAttachmentContent = attachmentState === 'present' || attachmentState === 'unknown';

    if (!hasDraft && !hasAttachmentContent) {
      this.showValidationMessage('Add a message or attachment before scheduling.');
      return;
    }

    const sendButton = this.adapter.getNativeSendButton(container);
    if (!sendButton || sendButton.disabled) {
      this.showValidationMessage('Wait until the composer is ready before scheduling.');
      return;
    }

    const needsAttachmentConfirmation = hasAttachmentContent;
    if (needsAttachmentConfirmation) {
      const confirmed = window.confirm(
        'Attachments are scheduled in best-effort mode and may fail after reload. Continue?'
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      const { schedule } = await this.client.createOrUpdate({
        conversationUrl: this.getConversationUrl(),
        snapshotText,
        scheduledForMs,
        hasAttachmentExpectation: needsAttachmentConfirmation,
      });

      await this.applyPendingSchedule(schedule, { fromHydration: false });
    } catch (error) {
      debugLog('scheduledMessage', 'Failed to create schedule', error);
      this.showValidationMessage('Scheduling failed. Try again.');
    }
  }

  async applyPendingSchedule(schedule, { fromHydration }) {
    const container = this.currentContainer || this.adapter.findChatContainer();
    if (!container) {
      return;
    }

    const currentDraft = this.adapter.getDraftText(container);
    if (fromHydration && normalizeSnapshotText(schedule.snapshotText) !== currentDraft) {
      await this.failSchedule(schedule, 'draft_mismatch');
      return;
    }

    if (fromHydration && schedule.hasAttachmentExpectation) {
      const attachmentState = this.adapter.getAttachmentState(container);
      if (attachmentState !== 'present') {
        await this.failSchedule(schedule, 'attachment_restore_failed');
        return;
      }
    }

    this.currentSchedule = schedule;
    this.adapter.lockComposer(container);
    this.renderStatus(container, schedule);
  }

  applyFailureState(schedule) {
    this.currentSchedule = schedule;
    this.adapter.unlockComposer(this.currentContainer);
    this.renderStatus(this.currentContainer, schedule);
  }

  async failSchedule(schedule, errorCode) {
    const record = {
      ...schedule,
      status: SCHEDULE_STATUS.FAILED,
      lastErrorCode: errorCode,
    };

    await this.client.reportResult({
      id: schedule.id,
      conversationUrl: schedule.conversationUrl,
      outcome: {
        status: SCHEDULE_STATUS.FAILED,
        code: errorCode,
      },
    });

    this.applyFailureState(record);
  }

  renderStatus(container, schedule) {
    const mount = this.adapter.getStatusMount(container);
    this.statusView.render(mount, schedule, {
      onCancel: () => {
        void this.cancelSchedule();
      },
      onReschedule: () => {
        const button = container.querySelector(`.${SCHEDULE_CLASSNAMES.button}`);
        if (button) {
          void this.togglePopover(button);
        }
      },
      onSendNow: () => {
        void this.sendNow();
      },
      onDismiss: () => {
        void this.dismissFailure();
      },
    });
  }

  showInlineFailure(schedule) {
    this.currentSchedule = schedule;
    this.adapter.unlockComposer(this.currentContainer);
    this.renderStatus(this.currentContainer, schedule);
  }

  async dismissFailure() {
    if (!this.currentSchedule) {
      return;
    }

    await this.client.cancel({
      conversationUrl: this.currentSchedule.conversationUrl,
      id: this.currentSchedule.id,
    });

    this.clearScheduleState();
  }

  async cancelSchedule() {
    if (!this.currentSchedule) {
      return;
    }

    const schedule = this.currentSchedule;
    await this.client.cancel({
      conversationUrl: schedule.conversationUrl,
      id: schedule.id,
    });

    this.clearScheduleState();
  }

  async sendNow() {
    if (!this.currentSchedule) {
      return;
    }

    try {
      const response = await this.client.sendNow({
        id: this.currentSchedule.id,
        conversationUrl: this.currentSchedule.conversationUrl,
        native: false,
      });

      if (response.status === SCHEDULE_STATUS.SENT) {
        this.clearScheduleState();
        return;
      }

      if (response.schedule) {
        this.currentSchedule = response.schedule;
        this.renderStatus(this.currentContainer, response.schedule);
        return;
      }

      this.showInlineFailure({
        ...this.currentSchedule,
        status: SCHEDULE_STATUS.FAILED,
        lastErrorCode: response.errorCode || 'composer_not_ready',
      });
    } catch (error) {
      debugLog('scheduledMessage', 'Send now failed', error);
      this.showInlineFailure({
        ...this.currentSchedule,
        status: SCHEDULE_STATUS.FAILED,
        lastErrorCode: 'composer_not_ready',
      });
    }
  }

  async handleExecute(schedule) {
    const container = this.currentContainer || this.adapter.findChatContainer();
    if (!container) {
      return this.client.reportResult({
        id: schedule.id,
        conversationUrl: schedule.conversationUrl,
        outcome: {
          status: SCHEDULE_STATUS.RETRYING,
          code: 'composer_not_ready',
        },
      });
    }

    this.currentSchedule = schedule;
    const draftText = this.adapter.getDraftText(container);
    if (normalizeSnapshotText(schedule.snapshotText) !== draftText) {
      await this.failSchedule(schedule, 'draft_mismatch');
      return;
    }

    if (
      schedule.hasAttachmentExpectation &&
      this.adapter.getAttachmentState(container) !== 'present'
    ) {
      await this.failSchedule(schedule, 'attachment_restore_failed');
      return;
    }

    const sendButton = this.adapter.getNativeSendButton(container);
    if (!sendButton) {
      await this.client.reportResult({
        id: schedule.id,
        conversationUrl: schedule.conversationUrl,
        outcome: {
          status: SCHEDULE_STATUS.RETRYING,
          code: 'send_control_unavailable',
        },
      });
      return;
    }

    if (sendButton.disabled) {
      await this.client.reportResult({
        id: schedule.id,
        conversationUrl: schedule.conversationUrl,
        outcome: {
          status: SCHEDULE_STATUS.RETRYING,
          code: 'composer_busy',
        },
      });
      return;
    }

    this.ignoreNextNativeSendFor = schedule.id;
    sendButton.click();

    await this.client.reportResult({
      id: schedule.id,
      conversationUrl: schedule.conversationUrl,
      outcome: {
        status: SCHEDULE_STATUS.SENT,
        code: 'sent',
      },
    });

    this.clearScheduleState();
  }

  handleRuntimeMessage(message, _sender, sendResponse) {
    if (message?.type !== SCHEDULE_MESSAGE_TYPES.EXECUTE) {
      return false;
    }

    Promise.resolve()
      .then(() => this.handleExecute(message.schedule))
      .then(() => sendResponse({ accepted: true }))
      .catch(error => {
        debugLog('scheduledMessage', 'Execution handler failed', error);
        sendResponse({ accepted: false, error: error.message });
      });

    return true;
  }

  async handleDocumentClick(event) {
    if (
      !this.currentSchedule ||
      !isActiveSchedule(this.currentSchedule) ||
      !this.currentContainer
    ) {
      return;
    }

    const sendButton = this.adapter.getNativeSendButton(this.currentContainer);
    if (!sendButton || !sendButton.contains(event.target)) {
      return;
    }

    if (this.ignoreNextNativeSendFor === this.currentSchedule.id) {
      this.ignoreNextNativeSendFor = null;
      return;
    }

    try {
      await this.client.sendNow({
        id: this.currentSchedule.id,
        conversationUrl: this.currentSchedule.conversationUrl,
        native: true,
      });

      this.clearScheduleState();
    } catch (error) {
      debugLog('scheduledMessage', 'Failed to clear schedule after native send', error);
    }
  }

  handleBeforeUnload(event) {
    if (!isActiveSchedule(this.currentSchedule)) {
      return undefined;
    }

    const warningMessage = 'A scheduled send is still pending.';
    event.preventDefault?.();
    event.returnValue = warningMessage;
    return warningMessage;
  }

  clearScheduleState() {
    this.adapter.unlockComposer(this.currentContainer);
    this.statusView.clear(this.adapter.getStatusMount(this.currentContainer));
    this.currentSchedule = null;
    this.ignoreNextNativeSendFor = null;
  }

  teardownComposerState(container) {
    this.popover.close();
    this.adapter.unlockComposer(container);
    this.statusView.clear(this.adapter.getStatusMount(container));
    this.adapter.removeScheduleButton(container);
  }

  buildFailureSummary() {
    if (!this.currentSchedule) {
      return '';
    }

    return buildFailureMessage(this.currentSchedule);
  }
}
