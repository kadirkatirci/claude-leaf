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

function runChecks(options = {}) {
  const checks = [];
  const pageType = detectPageType(window.location.pathname);

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
    const main = document.querySelector('main, [role="main"]');
    const messages = document.querySelectorAll(
      '[data-test-render-count], [data-testid*="conversation-turn"], [data-testid*="message"]'
    );
    checks.push(
      check(
        'main_container',
        !!main,
        'high',
        main ? 'Main container found' : 'Main container missing'
      )
    );
    checks.push(
      check(
        'message_nodes',
        messages.length > 0 || pageType !== 'conversation',
        'high',
        `Message node count: ${messages.length}`,
        { count: messages.length }
      )
    );
  }

  if (options.editHistory) {
    const versionContainer = document.querySelector('.inline-flex.items-center.gap-1');
    const retryPath = document.querySelector('button svg path[d*="M10.3857"]');
    checks.push(
      check(
        'version_container_class',
        !!versionContainer || pageType !== 'conversation',
        'medium',
        versionContainer ? 'Version container found' : 'Version container not found on this view'
      )
    );
    checks.push(
      check(
        'retry_icon_signature',
        !!retryPath || pageType !== 'conversation',
        'low',
        retryPath
          ? 'Retry icon signature found'
          : 'Retry icon signature not found in current DOM snapshot'
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
      hasMain: !!document.querySelector('main, [role="main"]'),
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
  const container = document.querySelector('main, [role="main"]') || document.body;
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
