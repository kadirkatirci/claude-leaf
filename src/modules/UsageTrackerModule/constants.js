export const USAGE_CLASSNAMES = {
  root: 'cl-usage-tracker',
  line: 'cl-usage-tracker-line',
  fill: 'cl-usage-tracker-fill',
};

export const USAGE_EVENT_NAMES = {
  LIMIT_UPDATE: 'cl-leaf-usage-tracker:limit',
  REQUEST: 'cl-leaf-usage-tracker:request',
  RESPONSE: 'cl-leaf-usage-tracker:response',
};

export const USAGE_BRIDGE_SCRIPT_PATH = 'src/page-bridges/usageTrackerBridge.js';

export const USAGE_POLL_MS = 5 * 60 * 1000;
export const USAGE_STALE_MS = 2 * 60 * 1000;
export const USAGE_REVALIDATE_MS = 1500;

export const USAGE_SELECTORS = {
  container: '[data-chat-input-container="true"]',
  editor: '[data-testid="chat-input"], [data-testid="prompt-input"]',
  addFilesButton: 'button[aria-label="Add files, connectors, and more"]',
  modelSelector: 'button[data-testid="model-selector-dropdown"]',
  voiceButton: 'button[aria-label="Use voice mode"]',
  sendButtonCandidates: [
    'button[type="submit"]',
    'button[aria-label="Send message"]',
    'button[aria-label="Send Message"]',
    'button[data-testid="send-button"]',
  ],
};
