/**
 * FlowCapture Tab Bridge
 * Manages long-lived port connections between content scripts and background
 */

(function() {
  if (window.__flowCaptureTabBridge) return;
  window.__flowCaptureTabBridge = true;

  class TabBridge {
    constructor() {
      this.port = null;
      this.pendingRequests = new Map();
      this.requestIdCounter = 0;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 5;
      this.reconnectDelay = 1000;
      this.listeners = new Map();
    }

    connect() {
      if (this.port) {
        try {
          this.port.disconnect();
        } catch {}
      }

      try {
        this.port = chrome.runtime.connect({ 
          name: `flowcapture-tab-${Date.now()}` 
        });
        
        this.port.onMessage.addListener((message) => this.handleMessage(message));
        
        this.port.onDisconnect.addListener(() => {
          this.port = null;
          this.handleDisconnect();
        });
        
        this.reconnectAttempts = 0;
        console.log('[FlowCapture] Tab bridge connected');
        
        return true;
      } catch (e) {
        console.error('[FlowCapture] Tab bridge connection failed:', e);
        return false;
      }
    }

    handleDisconnect() {
      this.pendingRequests.forEach((request) => {
        request.reject(new Error('Port disconnected'));
      });
      this.pendingRequests.clear();

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        console.log(`[FlowCapture] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connect(), delay);
      }
    }

    handleMessage(message) {
      const { type, data, requestId } = message;

      if (requestId && type.endsWith('_RESPONSE')) {
        const pending = this.pendingRequests.get(requestId);
        if (pending) {
          this.pendingRequests.delete(requestId);
          if (data?.error) {
            pending.reject(new Error(data.error));
          } else {
            pending.resolve(data);
          }
        }
        return;
      }

      const listeners = this.listeners.get(type) || [];
      listeners.forEach(callback => {
        try {
          callback(data, message);
        } catch (e) {
          console.error('[FlowCapture] Listener error:', e);
        }
      });
    }

    send(type, data = {}) {
      if (!this.port) {
        if (!this.connect()) {
          return Promise.reject(new Error('Not connected'));
        }
      }

      try {
        this.port.postMessage({ type, data });
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e);
      }
    }

    request(type, data = {}, timeout = 5000) {
      return new Promise((resolve, reject) => {
        if (!this.port) {
          if (!this.connect()) {
            return reject(new Error('Not connected'));
          }
        }

        const requestId = `req_${++this.requestIdCounter}_${Date.now()}`;
        
        const timeoutId = setTimeout(() => {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }, timeout);

        this.pendingRequests.set(requestId, {
          resolve: (result) => {
            clearTimeout(timeoutId);
            resolve(result);
          },
          reject: (error) => {
            clearTimeout(timeoutId);
            reject(error);
          }
        });

        try {
          this.port.postMessage({ type, data, requestId });
        } catch (e) {
          this.pendingRequests.delete(requestId);
          clearTimeout(timeoutId);
          reject(e);
        }
      });
    }

    on(type, callback) {
      if (!this.listeners.has(type)) {
        this.listeners.set(type, []);
      }
      this.listeners.get(type).push(callback);
      
      return () => this.off(type, callback);
    }

    off(type, callback) {
      const listeners = this.listeners.get(type);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    }

    disconnect() {
      if (this.port) {
        try {
          this.port.disconnect();
        } catch {}
        this.port = null;
      }
      this.pendingRequests.clear();
      this.listeners.clear();
    }
  }

  const bridge = new TabBridge();
  bridge.connect();

  window.FlowCaptureTabBridge = bridge;
})();
