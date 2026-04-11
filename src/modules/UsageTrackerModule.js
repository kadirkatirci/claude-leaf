import BaseModule from './BaseModule.js';
import ObserverManager from '../managers/ObserverManager.js';
import { trackEvent } from '../analytics/Analytics.js';
import { debugLog } from '../config/debug.js';
import ComposerAdapter from './UsageTrackerModule/ComposerAdapter.js';
import UsageClient from './UsageTrackerModule/UsageClient.js';
import UsageBridge from './UsageTrackerModule/UsageBridge.js';
import UsageIndicatorView from './UsageTrackerModule/UsageIndicatorView.js';
import {
  USAGE_EVENT_NAMES,
  USAGE_POLL_MS,
  USAGE_REVALIDATE_MS,
  USAGE_STALE_MS,
} from './UsageTrackerModule/constants.js';
import {
  hasRenderableUsage,
  isUsageStateStale,
  mergeUsageState,
  normalizeMessageLimitPayload,
  normalizeUsagePayload,
} from './UsageTrackerModule/UsageState.js';

export default class UsageTrackerModule extends BaseModule {
  constructor() {
    super('usageTracker');
    this.adapter = new ComposerAdapter();
    this.bridge = new UsageBridge();
    this.client = new UsageClient(this.bridge);
    this.view = new UsageIndicatorView({
      onTooltipOpen: this.handleTooltipOpen.bind(this),
    });
    this.observerId = 'usage-tracker-observer';
    this.currentContainer = null;
    this.currentMount = null;
    this.usageState = null;
    this.refreshInFlight = null;
    this.pollIntervalId = null;
    this.revalidateTimerId = null;
    this.pendingSendRefreshIds = new Set();
    this.openedTooltipKinds = new Set();
    this.awaitingUsageAfterSend = false;
    this.composerBusy = false;
    this.visibilityListener = this.handleVisibilityChange.bind(this);
    this.limitUpdateListener = this.handleLimitUpdate.bind(this);
    this.nativeSendListener = this.handleDocumentClick.bind(this);
  }

  async init() {
    const initStart = performance.now();
    await super.init();
    if (!this.enabled) {
      return;
    }

    debugLog('usageTracker', 'Initializing Usage Tracker');

    try {
      await this.bridge.ensureInjected();
    } catch (error) {
      debugLog(
        'usageTracker',
        'Usage bridge injection failed; falling back to polling only',
        error
      );
    }

    document.addEventListener('visibilitychange', this.visibilityListener);
    window.addEventListener(USAGE_EVENT_NAMES.LIMIT_UPDATE, this.limitUpdateListener);
    document.addEventListener('click', this.nativeSendListener, true);

    this.setupObserver();
    this.startPolling();
    this.syncComposerUI();
    await this.refreshUsage({ force: true, reason: 'init' });

    trackEvent('perf_init', {
      module: 'usageTracker',
      init_ms: Math.round(performance.now() - initStart),
    });
  }

  destroy() {
    document.removeEventListener('visibilitychange', this.visibilityListener);
    window.removeEventListener(USAGE_EVENT_NAMES.LIMIT_UPDATE, this.limitUpdateListener);
    document.removeEventListener('click', this.nativeSendListener, true);
    ObserverManager.disconnect(this.observerId);
    this.stopPolling();
    this.clearPendingSendRefreshes();
    this.clearRevalidateTimer();
    this.clearRenderedUsage();
    this.currentContainer = null;
    this.currentMount = null;
    this.usageState = null;
    this.refreshInFlight = null;
    this.openedTooltipKinds.clear();
    this.awaitingUsageAfterSend = false;
    this.composerBusy = false;
    super.destroy();
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

  startPolling() {
    this.stopPolling();
    this.pollIntervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return;
      }

      void this.refreshUsage({ reason: 'poll' });
    }, USAGE_POLL_MS);
  }

  stopPolling() {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  clearPendingSendRefreshes() {
    this.pendingSendRefreshIds.forEach(timerId => {
      clearTimeout(timerId);
    });
    this.pendingSendRefreshIds.clear();
  }

  clearRevalidateTimer() {
    if (this.revalidateTimerId) {
      clearTimeout(this.revalidateTimerId);
      this.revalidateTimerId = null;
    }
  }

  reinitializeUI() {
    if (!this.enabled) {
      return;
    }

    this.syncComposerUI();
    void this.refreshUsage({ force: true, reason: 'route' });
  }

  syncComposerUI() {
    const container = this.adapter.findChatContainer();
    if (!container) {
      this.clearRenderedUsage();
      this.currentContainer = null;
      this.currentMount = null;
      this.composerBusy = false;
      this.awaitingUsageAfterSend = false;
      return;
    }

    const mount = this.adapter.getUsageMount(container);
    if (mount !== this.currentMount) {
      this.clearRenderedUsage();
      this.currentMount = mount;
    }

    this.currentContainer = container;

    const busy = this.adapter.isComposerBusy(container);
    if (this.awaitingUsageAfterSend && this.composerBusy && !busy) {
      this.awaitingUsageAfterSend = false;
      this.queueRefreshAfterSend(USAGE_REVALIDATE_MS);
    }
    this.composerBusy = busy;

    if (hasRenderableUsage(this.usageState)) {
      this.view.render(this.currentMount, this.usageState);
    }
  }

  clearRenderedUsage() {
    if (this.currentMount) {
      this.view.clear(this.currentMount);
    }
  }

  handleVisibilityChange() {
    if (document.visibilityState !== 'visible') {
      return;
    }

    if (
      !hasRenderableUsage(this.usageState) ||
      isUsageStateStale(this.usageState, USAGE_STALE_MS)
    ) {
      void this.refreshUsage({ force: true, reason: 'visible' });
    }
  }

  handleDocumentClick(event) {
    const container = this.currentContainer;
    if (!container) {
      return;
    }

    const sendButton = this.adapter.getNativeSendButton(container);
    if (!sendButton || !sendButton.contains(event.target)) {
      return;
    }

    this.awaitingUsageAfterSend = true;
    this.queueRefreshAfterSend(20_000);
    this.queueRefreshAfterSend(60_000);
  }

  handleLimitUpdate(event) {
    const nextState = normalizeMessageLimitPayload(event?.detail?.payload);
    if (!nextState) {
      return;
    }

    this.applyUsageState(nextState);
    this.clearPendingSendRefreshes();
    this.clearRevalidateTimer();
    this.revalidateTimerId = window.setTimeout(() => {
      this.revalidateTimerId = null;
      void this.refreshUsage({ force: true, reason: 'message_limit' });
    }, USAGE_REVALIDATE_MS);
  }

  queueRefreshAfterSend(delayMs) {
    const timerId = window.setTimeout(() => {
      this.pendingSendRefreshIds.delete(timerId);
      void this.refreshUsage({ force: true, reason: 'send_fallback' });
    }, delayMs);

    this.pendingSendRefreshIds.add(timerId);
  }

  refreshUsage({ force = false, reason = 'manual' } = {}) {
    const container = this.currentContainer || this.adapter.findChatContainer();
    if (!container) {
      return null;
    }

    if (!force && hasRenderableUsage(this.usageState) && !isUsageStateStale(this.usageState)) {
      return this.usageState;
    }

    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    const orgUuid = this.client.getActiveOrgId();
    if (!orgUuid) {
      debugLog('usageTracker', 'No active organization found; hiding usage indicator');
      this.usageState = null;
      this.clearRenderedUsage();
      return null;
    }

    const task = (async () => {
      try {
        debugLog('usageTracker', `Refreshing usage from /usage (${reason})`);
        const payload = await this.client.fetchUsage(orgUuid);
        const nextState = normalizeUsagePayload(payload);
        this.applyUsageState(nextState);
        this.clearPendingSendRefreshes();
        return nextState;
      } catch (error) {
        debugLog('usageTracker', 'Failed to refresh usage', error);
        return this.usageState;
      } finally {
        if (this.refreshInFlight === task) {
          this.refreshInFlight = null;
        }
      }
    })();

    this.refreshInFlight = task;
    return task;
  }

  applyUsageState(nextState) {
    if (!nextState) {
      return;
    }

    this.usageState = mergeUsageState(this.usageState, nextState);
    this.syncComposerUI();
  }

  handleTooltipOpen(kind) {
    if (!kind || this.openedTooltipKinds.has(kind)) {
      return;
    }

    this.openedTooltipKinds.add(kind);
    trackEvent('usage_tracker_tooltip_open', {
      module: 'usageTracker',
      method: 'hover',
      result: kind,
    });
  }
}
