(async function bootstrapClaudeFixture() {
  const root = document.documentElement;
  const metaUrl = root.dataset.fixtureMeta;
  const bootUrl = root.dataset.fixtureBoot || '';
  const sourceUrl = root.dataset.fixtureSource || '';

  if (!metaUrl) {
    throw new Error('Fixture meta URL is missing');
  }

  const metaResponse = await fetch(metaUrl);
  if (!metaResponse.ok) {
    throw new Error(`Failed to load fixture meta: ${metaUrl}`);
  }

  const meta = await metaResponse.json();
  const state = createState(meta, sourceUrl);
  const readyPromise = Promise.resolve().then(() => renderFixture(state));

  window.__CLAUDE_FIXTURE_READY__ = readyPromise.then(() => window.__claudeFixture);
  await readyPromise;

  if (bootUrl) {
    await loadBootScript(bootUrl);
  }
})();

const VIEWPORT_DEFAULT = { width: 1440, height: 900 };
const RETRY_ICON_PATH =
  'M10.3857 8.35355C10.5809 8.15829 10.8975 8.15829 11.0928 8.35355L13.7392 11L11.0928 13.6464C10.8975 13.8417 10.5809 13.8417 10.3857 13.6464C10.1904 13.4512 10.1904 13.1346 10.3857 12.9393L12.325 11L10.3857 9.06066C10.1904 8.8654 10.1904 8.54882 10.3857 8.35355Z';

const SEED_PROFILES = {
  'new-empty': () => ({
    topbar: {
      title: 'New chat',
      subtitle: 'Fresh composer with no prior conversation turns.',
      pills: ['Blank conversation', 'No history'],
    },
    hero: {
      title: 'Ask Claude about anything',
      body: 'This fixture mirrors the empty composer state so route detection, popup sync and graceful no-op behavior can be tested without loading live claude.ai.',
    },
    sidebar: {
      title: 'Claude',
      subtitle: 'Fixture workspace',
      sections: [
        {
          name: 'Recent',
          items: [
            { label: 'Weekly planning draft', href: '/chat/fixture-basic-dark' },
            { label: 'Release checklist', href: '/chat/fixture-edited-thread' },
          ],
        },
      ],
    },
    composer: {
      placeholder: 'Message Claude',
      footerPills: ['Model: Sonnet', 'Artifacts off'],
      sendLabel: 'Start chat',
    },
    messages: [],
  }),
  'chat-basic-dark': () => ({
    topbar: {
      title: 'Q2 launch plan',
      subtitle: 'Scrollable conversation for navigation, bookmarks and markers.',
      pills: ['Dark theme', '8 messages'],
    },
    sidebar: sharedSidebar(),
    composer: sharedComposer(),
    messages: baseConversationMessages({ variant: 'dark' }),
  }),
  'chat-basic-light': () => ({
    topbar: {
      title: 'Customer research synthesis',
      subtitle: 'Light theme fixture for visual parity and module smoke tests.',
      pills: ['Light theme', '8 messages'],
    },
    sidebar: sharedSidebar(),
    composer: sharedComposer(),
    messages: baseConversationMessages({ variant: 'light' }),
  }),
  'chat-streaming': () => ({
    topbar: {
      title: 'Streaming response demo',
      subtitle: 'Final assistant turn stays in streaming mode until the helper finalizes it.',
      pills: ['Streaming', '7 settled + 1 live'],
    },
    sidebar: sharedSidebar(),
    composer: sharedComposer(),
    messages: [
      ...baseConversationMessages({ variant: 'dark' }).slice(0, 6),
      assistantMessage('streaming-assistant', {
        authorLabel: 'Claude is responding',
        height: 260,
        streaming: true,
        blocks: [
          {
            type: 'paragraph',
            text: 'I am still drafting the rollout summary. Use the fixture helper to complete this message and verify mutation-driven rescans.',
          },
        ],
      }),
    ],
  }),
  'chat-edited-thread': () => ({
    topbar: {
      title: 'Iteration history review',
      subtitle: 'Multiple edited prompts with version chips and retry controls.',
      pills: ['Edited prompts', 'Branch map'],
    },
    sidebar: sharedSidebar(),
    composer: sharedComposer(),
    messages: editedThreadMessages(),
  }),
  'chat-long-response': () => ({
    topbar: {
      title: 'Long response fixture',
      subtitle: 'Headings, code blocks, quotes and dense scroll for UX regression coverage.',
      pills: ['Long form', 'Stage 2 prep'],
    },
    sidebar: richSidebar(),
    composer: sharedComposer(),
    messages: longResponseMessages(),
  }),
  'chat-sidebar-rich': () => ({
    topbar: {
      title: 'Sidebar variation',
      subtitle: 'Rich navigation rail for sidebar and bookmark injection compatibility.',
      pills: ['Sidebar heavy', 'Route contracts'],
    },
    sidebar: richSidebar(),
    composer: sharedComposer(),
    messages: baseConversationMessages({ variant: 'dark' }),
  }),
  'project-chat-basic': () => ({
    topbar: {
      title: 'Project chat',
      subtitle: 'Project-scoped route exercising project chat detection.',
      pills: ['Project', 'Conversation'],
    },
    sidebar: {
      ...sharedSidebar(),
      title: 'Roadmap project',
      subtitle: 'Project workspace',
    },
    composer: sharedComposer(),
    messages: baseConversationMessages({ variant: 'project' }),
  }),
  'code-workspace': () => ({
    topbar: {
      title: 'Claude Code workspace',
      subtitle: 'Non-conversation route to validate graceful degradation.',
      pills: ['Code route', 'No conversation UI'],
    },
    sidebar: sharedSidebar(),
    codeWorkspace: {
      files: ['src/content.js', 'src/App.js', 'popup/popup.js', 'test/e2e/navigation.spec.js'],
      code: `export async function verifyFixtureHarness(page) {
  await page.goto('https://claude.ai/code/fixture-workspace');
  const ready = await page.evaluate(() => !!window.__claudeFixture);
  return ready;
}`,
      notes: [
        'The extension should initialize without showing conversation-only floating controls.',
        'This route stays on the claude.ai origin but is intentionally not a conversation page.',
      ],
    },
  }),
  'captured-fragment': meta => ({
    topbar: {
      title: 'Sanitized live capture',
      subtitle: 'Review-only shell for manually sanitized Claude fragments.',
      pills: ['Captured fragment'],
    },
    sidebar: sharedSidebar(),
    composer: sharedComposer(),
    messages: baseConversationMessages({ variant: 'captured' }),
    notes: meta.notes,
  }),
};

function createState(meta, sourceUrl = '') {
  const sourceMode = meta.sourceMode || 'seed';
  const isSeedFixture = sourceMode === 'seed';
  const seedFactory =
    isSeedFixture && meta.seedProfile
      ? SEED_PROFILES[meta.seedProfile] || SEED_PROFILES['chat-basic-dark']
      : () => ({});
  const seed = seedFactory(meta);

  return {
    meta: {
      viewport: VIEWPORT_DEFAULT,
      ...meta,
      viewport: { ...VIEWPORT_DEFAULT, ...(meta.viewport || {}) },
      sourceMode,
      helpers: {
        mutable: true,
        ...(meta.helpers || {}),
      },
    },
    data: seed,
    sourceUrl,
  };
}

function sharedSidebar() {
  return {
    title: 'Claude',
    subtitle: 'Fixture workspace',
    sections: [
      {
        name: 'Chats',
        items: [
          { label: 'Q2 launch plan', href: '/chat/fixture-basic-dark' },
          { label: 'Iteration history review', href: '/chat/fixture-edited-thread' },
          { label: 'Long response fixture', href: '/chat/fixture-long-response' },
        ],
      },
      {
        name: 'Projects',
        items: [
          { label: 'Roadmap project', href: '/project/fixture-roadmap/chat/fixture-project-chat' },
        ],
      },
    ],
  };
}

function richSidebar() {
  return {
    title: 'Claude',
    subtitle: 'Fixture workspace',
    sections: [
      {
        name: 'Favorites',
        items: [
          { label: 'Release readiness review', href: '/chat/fixture-edited-thread' },
          { label: 'Accessibility QA', href: '/chat/fixture-long-response' },
        ],
      },
      {
        name: 'Projects',
        items: [
          { label: 'Roadmap project', href: '/project/fixture-roadmap/chat/fixture-project-chat' },
          { label: 'Design ops', href: '/project/fixture-design/chat/fixture-design-audit' },
        ],
      },
      {
        name: 'Recent',
        items: [
          { label: 'Streaming demo', href: '/chat/fixture-streaming' },
          { label: 'Code workspace', href: '/code/fixture-workspace' },
          { label: 'Empty new chat', href: '/new' },
          { label: 'Sidebar variation', href: '/chat/fixture-sidebar-rich' },
        ],
      },
    ],
  };
}

function sharedComposer() {
  return {
    placeholder: 'Message Claude',
    footerPills: ['Artifacts on', 'Context window healthy'],
    sendLabel: 'Send',
  };
}

function baseConversationMessages({ variant }) {
  return [
    userMessage('user-1', {
      text: 'Give me a launch checklist for rolling out a productivity extension update this week.',
      height: 180,
    }),
    assistantMessage('assistant-1', {
      height: 260,
      blocks: [
        {
          type: 'paragraph',
          text: 'Start by separating release blockers from nice-to-have cleanup. The rollout should keep review, packaging, changelog and communication steps visible at a glance.',
        },
        {
          type: 'list',
          ordered: true,
          items: [
            'Verify packaging and version metadata.',
            'Confirm Chrome Web Store and GitHub release artifacts match.',
            'Smoke-test the popup, floating controls and persistence.',
          ],
        },
      ],
    }),
    userMessage('user-2', {
      text: 'I also need confidence that the navigation and bookmarking UX survives DOM drift.',
      height: 180,
    }),
    assistantMessage('assistant-2', {
      height: 320,
      blocks: [
        {
          type: 'heading',
          level: 2,
          text: variant === 'light' ? 'Testing direction' : 'Testing direction',
        },
        {
          type: 'paragraph',
          text: 'Use deterministic fixtures that keep the selectors your extension depends on. Route a Playwright browser to https://claude.ai paths while fulfilling the document from local files.',
        },
        {
          type: 'code',
          language: 'js',
          code: `await page.goto('https://claude.ai/chat/fixture-basic-dark');\nawait expect(page.locator('#claude-nav-container')).toBeVisible();`,
        },
      ],
    }),
    userMessage('user-3', {
      text: 'What should I cover in the first end-to-end milestone?',
      height: 170,
    }),
    assistantMessage('assistant-3', {
      height: 300,
      blocks: [
        {
          type: 'paragraph',
          text: 'Cover the production-ready modules first: navigation, bookmarks, emoji markers, edit history, popup sync and route contracts.',
        },
        {
          type: 'blockquote',
          text: 'Use one live canary for drift detection, but keep CI fully fixture-driven.',
        },
        {
          type: 'paragraph',
          text:
            variant === 'project'
              ? 'Project chat routes should keep the same DOM contract so the content script can re-use its conversation path logic.'
              : 'Add a narrow desktop viewport smoke check so the floating controls remain usable when the content column shrinks.',
        },
      ],
    }),
    userMessage('user-4', {
      text: 'Summarize the guardrails in one sentence.',
      height: 150,
    }),
    assistantMessage('assistant-4', {
      height: 240,
      blocks: [
        {
          type: 'paragraph',
          text: 'Model Claude faithfully where your extension integrates with it, but own the test surface so fixtures stay fast, deterministic and reviewable.',
        },
        {
          type: 'link',
          text: 'Fixture docs',
          href: 'https://example.com/fixture-docs',
        },
      ],
    }),
  ];
}

function editedThreadMessages() {
  return [
    userMessage('edit-user-1', {
      text: 'Draft the release checklist for version 1.0.2 and keep it concise.',
      height: 170,
      versionInfo: '2 / 3',
      retryButton: true,
      containerId: 'edit-index-0',
    }),
    assistantMessage('edit-assistant-1', {
      height: 250,
      blocks: [
        {
          type: 'list',
          ordered: true,
          items: [
            'Update changelog and version metadata.',
            'Build, zip and validate the release artifact.',
            'Submit to Chrome Web Store and publish GitHub release assets.',
          ],
        },
      ],
    }),
    userMessage('edit-user-2', {
      text: 'Actually include a validation step for popup sync and marker storage.',
      height: 190,
      versionInfo: '3 / 3',
      retryButton: true,
      containerId: 'edit-index-2',
    }),
    assistantMessage('edit-assistant-2', {
      height: 280,
      blocks: [
        {
          type: 'paragraph',
          text: 'Add a post-save validation pass that checks popup state, floating visibility and a sample marker/bookmark roundtrip against a deterministic fixture.',
        },
        {
          type: 'paragraph',
          text: 'That final pass closes the gap between storage writes and real DOM behavior.',
        },
      ],
    }),
    userMessage('edit-user-3', {
      text: 'Do we need to keep a branch map for edits?',
      height: 180,
      versionInfo: '1 / 2',
      retryButton: true,
      containerId: 'edit-index-4',
    }),
    assistantMessage('edit-assistant-3', {
      height: 260,
      blocks: [
        {
          type: 'paragraph',
          text: 'Yes. A lightweight branch map helps confirm the extension can still surface alternative prompt branches and historical snapshots.',
        },
        {
          type: 'heading',
          level: 3,
          text: 'Why it matters',
        },
        {
          type: 'list',
          ordered: false,
          items: [
            'Avoids losing context when prompt versions drift.',
            'Makes regression review faster after retry/edit interactions.',
          ],
        },
      ],
    }),
  ];
}

function longResponseMessages() {
  return [
    ...baseConversationMessages({ variant: 'dark' }).slice(0, 4),
    assistantMessage('long-assistant', {
      height: 560,
      blocks: [
        { type: 'heading', level: 2, text: 'Fixture architecture' },
        {
          type: 'paragraph',
          text: 'The browser tests should load a full Claude-like shell, but the heavy lifting belongs to a small fixture runtime that knows how to render the DOM contract the extension depends on.',
        },
        { type: 'heading', level: 3, text: 'Recommended layers' },
        {
          type: 'list',
          ordered: true,
          items: [
            'Tiny JSDOM selector contracts.',
            'Playwright pages on real claude.ai routes fulfilled locally.',
            'A live drift canary outside PR gating.',
          ],
        },
        {
          type: 'code',
          language: 'json',
          code: `{\n  "id": "chat-long-response",\n  "route": "/chat/fixture-long-response",\n  "pageType": "conversation",\n  "seedProfile": "chat-long-response"\n}`,
        },
        {
          type: 'blockquote',
          text: 'The goal is not to recreate Claude perfectly. The goal is to make your extension think it is on Claude while you control the page completely.',
        },
        {
          type: 'paragraph',
          text: 'Dense fixture content also helps validate scrolling, counter updates, code block folding preparation and screenshot stability.',
        },
      ],
    }),
    userMessage('long-user-followup', {
      text: 'And what about mobile-like desktop widths?',
      height: 160,
    }),
    assistantMessage('long-assistant-followup', {
      height: 280,
      blocks: [
        {
          type: 'paragraph',
          text: 'Keep a narrower 1180px smoke check in Playwright. It is still desktop, but catches layout collisions that a wide-only baseline misses.',
        },
      ],
    }),
  ];
}

function userMessage(id, options) {
  return {
    id,
    role: 'user',
    height: options.height || 180,
    text: options.text,
    versionInfo: options.versionInfo || '',
    retryButton: options.retryButton || false,
    containerId: options.containerId || '',
  };
}

function assistantMessage(id, options) {
  return {
    id,
    role: 'assistant',
    height: options.height || 240,
    authorLabel: options.authorLabel || 'Claude',
    blocks: options.blocks || [],
    streaming: options.streaming || false,
  };
}

async function renderFixture(state) {
  document.documentElement.dataset.fixtureTheme = state.meta.theme || 'dark';
  document.documentElement.style.colorScheme = state.meta.theme === 'light' ? 'light' : 'dark';
  document.title = `Claude Fixture - ${state.meta.id}`;
  document.body.textContent = '';

  if (state.meta.sourceMode === 'sanitized_html') {
    await renderSanitizedFixture(state);
  } else {
    const app = state.data.sidebar ? createConversationShell(state) : createContentOnlyShell(state);
    document.body.appendChild(app);
  }

  window.__claudeFixture = createFixtureApi(state);
  document.dispatchEvent(
    new CustomEvent('claude-fixture:ready', { detail: { id: state.meta.id } })
  );
}

async function renderSanitizedFixture(state) {
  if (!state.sourceUrl) {
    throw new Error(`Sanitized fixture ${state.meta.id} is missing a source URL`);
  }

  const response = await fetch(state.sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to load sanitized fixture source: ${state.sourceUrl}`);
  }

  const html = await response.text();
  const root = document.createElement('div');
  root.id = 'claude-fixture-sanitized-root';
  root.dataset.fixtureMount = 'sanitized-root';
  root.innerHTML = html;
  document.body.appendChild(root);
}

function createConversationShell(state) {
  const app = document.createElement('div');
  app.className = 'fixture-app';

  if (state.data.sidebar) {
    app.appendChild(renderSidebar(state));
  } else {
    app.classList.add('fixture-no-sidebar');
  }

  const shell = document.createElement('div');
  shell.className = 'fixture-main-shell';
  shell.appendChild(renderTopbar(state));
  shell.appendChild(renderMain(state));
  app.appendChild(shell);

  return app;
}

function createContentOnlyShell(state) {
  const app = document.createElement('div');
  app.className = 'fixture-app fixture-no-sidebar';

  const shell = document.createElement('div');
  shell.className = 'fixture-main-shell';
  shell.appendChild(renderTopbar(state));
  shell.appendChild(renderMain(state));
  app.appendChild(shell);

  return app;
}

function renderSidebar(state) {
  const sidebarData = state.data.sidebar;
  const aside = document.createElement('aside');
  aside.className = 'fixture-sidebar';

  const header = document.createElement('div');
  header.className = 'fixture-sidebar-header';
  header.innerHTML = `<h1>${escapeHtml(sidebarData.title)}</h1><p>${escapeHtml(sidebarData.subtitle)}</p>`;
  aside.appendChild(header);

  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Sidebar');
  nav.className = 'flex flex-col px-2 pt-4 gap-px';

  sidebarData.sections.forEach(section => {
    const sectionEl = document.createElement('section');
    sectionEl.className = 'fixture-sidebar-section';
    sectionEl.dataset.sectionName = section.name;
    sectionEl.dataset.collapsed = 'false';

    const title = document.createElement('h3');
    title.textContent = section.name;
    sectionEl.appendChild(title);

    const items = document.createElement('div');
    items.className = 'fixture-sidebar-items flex flex-col px-2 gap-px';

    section.items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'relative group';

      const link = document.createElement('a');
      link.className =
        'fixture-sidebar-link inline-flex items-center justify-center relative isolate shrink-0 can-focus select-none border-transparent transition font-base h-8 rounded-md px-3 min-w-[4rem] whitespace-nowrap !text-xs w-full !min-w-0 group py-1.5 rounded-lg px-4 !duration-75 overflow-hidden';
      link.href = item.href;
      link.setAttribute('data-dd-action-name', 'sidebar-nav-item');

      const content = document.createElement('div');
      content.className = '-translate-x-2 w-full flex flex-row items-center justify-start gap-3';
      const bulletWrap = document.createElement('div');
      bulletWrap.className = 'flex items-center justify-center text-text-100';
      const bullet = document.createElement('div');
      bullet.className = 'fixture-sidebar-bullet';
      bulletWrap.appendChild(bullet);
      const textWrap = document.createElement('span');
      textWrap.className = 'truncate text-sm whitespace-nowrap flex-1';
      const textInner = document.createElement('div');
      textInner.className = 'opacity-100 transition-opacity ease-out duration-150';
      textInner.textContent = item.label;
      textWrap.appendChild(textInner);
      content.appendChild(bulletWrap);
      content.appendChild(textWrap);
      link.appendChild(content);
      row.appendChild(link);
      items.appendChild(row);
    });

    sectionEl.appendChild(items);
    nav.appendChild(sectionEl);
  });

  aside.appendChild(nav);
  return aside;
}

function renderTopbar(state) {
  const topbar = document.createElement('header');
  topbar.className = 'fixture-topbar';

  const copy = document.createElement('div');
  copy.innerHTML = `<h2>${escapeHtml(state.data.topbar.title)}</h2><p>${escapeHtml(
    state.data.topbar.subtitle
  )}</p>`;
  topbar.appendChild(copy);

  const pills = document.createElement('div');
  pills.style.display = 'flex';
  pills.style.flexWrap = 'wrap';
  pills.style.gap = '10px';

  (state.data.topbar.pills || []).forEach(text => {
    const pill = document.createElement('div');
    pill.className = 'fixture-pill';
    pill.textContent = text;
    pills.appendChild(pill);
  });

  topbar.appendChild(pills);
  return topbar;
}

function renderMain(state) {
  const main = document.createElement('main');
  main.className = 'fixture-main';
  main.setAttribute('role', 'main');
  main.dataset.pageType = state.meta.pageType;

  if (state.meta.pageType === 'new_chat') {
    const hero = document.createElement('section');
    hero.className = 'fixture-hero';
    hero.innerHTML = `<h3>${escapeHtml(state.data.hero.title)}</h3><p>${escapeHtml(
      state.data.hero.body
    )}</p>`;
    main.appendChild(hero);
  }

  if (state.data.messages && state.data.messages.length > 0) {
    main.appendChild(renderMessageList(state));
  } else if (state.meta.pageType === 'code_workspace') {
    main.appendChild(renderCodeWorkspace(state));
  }

  if (state.data.codeWorkspace && state.meta.pageType !== 'code_workspace') {
    main.appendChild(renderCodeWorkspace(state));
  }

  main.appendChild(renderComposer(state));

  return main;
}

function renderMessageList(state) {
  const container = document.createElement('section');
  container.className = 'fixture-message-list';
  container.dataset.fixtureMount = 'messages';
  container.setAttribute('data-testid', 'messages');

  state.data.messages.forEach((message, index) => {
    container.appendChild(renderMessage(state, message, index));
  });

  return container;
}

function renderMessage(state, message, index) {
  const article = document.createElement('article');
  article.className = 'fixture-message';
  article.dataset.role = message.role;
  article.dataset.fixtureMessageId = message.id;
  article.dataset.testid = 'fixture-message';
  article.setAttribute('data-test-render-count', String(index + 1));
  article.setAttribute('data-testid', 'conversation-turn');
  article.setAttribute('data-is-streaming', message.streaming ? 'true' : 'false');
  if (message.containerId) {
    article.setAttribute('data-edit-container-id', message.containerId);
  }

  const inner = document.createElement('div');
  inner.className = 'fixture-message-inner';
  inner.style.setProperty('--fixture-message-height', `${message.height || 220}px`);
  article.appendChild(inner);

  const header = document.createElement('div');
  header.className = 'fixture-message-header';
  inner.appendChild(header);

  const author = document.createElement('div');
  author.className = 'fixture-message-author';
  author.innerHTML = `<span class="fixture-avatar">${message.role === 'user' ? 'U' : 'C'}</span><span>${escapeHtml(
    message.role === 'user' ? 'You' : message.authorLabel || 'Claude'
  )}</span>`;
  header.appendChild(author);

  const actions = document.createElement('div');
  actions.className = 'fixture-actions';
  header.appendChild(actions);

  if (message.versionInfo) {
    const versionContainer = document.createElement('div');
    versionContainer.className = 'inline-flex items-center gap-1 fixture-version-chip';
    const versionSpan = document.createElement('span');
    versionSpan.textContent = message.versionInfo;
    versionContainer.appendChild(versionSpan);
    actions.appendChild(versionContainer);
  }

  if (message.retryButton) {
    actions.appendChild(createRetryButton());
  }

  if (message.role === 'user') {
    const body = document.createElement('div');
    body.className = 'fixture-user-message font-user-message';
    body.setAttribute('data-testid', 'user-message');
    body.textContent = message.text;
    inner.appendChild(body);
  } else {
    inner.appendChild(renderAssistantContent(message));
  }

  if (message.streaming) {
    const streaming = document.createElement('div');
    streaming.className = 'fixture-streaming';
    streaming.innerHTML =
      '<span class="fixture-streaming-dot"></span><span>Streaming response…</span>';
    inner.appendChild(streaming);
  }

  return article;
}

function renderAssistantContent(message) {
  const wrapper = document.createElement('div');
  wrapper.className = 'font-claude-message';

  (message.blocks || []).forEach(block => {
    let element = null;

    if (block.type === 'paragraph') {
      element = document.createElement('p');
      element.textContent = block.text;
    } else if (block.type === 'heading') {
      element = document.createElement(`h${block.level || 2}`);
      element.textContent = block.text;
    } else if (block.type === 'list') {
      element = document.createElement(block.ordered ? 'ol' : 'ul');
      block.items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        element.appendChild(li);
      });
    } else if (block.type === 'code') {
      element = document.createElement('pre');
      const code = document.createElement('code');
      code.className = block.language ? `language-${block.language}` : '';
      code.textContent = block.code;
      element.appendChild(code);
    } else if (block.type === 'blockquote') {
      element = document.createElement('blockquote');
      element.textContent = block.text;
    } else if (block.type === 'link') {
      element = document.createElement('p');
      const link = document.createElement('a');
      link.href = block.href;
      link.textContent = block.text;
      element.appendChild(link);
    }

    if (element) {
      wrapper.appendChild(element);
    }
  });

  return wrapper;
}

function renderComposer(state) {
  const composer = document.createElement('section');
  composer.className = 'fixture-composer';

  const textarea = document.createElement('textarea');
  textarea.placeholder = state.data.composer?.placeholder || 'Message Claude';
  textarea.setAttribute(
    'data-testid',
    state.meta.pageType === 'new_chat' ? 'chat-input' : 'prompt-input'
  );
  composer.appendChild(textarea);

  const footer = document.createElement('div');
  footer.className = 'fixture-composer-footer';
  composer.appendChild(footer);

  const pills = document.createElement('div');
  pills.style.display = 'flex';
  pills.style.flexWrap = 'wrap';
  pills.style.gap = '10px';
  (state.data.composer?.footerPills || []).forEach(text => {
    const pill = document.createElement('div');
    pill.className = 'fixture-pill';
    pill.textContent = text;
    pills.appendChild(pill);
  });
  footer.appendChild(pills);

  const send = document.createElement('button');
  send.type = 'button';
  send.className = 'fixture-send';
  send.textContent = state.data.composer?.sendLabel || 'Send';
  footer.appendChild(send);

  return composer;
}

function renderCodeWorkspace(state) {
  const workspace = document.createElement('section');
  workspace.className = 'fixture-code-shell';

  const editor = document.createElement('div');
  editor.className = 'fixture-code-card';
  editor.innerHTML = `<h3 style="margin-top:0">Workspace</h3>`;
  const pre = document.createElement('pre');
  const code = document.createElement('code');
  code.textContent = state.data.codeWorkspace.code;
  pre.appendChild(code);
  editor.appendChild(pre);
  workspace.appendChild(editor);

  const sidebar = document.createElement('div');
  sidebar.className = 'fixture-code-card';
  sidebar.innerHTML = `<h3 style="margin-top:0">Files</h3>`;
  const list = document.createElement('ul');
  list.style.margin = '0';
  list.style.paddingLeft = '18px';
  state.data.codeWorkspace.files.forEach(file => {
    const item = document.createElement('li');
    item.textContent = file;
    list.appendChild(item);
  });
  sidebar.appendChild(list);

  const notesTitle = document.createElement('h4');
  notesTitle.textContent = 'Notes';
  notesTitle.style.marginBottom = '8px';
  sidebar.appendChild(notesTitle);

  state.data.codeWorkspace.notes.forEach(note => {
    const paragraph = document.createElement('p');
    paragraph.style.margin = '0 0 10px';
    paragraph.style.color = 'var(--fixture-muted)';
    paragraph.textContent = note;
    sidebar.appendChild(paragraph);
  });

  workspace.appendChild(sidebar);
  return workspace;
}

function createRetryButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'fixture-icon-button';
  button.setAttribute('aria-label', 'Retry prompt');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', RETRY_ICON_PATH);
  svg.appendChild(path);
  button.appendChild(svg);
  return button;
}

function createFixtureApi(state) {
  const isMutable = state.meta.helpers?.mutable !== false;

  return {
    meta: state.meta,
    getState() {
      return structuredCloneSafe({
        meta: state.meta,
        data: state.meta.sourceMode === 'seed' ? state.data : null,
      });
    },
    navigate(pathname) {
      history.pushState({}, '', pathname);
      window.dispatchEvent(new PopStateEvent('popstate'));
      document.dispatchEvent(
        new CustomEvent('claude-fixture:navigate', {
          detail: { pathname },
        })
      );
    },
    appendTurn(data) {
      if (!isMutable) {
        return false;
      }
      state.data.messages.push(normalizeTurn(data));
      rerenderMessages(state);
      return true;
    },
    finishStreaming(index) {
      if (!isMutable) {
        return false;
      }
      const message = state.data.messages[index];
      if (!message) {
        return false;
      }
      message.streaming = false;
      rerenderMessages(state);
      return true;
    },
    openEditForm(containerId, value) {
      if (!isMutable) {
        return false;
      }
      const target = document.querySelector(`[data-edit-container-id="${containerId}"]`);
      if (!target) {
        return false;
      }
      removeExistingEditForm();

      const form = document.createElement('form');
      form.className = 'fixture-edit-form';
      form.dataset.fixtureEditForm = 'true';

      const textarea = document.createElement('textarea');
      textarea.value = value || '';
      form.appendChild(textarea);

      const actions = document.createElement('div');
      actions.className = 'fixture-edit-form-actions';
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.textContent = 'Cancel';
      cancel.addEventListener('click', () => form.remove());
      const submit = document.createElement('button');
      submit.type = 'submit';
      submit.textContent = 'Save';
      actions.appendChild(cancel);
      actions.appendChild(submit);
      form.appendChild(actions);

      form.addEventListener('submit', event => {
        event.preventDefault();
      });

      target.appendChild(form);
      textarea.focus();
      return true;
    },
    submitEdit(containerId, nextVersion) {
      if (!isMutable) {
        return false;
      }
      const target = document.querySelector(`[data-edit-container-id="${containerId}"]`);
      if (!target) {
        return false;
      }

      const versionSpan = target.querySelector('.inline-flex.items-center.gap-1 span');
      if (versionSpan) {
        versionSpan.textContent = nextVersion;
      }
      removeExistingEditForm();
      target.dispatchEvent(new CustomEvent('fixture:edit-submitted', { bubbles: true }));
      return true;
    },
    setTheme(theme) {
      state.meta.theme = theme;
      document.documentElement.dataset.fixtureTheme = theme;
      document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark';
    },
    toggleSidebarSection(name) {
      if (!isMutable) {
        return false;
      }
      const section = document.querySelector(`[data-section-name="${CSS.escape(name)}"]`);
      if (!section) {
        return false;
      }
      section.dataset.collapsed = section.dataset.collapsed === 'true' ? 'false' : 'true';
      return true;
    },
  };
}

function normalizeTurn(data) {
  if (data.role === 'assistant') {
    return assistantMessage(data.id || `assistant-${Date.now()}`, {
      authorLabel: data.authorLabel,
      height: data.height,
      blocks: data.blocks || [{ type: 'paragraph', text: data.text || '' }],
      streaming: data.streaming,
    });
  }

  return userMessage(data.id || `user-${Date.now()}`, {
    text: data.text || '',
    height: data.height,
    versionInfo: data.versionInfo,
    retryButton: data.retryButton,
    containerId: data.containerId,
  });
}

function rerenderMessages(state) {
  const current = document.querySelector(
    '[data-fixture-mount="messages"], [data-fixture-mount=\'messages\']'
  );
  const next = renderMessageList(state);
  next.dataset.fixtureMount = 'messages';

  if (current && current.parentNode) {
    current.parentNode.replaceChild(next, current);
  } else {
    const main = document.querySelector('main');
    if (main) {
      main.insertBefore(next, main.firstChild);
    }
  }
}

function removeExistingEditForm() {
  document.querySelectorAll('[data-fixture-edit-form="true"]').forEach(form => form.remove());
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function loadBootScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load boot script: ${url}`));
    document.body.appendChild(script);
  });
}
