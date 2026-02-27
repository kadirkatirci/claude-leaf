/**
 * EditDraftCaptureService - Event-driven draft capture for edit sessions
 *
 * Captures textarea input snapshots in near real-time while the user edits
 * a message. Draft snapshots are stored as type='draft' entries and do not
 * affect normal history/modal rendering.
 */
import { editHistoryStore } from '../../stores/index.js';
import { hashString } from '../../utils/HashUtils.js';
import { debugLog } from '../../config/debug.js';
import DOMUtils from '../../utils/DOMUtils.js';
import messageCache from '../../core/MessageCache.js';
import { historyCaptureService } from './HistoryCaptureService.js';

const DRAFT_DEBOUNCE_MS = 350;
const FINALIZE_WAIT_MS = 2500;
const PRIMED_TTL_MS = 30000;

class EditDraftCaptureService {
  constructor() {
    this.isStarted = false;
    this.activeSession = null;
    this.pendingSessions = new Map();
    this.pendingTimers = new Map();
    this.primedSessions = new Map();
    this.recentPromotions = new Map();
    this.writeQueue = Promise.resolve();
    this.onDocumentClick = this.onDocumentClick.bind(this);
    this.onDocumentSubmit = this.onDocumentSubmit.bind(this);
  }

  start() {
    if (this.isStarted) {
      return;
    }

    document.addEventListener('click', this.onDocumentClick, true);
    document.addEventListener('submit', this.onDocumentSubmit, true);
    this.isStarted = true;
  }

  ensureContainerIdentity(messageElement, userMessage, messageIndex, textarea = null) {
    const containerId = `edit-index-${messageIndex}`;
    messageElement?.setAttribute('data-edit-container-id', containerId);
    userMessage?.setAttribute('data-edit-container-id', containerId);
    textarea?.setAttribute('data-edit-container-id', containerId);
    return containerId;
  }

  findVersionInfo(messageElement, userMessage) {
    const pattern = /^\d+\s*\/\s*\d+$/;

    const versionContainer = messageElement?.querySelector('.inline-flex.items-center.gap-1');
    if (versionContainer) {
      const versionSpan = versionContainer.querySelector('span');
      if (versionSpan && pattern.test(versionSpan.textContent.trim())) {
        return versionSpan.textContent.trim();
      }
    }

    const allSpans = messageElement?.querySelectorAll('span') || [];
    for (const span of allSpans) {
      if (userMessage && userMessage.contains(span)) {
        continue;
      }
      const text = span.textContent.trim();
      if (pattern.test(text)) {
        return text;
      }
    }

    return null;
  }

  getMessages(forceFresh = false) {
    if (forceFresh && messageCache?.invalidate) {
      messageCache.invalidate();
    }

    return DOMUtils.findMessages ? DOMUtils.findMessages() : [];
  }

  findMessageElement(messages, element, containerId = '') {
    if (!Array.isArray(messages) || messages.length === 0 || !element) {
      return null;
    }

    const closestContainer = element.closest?.(
      '[data-test-render-count], [data-testid*="conversation-turn"], [data-testid*="message"]'
    );
    if (closestContainer && messages.includes(closestContainer)) {
      return closestContainer;
    }

    if (containerId) {
      const byContainerId = messages.find(message => {
        if (message.getAttribute('data-edit-container-id') === containerId) {
          return true;
        }
        return !!message.querySelector(`[data-edit-container-id="${containerId}"]`);
      });
      if (byContainerId) {
        return byContainerId;
      }
    }

    return messages.find(message => message.contains(element)) || null;
  }

  getSafePrimedFallback(conversationUrl = window.location.pathname) {
    const candidates = [];

    for (const key of this.primedSessions.keys()) {
      const primed = this.getPrimedSession(key);
      if (!primed) {
        continue;
      }

      if (conversationUrl && primed.conversationUrl !== conversationUrl) {
        continue;
      }

      candidates.push(primed);
    }

    if (candidates.length !== 1) {
      return null;
    }

    return candidates[0];
  }

  getMessageContextFromElement(element, textarea = null, options = {}) {
    const { requireUserMessage = true, forceFresh = false } = options;
    const messages = this.getMessages(forceFresh);
    const hintContainerId =
      textarea?.getAttribute('data-edit-container-id') ||
      element?.getAttribute?.('data-edit-container-id') ||
      '';
    const messageElement = this.findMessageElement(messages, element, hintContainerId);
    const messageIndex = messageElement ? messages.indexOf(messageElement) : -1;

    if (!messageElement && !hintContainerId) {
      return null;
    }

    const userMessage = messageElement?.querySelector('[data-testid="user-message"]');
    if (requireUserMessage && !userMessage) {
      return null;
    }

    const containerId =
      hintContainerId ||
      (messageElement && messageIndex >= 0
        ? this.ensureContainerIdentity(messageElement, userMessage, messageIndex, textarea)
        : '');
    if (!containerId) {
      return null;
    }
    const sessionKey = `${window.location.pathname}|${containerId}`;
    const primed = this.getPrimedSession(sessionKey);

    return {
      conversationUrl: window.location.pathname,
      containerId,
      messageIndex: messageIndex >= 0 ? messageIndex : (primed?.messageIndex ?? -1),
      versionInfo:
        (messageElement ? this.findVersionInfo(messageElement, userMessage) : null) ||
        primed?.versionInfo ||
        '',
      initialContent: userMessage?.textContent.trim() || primed?.initialContent || '',
      messageElement: messageElement || null,
      sessionKey,
    };
  }

  getPrimedSession(sessionKey) {
    if (!sessionKey) {
      return null;
    }

    const primed = this.primedSessions.get(sessionKey);
    if (!primed) {
      return null;
    }

    if (Date.now() - primed.primedAt > PRIMED_TTL_MS) {
      this.primedSessions.delete(sessionKey);
      return null;
    }

    return primed;
  }

  onDocumentClick(event) {
    const target = event.target;
    if (!target?.closest) {
      return;
    }

    const editButton = target.closest('button[aria-label="Edit"]');
    if (editButton) {
      const context = this.getMessageContextFromElement(editButton, null, { forceFresh: true });
      if (!context) {
        return;
      }

      const sessionKey = this.buildSessionKey(context);
      this.primedSessions.set(sessionKey, {
        ...context,
        sessionKey,
        primedAt: Date.now(),
      });
      debugLog('editHistory', `Draft capture primed from Edit click: ${context.containerId}`);
      return;
    }

    const saveButton = target.closest('form button[type="submit"]');
    if (!saveButton) {
      return;
    }

    const form = saveButton.closest('form');
    this.captureFormSubmission(form, 'save_click');
  }

  predictNextFinalVersion(startVersion) {
    const parsed = this.parseVersionLabel(startVersion);
    if (parsed) {
      const next = parsed.total + 1;
      return this.formatVersionLabel(next, next);
    }
    return '2 / 2';
  }

  promoteInitialImmediately(context, reason = 'submit') {
    if (!context?.containerId || !context?.initialContent) {
      return;
    }

    const sessionKey = this.buildSessionKey(context);
    const lastPromotionAt = this.recentPromotions.get(sessionKey) || 0;
    if (Date.now() - lastPromotionAt < 1500) {
      return;
    }

    const predictedFinalVersion = this.predictNextFinalVersion(context.versionInfo || '');
    const previousVersionLabel = this.resolvePreviousVersionLabel(
      context.versionInfo || '',
      predictedFinalVersion
    );
    if (!previousVersionLabel) {
      return;
    }

    this.recentPromotions.set(sessionKey, Date.now());
    this.queueHistoryPromotion({
      conversationUrl: context.conversationUrl,
      containerId: context.containerId,
      messageIndex: context.messageIndex,
      content: context.initialContent,
      versionLabel: previousVersionLabel,
      timestamp: Date.now(),
      source: reason,
    });
  }

  captureFormSubmission(form, reason = 'submit') {
    if (!form?.querySelector) {
      return;
    }

    const textarea = form.querySelector('textarea');
    if (!textarea) {
      return;
    }

    let context = null;
    if (this.activeSession && this.activeSession.textarea === textarea) {
      context = {
        conversationUrl: this.activeSession.conversationUrl,
        containerId: this.activeSession.containerId,
        messageIndex: this.activeSession.messageIndex,
        versionInfo: this.activeSession.versionInfo,
        initialContent: this.activeSession.initialContent,
      };
    } else {
      const resolved = this.getMessageContextFromElement(form, textarea, {
        requireUserMessage: false,
        forceFresh: true,
      });
      if (resolved) {
        const sessionKey = resolved.sessionKey || this.buildSessionKey(resolved);
        const primed =
          this.getPrimedSession(sessionKey) ||
          this.getSafePrimedFallback(resolved.conversationUrl || window.location.pathname);
        context = {
          ...resolved,
          initialContent: primed?.initialContent || resolved.initialContent,
          versionInfo: primed?.versionInfo || resolved.versionInfo,
        };
      }
    }

    if (!context) {
      const primedFallback = this.getSafePrimedFallback(window.location.pathname);
      if (primedFallback) {
        context = {
          conversationUrl: primedFallback.conversationUrl,
          containerId: primedFallback.containerId,
          messageIndex: primedFallback.messageIndex,
          versionInfo: primedFallback.versionInfo,
          initialContent: primedFallback.initialContent,
        };
      }
    }

    this.promoteInitialImmediately(context, reason);
  }

  onDocumentSubmit(event) {
    this.captureFormSubmission(event.target, 'submit');
  }

  buildSessionKey(session) {
    if (!session) {
      return '';
    }
    return `${session.conversationUrl || window.location.pathname}|${session.containerId || ''}`;
  }

  enqueueTask(task, errorPrefix) {
    const run = this.writeQueue.then(task);
    this.writeQueue = run.catch(error => {
      console.error(`[EditDraftCaptureService] ${errorPrefix}:`, error);
    });
    return run;
  }

  queueWrite(snapshot) {
    return this.enqueueTask(
      () => editHistoryStore.addDraftSnapshot(snapshot),
      'Failed to store draft snapshot'
    );
  }

  async queueHistoryPromotion(entry) {
    // Promotion is latency-sensitive for modal UX (user can click immediately after save).
    // Do not queue behind draft writes; persist directly.
    try {
      await editHistoryStore.addOrUpdate(entry);
      await historyCaptureService.captureVersionSnapshot(entry);
    } catch (error) {
      console.error('[EditDraftCaptureService] Failed to promote draft to history:', error);
    }
  }

  parseVersionLabel(versionLabel) {
    if (typeof versionLabel !== 'string') {
      return null;
    }

    const match = versionLabel.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
    if (!match) {
      return null;
    }

    const current = Number.parseInt(match[1], 10);
    const total = Number.parseInt(match[2], 10);
    if (!Number.isFinite(current) || !Number.isFinite(total) || current < 1 || total < 1) {
      return null;
    }

    return { current, total };
  }

  formatVersionLabel(current, total) {
    return `${current} / ${total}`;
  }

  resolvePreviousVersionLabel(startVersion, finalVersion) {
    const startParsed = this.parseVersionLabel(startVersion);
    const finalParsed = this.parseVersionLabel(finalVersion);

    if (startParsed && finalParsed) {
      // Keep current index from session start, but use latest total count.
      return this.formatVersionLabel(startParsed.current, finalParsed.total);
    }

    if (startParsed) {
      return this.formatVersionLabel(startParsed.current, startParsed.total);
    }

    if (finalParsed && finalParsed.current > 1) {
      return this.formatVersionLabel(finalParsed.current - 1, finalParsed.total);
    }

    return null;
  }

  captureContent(session, content, changeType, metadata = {}) {
    if (!session) {
      return;
    }

    const normalizedContent = typeof content === 'string' ? content : '';
    const contentHash = hashString(normalizedContent);

    if (changeType === 'edit' && contentHash === session.lastHash) {
      return;
    }

    session.lastHash = contentHash;
    const now = Date.now();
    const trimmed = normalizedContent.trim();

    return this.queueWrite({
      sessionId: session.sessionId,
      conversationUrl: session.conversationUrl,
      containerId: session.containerId,
      messageIndex: session.messageIndex,
      versionLabel: session.versionInfo || '',
      content: normalizedContent,
      contentHash,
      changeType,
      captureTime: now - session.startedAt,
      characterCount: normalizedContent.length,
      wordCount: trimmed ? trimmed.split(/\s+/).length : 0,
      timestamp: now,
      ...metadata,
    });
  }

  scheduleCapture(session, content, changeType = 'edit') {
    if (!session) {
      return;
    }

    if (session.debounceTimer) {
      clearTimeout(session.debounceTimer);
    }

    session.debounceTimer = setTimeout(() => {
      this.captureContent(session, content, changeType);
    }, DRAFT_DEBOUNCE_MS);
  }

  finalizePendingSession(sessionId, status) {
    const session = this.pendingSessions.get(sessionId);
    if (!session) {
      return;
    }

    const timer = this.pendingTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.pendingTimers.delete(sessionId);
    }

    this.pendingSessions.delete(sessionId);

    this.queueWrite({
      sessionId: session.sessionId,
      conversationUrl: session.conversationUrl,
      containerId: session.containerId,
      messageIndex: session.messageIndex,
      versionLabel: session.versionInfo || '',
      content: '',
      contentHash: '',
      changeType: 'session_end',
      status,
      captureTime: Date.now() - session.startedAt,
      characterCount: 0,
      wordCount: 0,
      timestamp: Date.now(),
    });
  }

  endActiveSession(reason = 'ended') {
    const session = this.activeSession;
    if (!session) {
      return;
    }

    if (session.debounceTimer) {
      clearTimeout(session.debounceTimer);
      session.debounceTimer = null;
    }

    if (session.inputHandler && session.textarea) {
      session.textarea.removeEventListener('input', session.inputHandler);
    }

    this.captureContent(session, session.textarea?.value || '', 'end', { endReason: reason });

    this.activeSession = null;
    this.pendingSessions.set(session.sessionId, session);

    const timer = setTimeout(() => {
      this.finalizePendingSession(session.sessionId, 'cancelled');
    }, FINALIZE_WAIT_MS);
    this.pendingTimers.set(session.sessionId, timer);
  }

  startSession(sessionData) {
    if (!sessionData?.textarea || !sessionData?.containerId) {
      return;
    }

    this.start();

    const sessionKey = this.buildSessionKey(sessionData);
    const primed = this.getPrimedSession(sessionKey);
    if (
      this.activeSession &&
      this.activeSession.sessionKey === sessionKey &&
      this.activeSession.textarea === sessionData.textarea
    ) {
      return;
    }

    if (this.activeSession) {
      this.endActiveSession('switched');
    }

    // If an unfinished session exists for the same message, close it as replaced.
    for (const [pendingId, pendingSession] of this.pendingSessions.entries()) {
      if (pendingSession.sessionKey === sessionKey) {
        this.finalizePendingSession(pendingId, 'replaced');
      }
    }

    const session = {
      sessionId: crypto.randomUUID(),
      sessionKey,
      conversationUrl: sessionData.conversationUrl || window.location.pathname,
      containerId: sessionData.containerId,
      messageIndex: sessionData.messageIndex,
      versionInfo: sessionData.versionInfo || primed?.versionInfo || '',
      textarea: sessionData.textarea,
      startedAt: Date.now(),
      initialContent: primed?.initialContent || sessionData.textarea.value || '',
      lastHash: null,
      inputHandler: null,
      debounceTimer: null,
    };

    const inputHandler = event => {
      if (!this.activeSession || this.activeSession.sessionId !== session.sessionId) {
        return;
      }
      this.scheduleCapture(session, event.target?.value || '', 'edit');
    };

    session.inputHandler = inputHandler;
    session.textarea.addEventListener('input', inputHandler);
    this.activeSession = session;

    this.captureContent(session, session.textarea.value || '', 'initial');
    debugLog('editHistory', `Draft capture started: ${session.containerId}`);
  }

  endSession(sessionData, reason = 'ended') {
    if (!this.activeSession) {
      return;
    }

    if (!sessionData) {
      this.endActiveSession(reason);
      return;
    }

    const activeKey = this.activeSession.sessionKey;
    const endedKey = this.buildSessionKey(sessionData);
    if (activeKey !== endedKey) {
      return;
    }

    this.endActiveSession(reason);
  }

  async handleVersionChange(edits) {
    if (!Array.isArray(edits) || edits.length === 0 || this.pendingSessions.size === 0) {
      return;
    }

    const operations = [];

    for (const [sessionId, session] of this.pendingSessions.entries()) {
      const matchedEdit = edits.find(edit => edit.containerId === session.containerId);
      if (!matchedEdit) {
        continue;
      }

      const nextVersion = matchedEdit.versionInfo || '';
      const didVersionAdvance = !session.versionInfo || nextVersion !== session.versionInfo;
      if (!didVersionAdvance) {
        continue;
      }

      const finalMessage = matchedEdit.element?.querySelector('[data-testid="user-message"]');
      const finalContent = finalMessage ? finalMessage.textContent.trim() : '';
      const previousVersionLabel = this.resolvePreviousVersionLabel(
        session.versionInfo,
        nextVersion
      );

      if (previousVersionLabel && session.initialContent) {
        operations.push(
          this.queueHistoryPromotion({
            conversationUrl: session.conversationUrl,
            containerId: session.containerId,
            messageIndex: session.messageIndex,
            content: session.initialContent,
            versionLabel: previousVersionLabel,
            timestamp: session.startedAt,
          })
        );
      }

      if (finalContent) {
        operations.push(
          this.captureContent(session, finalContent, 'final', {
            finalVersionLabel: nextVersion,
          })
        );
      }

      this.finalizePendingSession(sessionId, 'saved');
      debugLog('editHistory', `Draft capture finalized: ${session.containerId} (${nextVersion})`);
    }

    if (operations.length > 0) {
      await Promise.allSettled(operations);
    }
  }

  destroy() {
    if (this.isStarted) {
      document.removeEventListener('click', this.onDocumentClick, true);
      document.removeEventListener('submit', this.onDocumentSubmit, true);
      this.isStarted = false;
    }

    this.endActiveSession('destroyed');

    for (const sessionId of Array.from(this.pendingSessions.keys())) {
      this.finalizePendingSession(sessionId, 'destroyed');
    }

    this.primedSessions.clear();
    this.recentPromotions.clear();
  }
}

export const editDraftCaptureService = new EditDraftCaptureService();
