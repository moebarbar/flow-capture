const MessageTypes = {
  START_CAPTURE: 'START_CAPTURE',
  STOP_CAPTURE: 'STOP_CAPTURE',
  PAUSE_CAPTURE: 'PAUSE_CAPTURE',
  RESUME_CAPTURE: 'RESUME_CAPTURE',
  STEP_CAPTURED: 'STEP_CAPTURED',
  SCREENSHOT_REQUEST: 'SCREENSHOT_REQUEST',
  SCREENSHOT_RESPONSE: 'SCREENSHOT_RESPONSE',
  GET_STATE: 'GET_STATE',
  STATE_UPDATE: 'STATE_UPDATE',
  NAVIGATION: 'NAVIGATION',
  SYNC_STEPS: 'SYNC_STEPS',
  PING: 'PING'
};

const Messaging = {
  send(type, data = {}) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ type, data }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  },

  sendToTab(tabId, type, data = {}) {
    return new Promise((resolve, reject) => {
      try {
        chrome.tabs.sendMessage(tabId, { type, data }, (response) => {
          if (chrome.runtime.lastError) {
            resolve(null);
          } else {
            resolve(response);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  },

  startCapture(config = {}) {
    return this.send(MessageTypes.START_CAPTURE, config);
  },

  stopCapture() {
    return this.send(MessageTypes.STOP_CAPTURE);
  },

  pauseCapture() {
    return this.send(MessageTypes.PAUSE_CAPTURE);
  },

  resumeCapture() {
    return this.send(MessageTypes.RESUME_CAPTURE);
  },

  captureStep(step) {
    return this.send(MessageTypes.STEP_CAPTURED, step);
  },

  requestScreenshot() {
    return this.send(MessageTypes.SCREENSHOT_REQUEST);
  },

  getState() {
    return this.send(MessageTypes.GET_STATE);
  },

  reportNavigation(url, title) {
    return this.send(MessageTypes.NAVIGATION, { url, title });
  },

  syncSteps() {
    return this.send(MessageTypes.SYNC_STEPS);
  },

  ping() {
    return this.send(MessageTypes.PING);
  }
};

if (typeof window !== 'undefined') {
  window.FlowCaptureMessaging = Messaging;
  window.FlowCaptureMessageTypes = MessageTypes;
}
