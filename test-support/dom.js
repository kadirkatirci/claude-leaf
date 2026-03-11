import { JSDOM } from 'jsdom';

function setGlobalValue(key, value) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  });
}

export function setupDom(html = '<!doctype html><html><head></head><body></body></html>') {
  const dom = new JSDOM(html, {
    url: 'https://example.com',
    pretendToBeVisual: true,
  });

  const previousGlobals = {
    window: globalThis.window,
    document: globalThis.document,
    navigator: globalThis.navigator,
    history: globalThis.history,
    location: globalThis.location,
    HTMLElement: globalThis.HTMLElement,
    Element: globalThis.Element,
    Node: globalThis.Node,
    Event: globalThis.Event,
    CustomEvent: globalThis.CustomEvent,
    MutationObserver: globalThis.MutationObserver,
  };

  setGlobalValue('window', dom.window);
  setGlobalValue('document', dom.window.document);
  setGlobalValue('navigator', dom.window.navigator);
  setGlobalValue('history', dom.window.history);
  setGlobalValue('location', dom.window.location);
  setGlobalValue('HTMLElement', dom.window.HTMLElement);
  setGlobalValue('Element', dom.window.Element);
  setGlobalValue('Node', dom.window.Node);
  setGlobalValue('Event', dom.window.Event);
  setGlobalValue('CustomEvent', dom.window.CustomEvent);
  setGlobalValue('MutationObserver', dom.window.MutationObserver);

  return () => {
    dom.window.close();

    Object.entries(previousGlobals).forEach(([key, value]) => {
      if (value === undefined) {
        delete globalThis[key];
      } else {
        setGlobalValue(key, value);
      }
    });
  };
}
