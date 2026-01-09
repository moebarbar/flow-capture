declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage: (extensionId: string, message: any, callback?: (response: any) => void) => void;
      };
    };
  }
}

const EXTENSION_ID_KEY = 'flowcapture_extension_id';

export interface ExtensionStatus {
  installed: boolean;
  version?: string;
  isCapturing?: boolean;
}

export interface CaptureSessionOptions {
  guideId: number;
  workspaceId: number;
  highlightColor?: string;
}

class ExtensionBridge {
  private extensionId: string | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor() {
    this.extensionId = localStorage.getItem(EXTENSION_ID_KEY);
    this.setupMessageListener();
  }

  private setupMessageListener() {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event) => {
        if (event.data?.source === 'flowcapture-extension') {
          this.handleExtensionMessage(event.data);
        }
      });
    }
  }

  private handleExtensionMessage(data: any) {
    const { type, payload } = data;
    if (this.listeners.has(type)) {
      this.listeners.get(type)?.forEach(callback => callback(payload));
    }
  }

  on(type: string, callback: (data: any) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)?.add(callback);
    return () => this.listeners.get(type)?.delete(callback);
  }

  setExtensionId(id: string) {
    this.extensionId = id;
    localStorage.setItem(EXTENSION_ID_KEY, id);
  }

  getExtensionId(): string | null {
    return this.extensionId;
  }

  private sendMessage<T>(message: any): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!window.chrome?.runtime?.sendMessage) {
        reject(new Error('Chrome extension API not available'));
        return;
      }

      if (!this.extensionId) {
        reject(new Error('Extension ID not configured'));
        return;
      }

      try {
        window.chrome.runtime.sendMessage(this.extensionId, message, (response) => {
          if (response?.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  async ping(): Promise<ExtensionStatus> {
    try {
      const response = await this.sendMessage<{ pong: boolean; version: string; isCapturing: boolean }>({ 
        type: 'PING' 
      });
      return {
        installed: response.pong === true,
        version: response.version,
        isCapturing: response.isCapturing
      };
    } catch {
      return { installed: false };
    }
  }

  async checkStatus(): Promise<ExtensionStatus> {
    return this.ping();
  }

  async startCaptureSession(options: CaptureSessionOptions): Promise<{ success: boolean; error?: string }> {
    const apiBaseUrl = window.location.origin;
    
    try {
      const response = await this.sendMessage<{ success: boolean; error?: string }>({
        type: 'START_CAPTURE_SESSION',
        data: {
          ...options,
          apiBaseUrl
        }
      });
      return response;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async stopCaptureSession(): Promise<{ success: boolean; stepCount?: number }> {
    try {
      const response = await this.sendMessage<{ success: boolean; stepCount: number }>({
        type: 'STOP_CAPTURE_SESSION'
      });
      return response;
    } catch (e: any) {
      return { success: false };
    }
  }

  async getCaptureStatus(): Promise<{ isCapturing: boolean; stepCount: number; guideId?: number }> {
    try {
      const response = await this.sendMessage<{ isCapturing: boolean; isPaused: boolean; stepCount: number; guideId: number }>({
        type: 'GET_CAPTURE_STATUS'
      });
      return response;
    } catch {
      return { isCapturing: false, stepCount: 0 };
    }
  }

  async detectExtension(): Promise<boolean> {
    const testIds = [
      localStorage.getItem(EXTENSION_ID_KEY),
    ].filter(Boolean) as string[];

    for (const id of testIds) {
      this.extensionId = id;
      const status = await this.ping();
      if (status.installed) {
        this.setExtensionId(id);
        return true;
      }
    }

    this.extensionId = null;
    return false;
  }
}

export const extensionBridge = new ExtensionBridge();
