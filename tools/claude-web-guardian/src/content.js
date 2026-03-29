function detectPageType(pathname) {
  if (pathname === '/new' || pathname.endsWith('/new')) {
    return 'new_chat';
  }
  if (/\/project\/[^/]+\/chat\/[^/]+/.test(pathname)) {
    return 'project_chat';
  }
  if (/\/project\/[^/]+/.test(pathname) && !pathname.includes('/chat/')) {
    return 'project';
  }
  if (/\/chat\/[^/]+/.test(pathname)) {
    return 'conversation';
  }
  if (pathname.startsWith('/settings')) {
    return 'settings';
  }
  return 'other';
}

function check(id, pass, severity, message, details = null) {
  return { id, pass: !!pass, severity, message, details };
}

const MESSAGE_SELECTOR =
  '[data-test-render-count], [data-testid*="conversation-turn"], [data-testid*="message"]';
const PROMPT_INPUT_SELECTOR =
  '[data-testid="chat-input"], [data-testid="prompt-input"], textarea[placeholder]';
const VERSION_PATTERN = /^(\d+)\s*\/\s*(\d+)$/;

function getExplicitMain() {
  return document.querySelector('main, [role="main"]');
}

function getContentRoot() {
  return getExplicitMain() || document.body;
}

function getMessageNodes(root = document) {
  return Array.from(root.querySelectorAll(MESSAGE_SELECTOR));
}

function parseVersionLabel(text) {
  const match = text.trim().match(VERSION_PATTERN);
  if (!match) {
    return null;
  }

  return {
    label: `${match[1]} / ${match[2]}`,
    current: Number(match[1]),
    total: Number(match[2]),
  };
}

function collectVersionSignals(root = document) {
  const seen = new Set();
  const signals = [];

  function addSignal(element, source) {
    if (!element || seen.has(element)) {
      return;
    }

    const parsed = parseVersionLabel(element.textContent || '');
    if (!parsed) {
      return;
    }

    seen.add(element);
    signals.push({
      ...parsed,
      source,
    });
  }

  root.querySelectorAll('.inline-flex.items-center.gap-1 span').forEach(span => {
    addSignal(span, 'version_container');
  });

  root.querySelectorAll('span').forEach(span => {
    if (span.closest('[data-testid="user-message"]')) {
      return;
    }
    addSignal(span, 'span_fallback');
  });

  return signals;
}

function findRetryControl(root = document) {
  const labelledControl = root.querySelector('button[aria-label="Retry"], [aria-label="Retry"]');
  if (labelledControl) {
    return { element: labelledControl, strategy: 'aria_label' };
  }

  const iconPath = root.querySelector('button svg path[d*="M10.3857"]');
  if (iconPath) {
    return { element: iconPath.closest('button') || iconPath, strategy: 'path_signature' };
  }

  return null;
}

function runChecks(options = {}) {
  const checks = [];
  const pageType = detectPageType(window.location.pathname);
  const isConversationLike = pageType === 'conversation' || pageType === 'project_chat';
  const explicitMain = getExplicitMain();
  const contentRoot = getContentRoot();
  const messages = getMessageNodes(contentRoot);
  const promptInput = document.querySelector(PROMPT_INPUT_SELECTOR);
  const hasViableContent =
    !!explicitMain ||
    (isConversationLike
      ? messages.length > 0
      : pageType === 'new_chat'
        ? !!promptInput
        : !!contentRoot);
  const contentStrategy = explicitMain ? 'main' : hasViableContent ? 'body_fallback' : 'missing';

  if (options.routes) {
    checks.push(
      check(
        'route_detection',
        ['new_chat', 'project_chat', 'project', 'conversation', 'settings', 'other'].includes(
          pageType
        ),
        'high',
        `Route detection resolved as ${pageType}`,
        { pathname: window.location.pathname }
      )
    );
  }

  if (options.domCore) {
    checks.push(
      check(
        'main_container',
        hasViableContent,
        'high',
        explicitMain
          ? 'Main container found'
          : hasViableContent
            ? pageType === 'new_chat'
              ? 'Main container missing; prompt input resolved via body fallback'
              : 'Main container missing; page content resolved via body fallback'
            : 'Main container missing and no viable fallback content found',
        {
          strategy: contentStrategy,
          hasMain: !!explicitMain,
          messageCount: messages.length,
          hasPromptInput: !!promptInput,
        }
      )
    );
    checks.push(
      check(
        'message_nodes',
        messages.length > 0 || !isConversationLike,
        'high',
        `Message node count: ${messages.length}`,
        { count: messages.length }
      )
    );
  }

  if (options.editHistory) {
    const versionSignals = collectVersionSignals(contentRoot);
    const editedPromptSignals = versionSignals.filter(signal => signal.total > 1);
    const hasVersionContainer = versionSignals.some(
      signal => signal.source === 'version_container'
    );
    const retryControl = findRetryControl(contentRoot);
    checks.push(
      check(
        'version_container_class',
        !isConversationLike || editedPromptSignals.length === 0 || hasVersionContainer,
        'medium',
        !isConversationLike
          ? 'Version container check skipped outside conversation views'
          : editedPromptSignals.length === 0
            ? 'No edited prompts detected; version container not required'
            : hasVersionContainer
              ? 'Version container found for edited prompt UI'
              : 'Edited prompts detected but version container class is missing',
        {
          editedPromptCount: editedPromptSignals.length,
          versionSignalCount: versionSignals.length,
          fallbackOnly: editedPromptSignals.length > 0 && !hasVersionContainer,
        }
      )
    );
    checks.push(
      check(
        'retry_icon_signature',
        !isConversationLike || editedPromptSignals.length === 0 || !!retryControl,
        'low',
        !isConversationLike
          ? 'Retry control check skipped outside conversation views'
          : editedPromptSignals.length === 0
            ? 'No edited prompts detected; retry control not required'
            : retryControl
              ? `Retry control found via ${retryControl.strategy}`
              : 'Edited prompts detected but retry control signature is missing',
        {
          editedPromptCount: editedPromptSignals.length,
          strategy: retryControl?.strategy || null,
        }
      )
    );
  }

  if (options.sidebar) {
    const sidebarNav = document.querySelector('nav[aria-label="Sidebar"]');
    const sidebarItem = document.querySelector('a[data-dd-action-name="sidebar-nav-item"]');
    checks.push(
      check(
        'sidebar_nav',
        !!sidebarNav,
        'medium',
        sidebarNav ? 'Sidebar nav found' : 'Sidebar nav missing'
      )
    );
    checks.push(
      check(
        'sidebar_nav_item',
        !!sidebarItem,
        'low',
        sidebarItem ? 'Sidebar nav item selector found' : 'Sidebar nav item selector missing'
      )
    );
  }

  if (options.theme) {
    const htmlMode = document.documentElement.getAttribute('data-mode');
    const sampleTokenClass = document.querySelector(
      '.bg-bg-100, .text-text-000, .border-border-300'
    );
    checks.push(
      check(
        'html_data_mode',
        htmlMode === 'dark' || htmlMode === 'light' || htmlMode === null,
        'low',
        `html[data-mode]=${htmlMode || 'null'}`
      )
    );
    checks.push(
      check(
        'token_class_presence',
        !!sampleTokenClass,
        'low',
        sampleTokenClass
          ? 'At least one theme token class exists in DOM'
          : 'No sample theme token class found in current viewport'
      )
    );
  }

  return {
    checks,
    pageMeta: {
      pageType,
      pathname: window.location.pathname,
      title: document.title,
      hasMain: !!explicitMain,
      contentStrategy,
      messageCount: messages.length,
      timestamp: Date.now(),
    },
  };
}

function sanitizeHtml(root) {
  const clone = root.cloneNode(true);

  clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());

  const textTargets = clone.querySelectorAll(
    '[data-testid="user-message"], .font-claude-message, p, h1, h2, h3, h4, h5, h6, li, code, pre'
  );
  let textIndex = 0;
  textTargets.forEach(el => {
    if (!el.textContent || !el.textContent.trim()) {
      return;
    }
    textIndex += 1;
    el.textContent = `{{TEXT_${String(textIndex).padStart(4, '0')}}}`;
  });

  clone.querySelectorAll('[href]').forEach(el => {
    const href = el.getAttribute('href') || '';
    if (!href.startsWith('/')) {
      el.setAttribute('href', '#redacted');
    }
  });

  clone.querySelectorAll('[src]').forEach(el => {
    el.setAttribute('src', '#redacted');
  });

  return clone.outerHTML;
}

function captureFixture() {
  const container = getContentRoot();
  const sanitizedHtml = sanitizeHtml(container);

  return {
    capturedAt: Date.now(),
    url: window.location.href,
    pageType: detectPageType(window.location.pathname),
    selectorStats: {
      messages: document.querySelectorAll('[data-test-render-count]').length,
      conversationTurns: document.querySelectorAll('[data-testid*="conversation-turn"]').length,
      userMessages: document.querySelectorAll('[data-testid="user-message"]').length,
      sidebarNav: !!document.querySelector('nav[aria-label="Sidebar"]'),
    },
    html: sanitizedHtml,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'CWG_RUN_CANARY') {
    const options = message.payload?.checks || {};
    sendResponse(runChecks(options));
    return true;
  }

  if (message?.type === 'CWG_CAPTURE_FIXTURE') {
    sendResponse(captureFixture());
    return true;
  }

  return false;
});
