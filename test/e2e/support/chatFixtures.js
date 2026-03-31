export const REAL_CHAT_FIXTURES = Object.freeze({
  short: 'chat-real-short',
  medium: 'chat-real-medium',
  long: 'chat-real-long',
});

export const SYNTHETIC_CHAT_FIXTURES = Object.freeze({
  streaming: 'chat-streaming',
  editedThread: 'chat-edited-thread',
});

export const CHAT_TEST_SURFACES = Object.freeze({
  contracts: Object.freeze([
    REAL_CHAT_FIXTURES.short,
    REAL_CHAT_FIXTURES.medium,
    REAL_CHAT_FIXTURES.long,
    SYNTHETIC_CHAT_FIXTURES.streaming,
    SYNTHETIC_CHAT_FIXTURES.editedThread,
  ]),
  navigation: Object.freeze({
    thread: REAL_CHAT_FIXTURES.long,
    keyboard: REAL_CHAT_FIXTURES.short,
  }),
  bookmarks: Object.freeze({
    base: REAL_CHAT_FIXTURES.short,
    keyboard: REAL_CHAT_FIXTURES.medium,
    denseList: REAL_CHAT_FIXTURES.long,
    manager: REAL_CHAT_FIXTURES.short,
    deepLinkSource: REAL_CHAT_FIXTURES.medium,
    deepLinkTarget: REAL_CHAT_FIXTURES.short,
  }),
  emoji: Object.freeze({
    base: REAL_CHAT_FIXTURES.medium,
    denseList: REAL_CHAT_FIXTURES.long,
    advanced: REAL_CHAT_FIXTURES.medium,
  }),
  history: Object.freeze({
    short: REAL_CHAT_FIXTURES.short,
    natural: REAL_CHAT_FIXTURES.medium,
    dense: REAL_CHAT_FIXTURES.long,
    controlled: SYNTHETIC_CHAT_FIXTURES.editedThread,
  }),
  popup: Object.freeze({
    base: REAL_CHAT_FIXTURES.short,
    persistence: REAL_CHAT_FIXTURES.long,
  }),
  visuals: Object.freeze({
    nav: REAL_CHAT_FIXTURES.short,
    bookmarks: REAL_CHAT_FIXTURES.short,
    marker: REAL_CHAT_FIXTURES.medium,
    edit: REAL_CHAT_FIXTURES.medium,
  }),
});

export function listAllChatFixtureIds() {
  const ids = new Set();

  Object.values(REAL_CHAT_FIXTURES).forEach(id => ids.add(id));
  Object.values(SYNTHETIC_CHAT_FIXTURES).forEach(id => ids.add(id));

  return [...ids];
}
