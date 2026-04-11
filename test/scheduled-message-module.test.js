import test from 'node:test';
import assert from 'node:assert/strict';
import { setupDom } from '../test-support/dom.js';
import { cloneDefaultSettings } from '../src/config/defaultSettings.js';

const TEST_TAB_ID = 101;

function createComposerHtml({
  draftText = 'Ship this later',
  sendDisabled = false,
  attachmentState = 'absent',
} = {}) {
  const attachmentMarker =
    attachmentState === 'unknown'
      ? '<div data-schedule-attachment-state="unknown"></div>'
      : attachmentState === 'present'
        ? '<div data-schedule-attachment-state="present"></div>'
        : attachmentState === 'thumbnail'
          ? `
            <div class="overflow-hidden">
              <div class="p-3.5 pb-2.5">
                <div class="flex flex-col gap-2">
                  <div class="flex flex-row gap-3 overflow-x-auto">
                    <div class="relative">
                      <div class="group/thumbnail" data-testid="file-thumbnail">
                        <button type="button">
                          <h3>fig_00_research_design.svg</h3>
                        </button>
                        <button type="button" aria-label="Remove" aria-describedby="_r_file_">x</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `
          : attachmentState === 'imageThumbnail'
            ? `
              <div class="overflow-hidden">
                <div class="p-3.5 pb-2.5">
                  <div class="flex flex-col gap-2">
                    <div class="flex flex-row gap-3 overflow-x-auto">
                      <div class="relative group/thumbnail">
                        <div
                          data-testid="fig_09_network_2000s.png"
                          class="rounded-lg overflow-hidden"
                          style="width: 120px; height: 120px; min-width: 120px; min-height: 120px;"
                        >
                          <button type="button" class="relative bg-bg-000" style="width: 120px; height: 120px;">
                            <img
                              class="w-full h-full object-cover transition duration-400 opacity-1"
                              alt="fig_09_network_2000s.png"
                              src="/api/files/preview"
                            >
                          </button>
                        </div>
                        <button
                          type="button"
                          aria-label="Remove fig_09_network_2000s.png"
                          class="absolute -top-2 -left-2"
                        >
                          x
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            `
            : '';

  return `
    <div data-chat-input-container="true">
      <fieldset>
        <div class="bg-bg-000">
          <div class="w-full">
            <div data-testid="chat-input" contenteditable="true">${draftText}</div>
          </div>
          ${attachmentMarker}
          <div>
            <button type="button" aria-label="Add files, connectors, and more">+</button>
            <button type="button" data-testid="model-selector-dropdown">Model</button>
            <button type="button" aria-label="Use voice mode">Voice</button>
            <button type="submit" ${sendDisabled ? 'disabled' : ''}>Send</button>
          </div>
        </div>
      </fieldset>
    </div>
  `;
}

function createNewComposerHtml({ draftText = '', showSendButton = false } = {}) {
  const sendButton = showSendButton
    ? `<button type="button" aria-label="Send message">Send</button>`
    : '';

  return `
    <div class="!box-content flex flex-col bg-bg-000">
      <div class="flex flex-col m-3.5 gap-3">
        <div class="relative">
          <div class="w-full overflow-y-auto font-large break-words transition-opacity duration-200 max-h-96 min-h-[3rem] pl-[6px] pt-[6px]">
            <div data-testid="chat-input" contenteditable="true">${draftText}</div>
          </div>
          <div class="absolute inset-0 pointer-events-none overflow-hidden pl-1.5 pt-[5px]">
            <span class="block text-text-500">How can I help you today?</span>
          </div>
        </div>
        <div class="relative flex gap-2 w-full items-center">
          <div class="relative flex-1 flex items-center shrink min-w-0 gap-1">
            <div>
              <button type="button" aria-label="Add files, connectors, and more">+</button>
            </div>
            <div class="flex flex-row items-center min-w-0 gap-1"></div>
            <div class="text-text-400 text-xs ml-2"></div>
          </div>
          <div class="transition-all duration-200 ease-out">
            <div class="overflow-hidden shrink-0 p-1 -m-1">
              <button type="button" data-testid="model-selector-dropdown">Model</button>
            </div>
          </div>
          <div class="shrink-0 flex items-center w-8 z-10 justify-end">
            <div class="flex items-center gap-1 shrink-0">
              <div class="flex items-center rounded-lg transition-colors duration-200"></div>
              <button type="button" aria-label="Use voice mode">Voice</button>
              ${sendButton}
            </div>
          </div>
        </div>
        <div></div>
      </div>
    </div>
  `;
}

function isNewConversationUrl(rawUrl) {
  if (!rawUrl) {
    return false;
  }

  try {
    const url = new URL(rawUrl, window.location.origin);
    return url.pathname === '/new' || url.pathname.endsWith('/new');
  } catch {
    return String(rawUrl).endsWith('/new');
  }
}

function createChromeStub(backgroundState) {
  const runtimeListeners = new Set();
  const sentMessages = [];

  function getCurrentScheduleForUrl(conversationUrl) {
    if (!backgroundState.current) {
      return null;
    }

    if (backgroundState.current.conversationUrl === conversationUrl) {
      return backgroundState.current;
    }

    if (
      backgroundState.current.sourceTabId === TEST_TAB_ID &&
      isNewConversationUrl(backgroundState.current.conversationUrl) &&
      !isNewConversationUrl(conversationUrl)
    ) {
      backgroundState.current = {
        ...backgroundState.current,
        conversationUrl,
      };
      return backgroundState.current;
    }

    return null;
  }

  return {
    sentMessages,
    chrome: {
      runtime: {
        lastError: null,
        sendMessage(message, callback) {
          sentMessages.push(message);

          const respond = payload => {
            callback?.(payload);
          };

          if (message.type === 'SCHEDULE_GET_FOR_CONVERSATION') {
            respond({ schedule: getCurrentScheduleForUrl(message.conversationUrl) });
            return;
          }

          if (message.type === 'SCHEDULE_CREATE_OR_UPDATE') {
            backgroundState.current = {
              id: 'sched-1',
              conversationUrl: window.location.href,
              snapshotText: message.snapshotText,
              scheduledForMs: message.scheduledForMs,
              hasAttachmentExpectation: message.hasAttachmentExpectation,
              status: 'pending',
              retryCount: 0,
              lastErrorCode: null,
              sourceTabId: TEST_TAB_ID,
            };
            respond({ schedule: backgroundState.current });
            return;
          }

          if (message.type === 'SCHEDULE_CANCEL') {
            const schedule = message.id
              ? backgroundState.current?.id === message.id
                ? backgroundState.current
                : null
              : getCurrentScheduleForUrl(message.conversationUrl);
            if (!schedule) {
              respond({ cancelled: false });
              return;
            }
            backgroundState.current = null;
            respond({ cancelled: true });
            return;
          }

          if (message.type === 'SCHEDULE_SEND_NOW') {
            const schedule = message.id
              ? backgroundState.current?.id === message.id
                ? backgroundState.current
                : null
              : getCurrentScheduleForUrl(message.conversationUrl);
            if (!schedule) {
              respond({ status: 'cancelled' });
              return;
            }
            backgroundState.current = null;
            respond({ status: 'sent' });
            return;
          }

          if (message.type === 'SCHEDULE_EXECUTE_RESULT') {
            backgroundState.lastResult = message;
            if (message.outcome?.status === 'failed') {
              backgroundState.current = {
                ...backgroundState.current,
                status: 'failed',
                lastErrorCode: message.outcome.code,
              };
            }
            respond({ acknowledged: true });
            return;
          }

          respond({});
        },
        onMessage: {
          addListener(listener) {
            runtimeListeners.add(listener);
          },
          removeListener(listener) {
            runtimeListeners.delete(listener);
          },
        },
      },
    },
    runtimeListeners,
  };
}

async function setupModuleTestEnvironment(
  html,
  backgroundState = { current: null },
  { urlPath = '/chat/test-thread' } = {}
) {
  const cleanupDom = setupDom(html);
  const originalChrome = globalThis.chrome;
  const originalConfirm = window.confirm;
  const originalAlert = window.alert;

  window.history.replaceState({}, '', urlPath);

  const chromeStub = createChromeStub(backgroundState);
  globalThis.chrome = chromeStub.chrome;
  window.confirm = () => true;
  window.alert = () => {};

  const [
    { default: BaseModule },
    { default: DOMUtils },
    { default: ObserverManager },
    { default: ScheduledMessageModule },
    { default: navigationInterceptor },
    { storeSyncChannel },
  ] = await Promise.all([
    import('../src/modules/BaseModule.js'),
    import('../src/utils/DOMUtils.js'),
    import('../src/managers/ObserverManager.js'),
    import('../src/modules/ScheduledMessageModule.js'),
    import('../src/core/NavigationInterceptor.js'),
    import('../src/utils/StoreSyncChannel.js'),
  ]);

  const originalBaseInit = BaseModule.prototype.init;
  const originalDomConversationCheck = DOMUtils.isOnConversationPage;
  const originalObserve = ObserverManager.observe;
  const originalDisconnect = ObserverManager.disconnect;

  BaseModule.prototype.init = function initStub() {
    this.enabled = true;
    this.initialized = true;
    this.unsubscribers = [];
  };
  DOMUtils.isOnConversationPage = () => true;
  ObserverManager.observe = () => {};
  ObserverManager.disconnect = () => {};

  const module = new ScheduledMessageModule();

  return {
    module,
    backgroundState,
    sentMessages: chromeStub.sentMessages,
    runtimeListeners: chromeStub.runtimeListeners,
    cleanup() {
      module.destroy();
      BaseModule.prototype.init = originalBaseInit;
      DOMUtils.isOnConversationPage = originalDomConversationCheck;
      ObserverManager.observe = originalObserve;
      ObserverManager.disconnect = originalDisconnect;
      storeSyncChannel.destroy();
      navigationInterceptor.destroy();
      window.confirm = originalConfirm;
      window.alert = originalAlert;
      if (originalChrome === undefined) {
        delete globalThis.chrome;
      } else {
        globalThis.chrome = originalChrome;
      }
      cleanupDom();
    },
  };
}

test('module injects a schedule button once and locks the composer after scheduling', async () => {
  const env = await setupModuleTestEnvironment(createComposerHtml());

  try {
    await env.module.init();
    env.module.syncComposerUI();

    assert.equal(document.querySelectorAll('.cl-schedule-button').length, 1);

    await env.module.createOrUpdateSchedule(Date.now() + 300000);

    const editor = document.querySelector('[data-testid="chat-input"]');
    const addFiles = document.querySelector('[aria-label="Add files, connectors, and more"]');

    assert.equal(editor.getAttribute('contenteditable'), 'false');
    assert.equal(addFiles.disabled, true);
    assert.match(
      document.querySelector('.cl-schedule-status')?.textContent || '',
      /Scheduled send active/
    );
  } finally {
    env.cleanup();
  }
});

test('new chat composer injects the schedule button without relying on data-chat-input-container', async () => {
  const env = await setupModuleTestEnvironment(
    createNewComposerHtml(),
    { current: null },
    { urlPath: '/new' }
  );

  try {
    await env.module.init();
    env.module.syncComposerUI();

    assert.equal(document.querySelectorAll('.cl-schedule-button').length, 1);
  } finally {
    env.cleanup();
  }
});

test('scheduled message stays active when a /new draft becomes a real conversation on the same tab', async () => {
  const env = await setupModuleTestEnvironment(
    createNewComposerHtml({ draftText: 'Ship this later', showSendButton: true }),
    { current: null },
    { urlPath: '/new' }
  );

  try {
    await env.module.init();
    env.module.syncComposerUI();

    assert.equal(document.querySelectorAll('.cl-schedule-button').length, 1);

    await env.module.createOrUpdateSchedule(Date.now() + 300000);
    assert.equal(env.backgroundState.current?.conversationUrl, 'https://example.com/new');

    window.history.replaceState({}, '', '/chat/generated-thread');
    await env.module.reinitializeUI();

    assert.equal(
      env.module.currentSchedule?.conversationUrl,
      'https://example.com/chat/generated-thread'
    );
    assert.match(
      document.querySelector('.cl-schedule-status')?.textContent || '',
      /Scheduled send active/
    );
  } finally {
    env.cleanup();
  }
});

test('scheduled message defaults to disabled for new settings', () => {
  const defaults = cloneDefaultSettings();

  assert.equal(defaults.scheduledMessage.enabled, false);
  assert.equal('showFloatingUI' in defaults.scheduledMessage, false);
});

test('scheduled message emits perf_init without duplicating lifecycle analytics from content', async () => {
  const env = await setupModuleTestEnvironment(createComposerHtml());

  try {
    await env.module.init();
    await env.module.createOrUpdateSchedule(Date.now() + 300000);
    await env.module.cancelSchedule();

    const analyticsMessages = env.sentMessages.filter(
      message => message.type === 'ANALYTICS_EVENT'
    );
    const analyticsNames = analyticsMessages.map(message => message.name);

    assert.equal(analyticsNames.includes('perf_init'), true);
    assert.equal(
      analyticsNames.some(name => name.startsWith('scheduled_message_')),
      false
    );
  } finally {
    env.cleanup();
  }
});

test('empty composer does not surface a failed status when scheduling is invalid', async () => {
  const env = await setupModuleTestEnvironment(
    createComposerHtml({ draftText: '', sendDisabled: true, attachmentState: 'absent' })
  );

  try {
    let alerts = 0;
    window.alert = () => {
      alerts += 1;
    };

    await env.module.init();
    await env.module.createOrUpdateSchedule(Date.now() + 300000);

    assert.equal(alerts, 1);
    assert.equal(document.querySelector('.cl-schedule-status'), null);
    assert.equal(
      env.sentMessages.some(message => message.type === 'SCHEDULE_CREATE_OR_UPDATE'),
      false
    );
  } finally {
    env.cleanup();
  }
});

test('attachments-only composer can be scheduled without a text draft', async () => {
  const env = await setupModuleTestEnvironment(
    createComposerHtml({ draftText: '', attachmentState: 'thumbnail' })
  );

  try {
    await env.module.init();
    await env.module.createOrUpdateSchedule(Date.now() + 300000);

    const createMessage = env.sentMessages.find(
      message => message.type === 'SCHEDULE_CREATE_OR_UPDATE'
    );

    assert.equal(createMessage?.snapshotText, '');
    assert.equal(createMessage?.hasAttachmentExpectation, true);
    assert.match(
      document.querySelector('.cl-schedule-status')?.textContent || '',
      /Scheduled send active/
    );
  } finally {
    env.cleanup();
  }
});

test('image attachments-only composer can be scheduled without a text draft', async () => {
  const env = await setupModuleTestEnvironment(
    createComposerHtml({ draftText: '', attachmentState: 'imageThumbnail' })
  );

  try {
    await env.module.init();
    await env.module.createOrUpdateSchedule(Date.now() + 300000);

    const createMessage = env.sentMessages.find(
      message => message.type === 'SCHEDULE_CREATE_OR_UPDATE'
    );

    assert.equal(createMessage?.snapshotText, '');
    assert.equal(createMessage?.hasAttachmentExpectation, true);
    assert.match(
      document.querySelector('.cl-schedule-status')?.textContent || '',
      /Scheduled send active/
    );
  } finally {
    env.cleanup();
  }
});

test('schedule popover clamps itself inside the viewport', async () => {
  const cleanup = setupDom('<button id="anchor">Anchor</button>');
  const originalInnerHeight = window.innerHeight;
  const originalInnerWidth = window.innerWidth;
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

  try {
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 250,
    });

    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRectStub() {
      if (this.classList?.contains('cl-schedule-popover')) {
        return {
          width: 240,
          height: 180,
          top: 0,
          left: 0,
          right: 240,
          bottom: 180,
          x: 0,
          y: 0,
          toJSON() {
            return {};
          },
        };
      }

      return originalGetBoundingClientRect.call(this);
    };

    const anchor = document.getElementById('anchor');
    anchor.getBoundingClientRect = () => ({
      width: 32,
      height: 32,
      top: 180,
      bottom: 212,
      left: 220,
      right: 252,
      x: 220,
      y: 180,
      toJSON() {
        return {};
      },
    });

    const { default: SchedulePopover } =
      await import('../src/modules/ScheduledMessageModule/SchedulePopover.js');
    const popover = new SchedulePopover();

    popover.open({
      anchorButton: anchor,
      hasPendingSchedule: false,
      onPresetSelect() {},
      onDatetimeSelect() {},
      onClose() {},
    });

    assert.equal(popover.element.style.left, '12px');
    assert.equal(popover.element.style.top, '12px');
    assert.equal(popover.element.style.maxHeight, '176px');

    popover.close();
  } finally {
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    });
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    cleanup();
  }
});

test('cancel button works on first click and unlocks the composer', async () => {
  const env = await setupModuleTestEnvironment(createComposerHtml());

  try {
    await env.module.init();
    await env.module.createOrUpdateSchedule(Date.now() + 300000);
    env.module.syncComposerUI();
    env.module.syncComposerUI();

    let composerClicks = 0;
    document.querySelector('fieldset')?.addEventListener('click', () => {
      composerClicks += 1;
    });

    const cancelButton = document.querySelector('[data-action="cancel"]');
    cancelButton.dispatchEvent(
      new window.MouseEvent('pointerdown', { bubbles: true, cancelable: true })
    );
    cancelButton.dispatchEvent(
      new window.MouseEvent('mousedown', { bubbles: true, cancelable: true })
    );
    cancelButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    const editor = document.querySelector('[data-testid="chat-input"]');
    const addFiles = document.querySelector('[aria-label="Add files, connectors, and more"]');

    assert.equal(editor.getAttribute('contenteditable'), 'true');
    assert.equal(addFiles.disabled, false);
    assert.equal(document.querySelector('.cl-schedule-status'), null);
    assert.equal(composerClicks, 0);
  } finally {
    env.cleanup();
  }
});

test('status view is not remounted on repeated syncs for the same active schedule', async () => {
  const env = await setupModuleTestEnvironment(createComposerHtml());

  try {
    await env.module.init();
    await env.module.createOrUpdateSchedule(Date.now() + 300000);

    const firstStatusNode = document.querySelector('.cl-schedule-status');
    const firstCancelNode = document.querySelector('[data-action="cancel"]');

    env.module.syncComposerUI();
    env.module.syncComposerUI();

    assert.equal(document.querySelector('.cl-schedule-status'), firstStatusNode);
    assert.equal(document.querySelector('[data-action="cancel"]'), firstCancelNode);
  } finally {
    env.cleanup();
  }
});

test('reschedule button opens the popover on first click', async () => {
  const env = await setupModuleTestEnvironment(createComposerHtml());

  try {
    await env.module.init();
    await env.module.createOrUpdateSchedule(Date.now() + 300000);
    env.module.syncComposerUI();

    const rescheduleButton = document.querySelector('[data-action="reschedule"]');
    rescheduleButton.dispatchEvent(
      new window.MouseEvent('pointerdown', { bubbles: true, cancelable: true })
    );
    rescheduleButton.dispatchEvent(
      new window.MouseEvent('click', { bubbles: true, cancelable: true })
    );

    assert.ok(document.querySelector('.cl-schedule-popover'));
  } finally {
    env.cleanup();
  }
});

test('rehydration fails fast when the composer draft no longer matches the stored snapshot', async () => {
  const env = await setupModuleTestEnvironment(createComposerHtml({ draftText: 'Changed draft' }));

  try {
    env.backgroundState.current = {
      id: 'sched-2',
      conversationUrl: window.location.href,
      snapshotText: 'Original draft',
      scheduledForMs: Date.now() + 300000,
      hasAttachmentExpectation: false,
      status: 'pending',
      retryCount: 0,
      lastErrorCode: null,
    };

    await env.module.init();

    assert.equal(env.backgroundState.lastResult?.outcome?.code, 'draft_mismatch');
    assert.match(env.module.buildFailureSummary(), /locked composer/i);
    assert.match(document.querySelector('.cl-schedule-status')?.textContent || '', /failed/i);
  } finally {
    env.cleanup();
  }
});

test('attachment ambiguity requires user confirmation before scheduling', async () => {
  const env = await setupModuleTestEnvironment(createComposerHtml({ attachmentState: 'unknown' }));
  const originalConfirm = window.confirm;

  try {
    await env.module.init();

    let confirmations = 0;
    window.confirm = () => {
      confirmations += 1;
      return false;
    };

    await env.module.createOrUpdateSchedule(Date.now() + 300000);
    assert.equal(
      env.sentMessages.some(message => message.type === 'SCHEDULE_CREATE_OR_UPDATE'),
      false
    );

    window.confirm = () => {
      confirmations += 1;
      return true;
    };

    await env.module.createOrUpdateSchedule(Date.now() + 300000);

    const createMessage = env.sentMessages.find(
      message => message.type === 'SCHEDULE_CREATE_OR_UPDATE'
    );
    assert.equal(confirmations, 2);
    assert.equal(createMessage?.hasAttachmentExpectation, true);
  } finally {
    window.confirm = originalConfirm;
    env.cleanup();
  }
});

test('active schedules trigger a beforeunload warning', async () => {
  const env = await setupModuleTestEnvironment(createComposerHtml());

  try {
    await env.module.init();
    await env.module.createOrUpdateSchedule(Date.now() + 300000);

    const event = {
      returnValue: '',
      preventDefaultCalled: false,
      preventDefault() {
        this.preventDefaultCalled = true;
      },
    };

    const result = env.module.handleBeforeUnload(event);

    assert.equal(result, 'A scheduled send is still pending.');
    assert.equal(event.returnValue, 'A scheduled send is still pending.');
    assert.equal(event.preventDefaultCalled, true);
  } finally {
    env.cleanup();
  }
});

test('disabling the module cancels active schedules instead of surfacing a failure on re-enable', async () => {
  const env = await setupModuleTestEnvironment(createComposerHtml());

  try {
    await env.module.init();
    await env.module.createOrUpdateSchedule(Date.now() + 300000);

    env.module.previousSettings = { scheduledMessage: { enabled: true } };
    env.module.settings = { scheduledMessage: { enabled: false } };
    env.module.destroy();
    await env.module.pendingDisableCancellation;

    assert.equal(
      env.sentMessages.some(message => message.type === 'SCHEDULE_CANCEL'),
      true
    );
    assert.equal(env.backgroundState.current, null);

    env.module.previousSettings = { scheduledMessage: { enabled: false } };
    env.module.settings = { scheduledMessage: { enabled: true } };
    await env.module.init();

    assert.equal(document.querySelector('.cl-schedule-status'), null);
    assert.equal(env.module.buildFailureSummary(), '');
  } finally {
    env.cleanup();
  }
});
