import { JSDOM } from 'jsdom';

const VERSION_PATTERN = /^\s*\d+\s*\/\s*\d+\s*$/;
const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

const PRESERVED_ATTRIBUTES = new Set([
  'class',
  'contenteditable',
  'd',
  'dir',
  'fill',
  'height',
  'href',
  'id',
  'name',
  'placeholder',
  'role',
  'rows',
  'stroke',
  'style',
  'tabindex',
  'title',
  'type',
  'value',
  'viewBox',
  'width',
]);

const DROP_TAGS = 'script, style, noscript, iframe, link, meta, base, source, video, audio';

function findLowestCommonAncestor(first, second) {
  if (!first || !second) {
    return null;
  }

  const seen = new Set();
  let current = first;
  while (current) {
    seen.add(current);
    current = current.parentElement;
  }

  current = second;
  while (current) {
    if (seen.has(current)) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

function findConversationRoot(document) {
  const explicitRoot = document.querySelector('main, [role="main"], #main-content');
  if (explicitRoot) {
    return explicitRoot.cloneNode(true);
  }

  const firstMessage = document.querySelector(
    '[data-test-render-count], [data-testid*="conversation-turn"]'
  );
  const composer =
    document.querySelector('[data-chat-input-container="true"]') ||
    document.querySelector(
      '[data-testid="chat-input"], [data-testid="prompt-input"], textarea, [contenteditable="true"][role="textbox"]'
    );

  if (firstMessage && composer) {
    const composerRoot =
      composer.closest('[data-chat-input-container="true"]') ||
      composer.closest('fieldset') ||
      composer;
    const ancestor = findLowestCommonAncestor(firstMessage, composerRoot);
    if (ancestor) {
      return ancestor.cloneNode(true);
    }
  }

  return document.body.cloneNode(true);
}

function findSidebarRoot(document) {
  const nav = document.querySelector('nav[aria-label="Sidebar"]');
  if (!nav) {
    return null;
  }

  const wrapper = nav.closest('.fixed, .sticky, .shrink-0') || nav;
  return wrapper.cloneNode(true);
}

function sanitizeAttributes(root) {
  root.querySelectorAll(DROP_TAGS).forEach(node => node.remove());

  root.querySelectorAll('*').forEach(node => {
    for (const attribute of [...node.attributes]) {
      const { name, value } = attribute;

      if (name.startsWith('on')) {
        node.removeAttribute(name);
        continue;
      }

      const keep =
        PRESERVED_ATTRIBUTES.has(name) ||
        name.startsWith('aria-') ||
        name.startsWith('data-') ||
        name === 'alt';

      if (!keep) {
        node.removeAttribute(name);
        continue;
      }

      if (name === 'href') {
        node.setAttribute(name, rewriteHref(value));
        continue;
      }

      if (name === 'id' || name.startsWith('data-') || name === 'value' || name === 'title') {
        node.setAttribute(name, redactAttributeValue(value));
      }
    }
  });
}

function rewriteHref(value) {
  const href = String(value || '').trim();
  if (!href) {
    return '#';
  }

  if (href.startsWith('/new') || href.startsWith('/recents')) {
    return href;
  }

  if (href.startsWith('/chat/')) {
    return `/chat/redacted-link-${Math.abs(hashCode(href))}`;
  }

  if (href.startsWith('https://claude.ai/chat/')) {
    return `/chat/redacted-link-${Math.abs(hashCode(href))}`;
  }

  if (href.startsWith('http://') || href.startsWith('https://')) {
    return `https://example.invalid/redacted-link-${Math.abs(hashCode(href))}`;
  }

  return '#';
}

function redactAttributeValue(value) {
  return String(value || '')
    .replace(UUID_PATTERN, 'redacted-id')
    .replace(/https?:\/\/\S+/gi, 'https://example.invalid/redacted');
}

function replaceElementText(element, value) {
  if (!element) {
    return;
  }

  element.textContent = value;
}

function redactSidebar(sidebarRoot) {
  if (!sidebarRoot) {
    return;
  }

  const sectionTitles = sidebarRoot.querySelectorAll('h1, h2, h3, h4, p');
  sectionTitles.forEach((element, index) => {
    if (index === 0) {
      replaceElementText(element, 'Claude');
      return;
    }

    if (/^h\d$/i.test(element.tagName)) {
      replaceElementText(element, `Section ${index}`);
    } else {
      replaceElementText(element, 'Fixture workspace');
    }
  });

  sidebarRoot.querySelectorAll('a[href]').forEach((anchor, index) => {
    anchor.setAttribute('href', `/chat/redacted-sidebar-${index + 1}`);
    replaceElementText(anchor, `Redacted chat ${index + 1}`);
  });

  sidebarRoot.querySelectorAll('[aria-label], [title]').forEach(element => {
    if (element.hasAttribute('aria-label')) {
      element.setAttribute('aria-label', 'Redacted sidebar action');
    }

    if (element.hasAttribute('title')) {
      element.setAttribute('title', 'Redacted sidebar action');
    }
  });
}

function redactConversationChrome(conversationRoot) {
  if (!conversationRoot) {
    return;
  }

  const titleButton = conversationRoot.querySelector('[data-testid="chat-title-button"]');
  if (titleButton) {
    replaceElementText(titleButton, 'Redacted conversation title');
    titleButton.setAttribute('aria-label', 'Redacted conversation title');
    titleButton.setAttribute('title', 'Redacted conversation title');
  }

  const menuTrigger = conversationRoot.querySelector('[data-testid="chat-menu-trigger"]');
  if (menuTrigger) {
    menuTrigger.setAttribute('aria-label', 'More options for redacted conversation');
    menuTrigger.setAttribute('title', 'More options for redacted conversation');
  }
}

function redactMessageContainer(container, messageIndex, userIndexRef, assistantIndexRef) {
  const isUser = Boolean(container.querySelector('[data-testid="user-message"]'));
  const roleIndex = isUser ? ++userIndexRef.current : ++assistantIndexRef.current;
  let detailIndex = 0;

  const walker = container.ownerDocument.createTreeWalker(
    container,
    container.ownerDocument.defaultView.NodeFilter.SHOW_TEXT
  );

  while (true) {
    const node = walker.nextNode();
    if (!node) {
      break;
    }

    const text = node.nodeValue?.replace(/\s+/g, ' ').trim() || '';
    if (!text) {
      continue;
    }

    const parent = node.parentElement;
    if (!parent) {
      continue;
    }

    if (parent.closest('.inline-flex.items-center.gap-1') && VERSION_PATTERN.test(text)) {
      continue;
    }

    if (parent.closest('button, svg')) {
      continue;
    }

    detailIndex += 1;
    node.nodeValue = buildRedactedText(parent, {
      isUser,
      roleIndex,
      detailIndex,
      messageIndex,
    });
  }
}

function buildRedactedText(parent, details) {
  const { isUser, roleIndex, detailIndex, messageIndex } = details;

  if (parent.closest('pre, code')) {
    return `// redacted code block ${messageIndex}`;
  }

  if (/^H[1-6]$/.test(parent.tagName)) {
    return `Redacted heading ${messageIndex}.${detailIndex}`;
  }

  if (parent.closest('blockquote')) {
    return `Redacted quote ${messageIndex}.${detailIndex}`;
  }

  if (parent.closest('li')) {
    return `Redacted list item ${messageIndex}.${detailIndex}`;
  }

  if (parent.closest('a')) {
    return `Redacted link ${messageIndex}.${detailIndex}`;
  }

  if (isUser) {
    return detailIndex === 1
      ? `Redacted user prompt ${roleIndex}`
      : `Redacted user detail ${roleIndex}.${detailIndex}`;
  }

  return detailIndex === 1
    ? `Redacted assistant response ${roleIndex}`
    : `Redacted assistant detail ${roleIndex}.${detailIndex}`;
}

function redactConversationContent(conversationRoot) {
  const userIndexRef = { current: 0 };
  const assistantIndexRef = { current: 0 };

  const messageContainers = conversationRoot.querySelectorAll(
    '[data-test-render-count], [data-testid*="conversation-turn"]'
  );

  messageContainers.forEach((container, index) => {
    redactMessageContainer(container, index + 1, userIndexRef, assistantIndexRef);
  });

  conversationRoot.querySelectorAll('a[href]').forEach(anchor => {
    anchor.setAttribute('href', rewriteHref(anchor.getAttribute('href')));
  });

  const composer =
    conversationRoot.querySelector('[data-testid="chat-input"], [data-testid="prompt-input"]') ||
    conversationRoot.querySelector('textarea, [contenteditable="true"][role="textbox"]');

  if (composer) {
    if ('value' in composer) {
      composer.value = '';
    }

    composer.textContent = '';
    composer.setAttribute('placeholder', composer.getAttribute('placeholder') || 'Reply...');
  }
}

function hashCode(value) {
  let hash = 0;
  const source = String(value || '');
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash << 5) - hash + source.charCodeAt(index);
    hash |= 0;
  }
  return hash;
}

export function countEditedMessages(document) {
  const containers = document.querySelectorAll(
    '[data-test-render-count], [data-testid*="conversation-turn"]'
  );
  let editedCount = 0;

  containers.forEach(container => {
    const userMessage = container.querySelector('[data-testid="user-message"]');
    if (!userMessage) {
      return;
    }

    const spans = container.querySelectorAll('span');
    for (const span of spans) {
      if (userMessage.contains(span)) {
        continue;
      }

      const text = span.textContent?.trim() || '';
      if (!VERSION_PATTERN.test(text)) {
        continue;
      }

      const [, totalRaw] = text.split('/');
      const total = Number.parseInt(totalRaw?.trim() || '', 10);
      if (Number.isFinite(total) && total > 1) {
        editedCount += 1;
      }
      break;
    }
  });

  return editedCount;
}

export function sanitizeLiveCaptureHtml({
  captureHtml,
  captureMeta,
  fixtureId,
  route,
  pageType = 'conversation',
  theme,
  features = ['navigation', 'bookmarks', 'emojiMarkers', 'editHistory'],
  notes = 'Sanitized from live Claude capture',
  visual = false,
}) {
  const dom = new JSDOM(captureHtml);
  const { document } = dom.window;
  const sidebarRoot = findSidebarRoot(document);
  const conversationRoot = findConversationRoot(document);

  if (sidebarRoot) {
    sanitizeAttributes(sidebarRoot);
    redactSidebar(sidebarRoot);
  }

  sanitizeAttributes(conversationRoot);
  redactConversationContent(conversationRoot);
  redactConversationChrome(conversationRoot);

  const shell = document.implementation.createHTMLDocument('Claude Fixture Sanitized Snapshot');
  const mountRoot = shell.createElement('div');
  mountRoot.id = 'claude-fixture-sanitized-root';
  mountRoot.className = 'fixture-real-chat-root';
  mountRoot.dataset.fixtureSource = 'live-chat-capture';
  mountRoot.dataset.fixtureId = fixtureId;

  if (sidebarRoot) {
    mountRoot.appendChild(sidebarRoot);
  }
  mountRoot.appendChild(conversationRoot);

  const metricsDom = new JSDOM(mountRoot.innerHTML);
  const metricsDocument = metricsDom.window.document;
  const messageCount = metricsDocument.querySelectorAll('[data-test-render-count]').length;
  const userMessageCount = metricsDocument.querySelectorAll('[data-testid="user-message"]').length;
  const editedMessageCount = countEditedMessages(metricsDocument);

  return {
    sourceHtml: mountRoot.innerHTML,
    meta: {
      id: fixtureId,
      route,
      pageType,
      theme: theme || captureMeta.colorScheme || 'dark',
      viewport: captureMeta.viewport || { width: 1440, height: 900 },
      sourceMode: 'sanitized_html',
      helpers: {
        mutable: false,
      },
      features,
      seedProfile: '',
      visual,
      notes,
    },
    summary: {
      messageCount,
      userMessageCount,
      editedMessageCount,
    },
  };
}
