export const SCHEDULE_MESSAGE_TYPES = {
  GET_FOR_CONVERSATION: 'SCHEDULE_GET_FOR_CONVERSATION',
  CREATE_OR_UPDATE: 'SCHEDULE_CREATE_OR_UPDATE',
  CANCEL: 'SCHEDULE_CANCEL',
  SEND_NOW: 'SCHEDULE_SEND_NOW',
  EXECUTE: 'SCHEDULE_EXECUTE',
  EXECUTE_RESULT: 'SCHEDULE_EXECUTE_RESULT',
};

export const SCHEDULE_STATUS = {
  PENDING: 'pending',
  RETRYING: 'retrying',
  SENT: 'sent',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
  EXPIRED_SESSION: 'expired_session',
};

export const ACTIVE_SCHEDULE_STATUSES = new Set([
  SCHEDULE_STATUS.PENDING,
  SCHEDULE_STATUS.RETRYING,
]);

export const SCHEDULE_PRESETS = [
  { label: '5m', delayMs: 5 * 60 * 1000 },
  { label: '15m', delayMs: 15 * 60 * 1000 },
  { label: '30m', delayMs: 30 * 60 * 1000 },
  { label: '1h', delayMs: 60 * 60 * 1000 },
];

export const SCHEDULE_ICON_PATH =
  'M12 8v4l2.5 1.5M20 12a8 8 0 1 1-16 0a8 8 0 0 1 16 0Zm-3-9V1m0 2h2m-2 0h-2';

export const SCHEDULE_SELECTORS = {
  container: '[data-chat-input-container="true"]',
  editor: '[data-testid="chat-input"], [data-testid="prompt-input"]',
  fileUpload: 'input[data-testid="file-upload"]',
  addFilesButton: 'button[aria-label="Add files, connectors, and more"]',
  modelSelector: 'button[data-testid="model-selector-dropdown"]',
  voiceButton: 'button[aria-label="Use voice mode"]',
  sendButtonCandidates: [
    'button[type="submit"]',
    'button[aria-label="Send message"]',
    'button[aria-label="Send Message"]',
    'button[data-testid="send-button"]',
  ],
  attachmentIndicators: [
    '[data-testid*="attachment"]',
    '[data-testid="file-thumbnail"]',
    '[data-testid*="file-thumbnail"]',
    '[data-testid*="file-chip"]',
    '[data-testid*="file-preview"]',
    '[aria-label*="Remove file"]',
    '[aria-label*="Remove attachment"]',
    'button[aria-label="Remove"][aria-describedby]',
    '[data-schedule-attachment-state="present"]',
  ],
  attachmentUnknownIndicators: [
    '[data-schedule-attachment-state="unknown"]',
    '[data-testid*="dropzone"]',
    '[data-testid*="uploader"]',
  ],
};

export const SCHEDULE_CLASSNAMES = {
  buttonRoot: 'cl-schedule-button-root',
  button: 'cl-schedule-button',
  popover: 'cl-schedule-popover',
  status: 'cl-schedule-status',
};
