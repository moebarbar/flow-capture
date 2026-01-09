const MessageTypes = {
  START_CAPTURE: 'START_CAPTURE',
  STOP_CAPTURE: 'STOP_CAPTURE',
  PAUSE_CAPTURE: 'PAUSE_CAPTURE',
  RESUME_CAPTURE: 'RESUME_CAPTURE',
  STEP_CAPTURED: 'STEP_CAPTURED',
  SCREENSHOT_REQUEST: 'SCREENSHOT_REQUEST',
  SCREENSHOT_RESPONSE: 'SCREENSHOT_RESPONSE',
  CAPTURE_STATE_CHANGED: 'CAPTURE_STATE_CHANGED',
  GET_CAPTURE_STATE: 'GET_CAPTURE_STATE',
  SYNC_TO_SERVER: 'SYNC_TO_SERVER',
  SYNC_COMPLETE: 'SYNC_COMPLETE',
  SYNC_ERROR: 'SYNC_ERROR',
  PERMISSIONS_REQUIRED: 'PERMISSIONS_REQUIRED',
  PERMISSIONS_GRANTED: 'PERMISSIONS_GRANTED',
  PING: 'PING',
  PONG: 'PONG'
};

class MessageBus {
  constructor() {
    this.listeners = new Map();
    this.pendingResponses = new Map();
    this.messageId = 0;
  }

  generateId() {
    return `msg_${Date.now()}_${++this.messageId}`;
  }

  on(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(handler);
    return () => this.listeners.get(type).delete(handler);
  }

  off(type, handler) {
    if (this.listeners.has(type)) {
      this.listeners.get(type).delete(handler);
    }
  }

  emit(type, data) {
    if (this.listeners.has(type)) {
      this.listeners.get(type).forEach(handler => {
        try {
          handler(data);
        } catch (e) {
          console.error(`[MessageBus] Handler error for ${type}:`, e);
        }
      });
    }
  }

  async sendToBackground(type, data = {}, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const messageId = this.generateId();
      const message = { type, data, messageId };
      
      const timer = setTimeout(() => {
        this.pendingResponses.delete(messageId);
        reject(new Error(`Message timeout: ${type}`));
      }, timeout);

      this.pendingResponses.set(messageId, { resolve, reject, timer });

      chrome.runtime.sendMessage(message, response => {
        clearTimeout(timer);
        this.pendingResponses.delete(messageId);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }

  async sendToTab(tabId, type, data = {}) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { type, data }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  async broadcast(type, data = {}) {
    const tabs = await chrome.tabs.query({});
    const promises = tabs.map(tab => {
      if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
        return Promise.resolve();
      }
      return this.sendToTab(tab.id, type, data).catch(() => {});
    });
    return Promise.allSettled(promises);
  }
}

const messageBus = new MessageBus();

if (typeof window !== 'undefined') {
  window.FlowCaptureMessaging = { MessageTypes, messageBus };
}

if (typeof globalThis !== 'undefined') {
  globalThis.FlowCaptureMessaging = { MessageTypes, messageBus };
}
