import { SCHEDULE_MESSAGE_TYPES } from './constants.js';

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, response => {
        const lastError = chrome.runtime?.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }

        if (response?.error) {
          reject(new Error(response.error));
          return;
        }

        resolve(response || {});
      });
    } catch (error) {
      reject(error);
    }
  });
}

export default class ScheduleBackgroundClient {
  getForConversation(conversationUrl) {
    return sendRuntimeMessage({
      type: SCHEDULE_MESSAGE_TYPES.GET_FOR_CONVERSATION,
      conversationUrl,
    });
  }

  createOrUpdate(payload) {
    return sendRuntimeMessage({
      type: SCHEDULE_MESSAGE_TYPES.CREATE_OR_UPDATE,
      ...payload,
    });
  }

  cancel(payload) {
    return sendRuntimeMessage({
      type: SCHEDULE_MESSAGE_TYPES.CANCEL,
      ...payload,
    });
  }

  sendNow(payload) {
    return sendRuntimeMessage({
      type: SCHEDULE_MESSAGE_TYPES.SEND_NOW,
      ...payload,
    });
  }

  reportResult(payload) {
    return sendRuntimeMessage({
      type: SCHEDULE_MESSAGE_TYPES.EXECUTE_RESULT,
      ...payload,
    });
  }
}
