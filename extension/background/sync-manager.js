const SYNC_CONFIG = {
  batchSize: 5,
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  screenshotMaxSizeBytes: 500 * 1024,
  syncIntervalMs: 10000,
  offlineQueueKey: 'flowcapture_offline_queue'
};

const SyncStatus = {
  PENDING: 'pending',
  UPLOADING: 'uploading',
  SAVED: 'saved',
  FAILED: 'failed',
  QUEUED: 'queued'
};

class SyncManager {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.syncedStepIds = new Set();
    this.retryAttempts = new Map();
    this.apiBaseUrl = null;
    this.guideId = null;
    this.onStatusChange = null;
    this.syncInterval = null;
    this.isOnline = true;
  }

  configure(apiBaseUrl, guideId) {
    this.apiBaseUrl = apiBaseUrl;
    this.guideId = guideId;
  }

  setStatusCallback(callback) {
    this.onStatusChange = callback;
  }

  async loadOfflineQueue() {
    try {
      const result = await chrome.storage.local.get(SYNC_CONFIG.offlineQueueKey);
      const stored = result[SYNC_CONFIG.offlineQueueKey];
      if (stored && Array.isArray(stored)) {
        const newItems = stored.filter(item => 
          !this.syncedStepIds.has(item.stepId) && 
          !this.queue.some(q => q.stepId === item.stepId)
        );
        this.queue.push(...newItems);
        console.log('[SyncManager] Loaded offline queue:', newItems.length, 'new items, total:', this.queue.length);
      }
    } catch (e) {
      console.error('[SyncManager] Failed to load offline queue:', e);
    }
  }

  async saveOfflineQueue() {
    try {
      await chrome.storage.local.set({
        [SYNC_CONFIG.offlineQueueKey]: this.queue.slice(0, 100)
      });
    } catch (e) {
      console.error('[SyncManager] Failed to save offline queue:', e);
    }
  }

  async enqueueStep(step) {
    const stepId = `${step.order}_${step.timestamp}`;
    
    if (this.syncedStepIds.has(stepId)) {
      console.log('[SyncManager] Duplicate step ignored:', stepId);
      return { success: true, duplicate: true };
    }

    const queueItem = {
      stepId,
      step: this.prepareStepPayload(step),
      screenshotDataUrl: step.screenshotDataUrl,
      addedAt: Date.now(),
      attempts: 0
    };

    this.queue.push(queueItem);
    this.updateStepStatus(step, SyncStatus.QUEUED);
    
    await this.saveOfflineQueue();
    
    if (!this.processing) {
      this.processQueue();
    }

    return { success: true, queued: true };
  }

  prepareStepPayload(step) {
    return {
      title: step.title || `Step ${step.order}`,
      description: step.description || '',
      actionType: step.actionType || 'click',
      selector: step.selector || '',
      url: step.url || '',
      order: step.order,
      tabId: step.tabId,
      timestamp: step.timestamp,
      elementMetadata: step.elementMetadata || {}
    };
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    if (!this.apiBaseUrl || !this.guideId) {
      console.log('[SyncManager] No API configured, queue paused');
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0 && this.isOnline) {
        const now = Date.now();
        const readyItems = [];
        const deferredItems = [];

        for (const item of this.queue) {
          if (!item.nextRetryAt || item.nextRetryAt <= now) {
            readyItems.push(item);
          } else {
            deferredItems.push(item);
          }
        }

        if (readyItems.length === 0) {
          const nextRetry = Math.min(...deferredItems.map(i => i.nextRetryAt));
          const waitTime = Math.max(100, nextRetry - now);
          console.log('[SyncManager] Waiting for backoff:', waitTime, 'ms');
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        this.queue = deferredItems;
        const batch = readyItems.slice(0, SYNC_CONFIG.batchSize);
        const remaining = readyItems.slice(SYNC_CONFIG.batchSize);
        this.queue.push(...remaining);

        await this.processBatch(batch);
      }
    } finally {
      this.processing = false;
      await this.saveOfflineQueue();
    }
  }

  async processBatch(batch) {
    const results = await Promise.allSettled(
      batch.map(item => this.syncStep(item))
    );

    results.forEach((result, index) => {
      const item = batch[index];
      
      if (result.status === 'fulfilled' && result.value.success) {
        this.syncedStepIds.add(item.stepId);
        this.retryAttempts.delete(item.stepId);
      } else {
        const attempts = (this.retryAttempts.get(item.stepId) || 0) + 1;
        this.retryAttempts.set(item.stepId, attempts);

        if (attempts < SYNC_CONFIG.maxRetries) {
          item.attempts = attempts;
          item.nextRetryAt = Date.now() + this.calculateBackoff(attempts);
          this.queue.push(item);
        } else {
          console.error('[SyncManager] Max retries exceeded for step:', item.stepId);
          this.updateStepStatus(item.step, SyncStatus.FAILED);
        }
      }
    });
  }

  async syncStep(item) {
    const { step, screenshotDataUrl, stepId } = item;

    try {
      this.updateStepStatus(step, SyncStatus.UPLOADING);

      let imageUrl = null;
      if (screenshotDataUrl) {
        imageUrl = await this.uploadScreenshot(screenshotDataUrl, stepId);
      }

      const payload = {
        ...step,
        imageUrl
      };

      const response = await this.fetchWithTimeout(
        `${this.apiBaseUrl}/api/guides/${this.guideId}/steps`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        },
        10000
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new SyncError(
          `Step save failed: ${response.status}`,
          response.status,
          this.classifyHttpError(response.status),
          errorBody
        );
      }

      const result = await response.json();
      this.updateStepStatus(step, SyncStatus.SAVED);
      
      console.log('[SyncManager] Step synced:', stepId);
      return { success: true, result };

    } catch (error) {
      console.error('[SyncManager] Sync error:', error.message);
      
      if (error.isNetworkError || error.errorType === 'transient') {
        this.isOnline = false;
        this.scheduleOnlineCheck();
      }

      throw error;
    }
  }

  async uploadScreenshot(dataUrl, stepId) {
    if (!dataUrl) return null;

    const compressedDataUrl = await this.compressScreenshot(dataUrl);
    const blob = this.dataUrlToBlob(compressedDataUrl);

    if (blob.size > SYNC_CONFIG.screenshotMaxSizeBytes * 2) {
      console.warn('[SyncManager] Screenshot too large, uploading in chunks');
      return await this.uploadLargeScreenshot(blob, stepId);
    }

    const presignedResponse = await this.fetchWithTimeout(
      `${this.apiBaseUrl}/api/uploads/request-url`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          name: `step_${stepId}.png`, 
          contentType: 'image/png',
          size: blob.size
        })
      },
      5000
    );

    if (!presignedResponse.ok) {
      throw new SyncError('Failed to get upload URL', presignedResponse.status, 'transient');
    }

    const { uploadURL, objectPath } = await presignedResponse.json();

    const uploadResponse = await this.fetchWithTimeout(
      uploadURL,
      {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'image/png' }
      },
      30000
    );

    if (!uploadResponse.ok) {
      throw new SyncError('Screenshot upload failed', uploadResponse.status, 'transient');
    }

    return objectPath;
  }

  async compressScreenshot(dataUrl) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = new OffscreenCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        
        let width = img.width;
        let height = img.height;
        const maxDimension = 1920;
        
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
          canvas.width = width;
          canvas.height = height;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.convertToBlob({ type: 'image/png', quality: 0.85 })
          .then(blob => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          })
          .catch(() => resolve(dataUrl));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  async uploadLargeScreenshot(blob, stepId) {
    const chunkSize = 256 * 1024;
    const totalChunks = Math.ceil(blob.size / chunkSize);
    
    const initResponse = await this.fetchWithTimeout(
      `${this.apiBaseUrl}/api/uploads/init-multipart`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          name: `step_${stepId}.png`, 
          contentType: 'image/png',
          totalChunks,
          totalSize: blob.size
        })
      },
      5000
    );

    if (!initResponse.ok) {
      console.warn('[SyncManager] Multipart not supported, falling back to single upload');
      return await this.uploadScreenshotDirect(blob, stepId);
    }

    const { uploadId, objectPath } = await initResponse.json();
    const parts = [];

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, blob.size);
      const chunk = blob.slice(start, end);

      const partResponse = await this.fetchWithTimeout(
        `${this.apiBaseUrl}/api/uploads/upload-part`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/octet-stream',
            'X-Upload-Id': uploadId,
            'X-Part-Number': String(i + 1)
          },
          credentials: 'include',
          body: chunk
        },
        15000
      );

      if (!partResponse.ok) {
        throw new SyncError(`Chunk ${i + 1} upload failed`, partResponse.status, 'transient');
      }

      const { etag } = await partResponse.json();
      parts.push({ partNumber: i + 1, etag });
    }

    const completeResponse = await this.fetchWithTimeout(
      `${this.apiBaseUrl}/api/uploads/complete-multipart`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ uploadId, parts })
      },
      5000
    );

    if (!completeResponse.ok) {
      throw new SyncError('Multipart complete failed', completeResponse.status, 'transient');
    }

    return objectPath;
  }

  async uploadScreenshotDirect(blob, stepId) {
    const presignedResponse = await this.fetchWithTimeout(
      `${this.apiBaseUrl}/api/uploads/request-url`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          name: `step_${stepId}.png`, 
          contentType: 'image/png' 
        })
      },
      5000
    );

    if (!presignedResponse.ok) {
      throw new SyncError('Failed to get upload URL', presignedResponse.status, 'transient');
    }

    const { uploadURL, objectPath } = await presignedResponse.json();

    const uploadResponse = await fetch(uploadURL, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': 'image/png' }
    });

    if (!uploadResponse.ok) {
      throw new SyncError('Direct upload failed', uploadResponse.status, 'transient');
    }

    return objectPath;
  }

  async fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { 
        ...options, 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        const syncError = new SyncError('Request timeout', 0, 'transient');
        syncError.isNetworkError = true;
        throw syncError;
      }
      
      const syncError = new SyncError(error.message, 0, 'transient');
      syncError.isNetworkError = true;
      throw syncError;
    }
  }

  calculateBackoff(attempt) {
    const delay = Math.min(
      SYNC_CONFIG.baseDelayMs * Math.pow(2, attempt - 1),
      SYNC_CONFIG.maxDelayMs
    );
    const jitter = delay * 0.2 * Math.random();
    return Math.round(delay + jitter);
  }

  classifyHttpError(status) {
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
      return 'permanent';
    }
    return 'transient';
  }

  scheduleOnlineCheck() {
    if (this.onlineCheckTimer) return;
    
    this.onlineCheckTimer = setTimeout(async () => {
      this.onlineCheckTimer = null;
      
      if (!this.apiBaseUrl) {
        return;
      }
      
      try {
        const response = await this.fetchWithTimeout(
          `${this.apiBaseUrl}/api/health`,
          { method: 'GET', credentials: 'include' },
          5000
        );
        
        if (response.ok) {
          this.isOnline = true;
          console.log('[SyncManager] Back online, resuming sync');
          if (this.queue.length > 0 && !this.processing) {
            this.processQueue();
          }
        } else {
          this.scheduleOnlineCheck();
        }
      } catch {
        this.scheduleOnlineCheck();
      }
    }, 10000);
  }

  updateStepStatus(step, status) {
    if (step && typeof step === 'object') {
      step.syncStatus = status;
    }
    if (this.onStatusChange) {
      this.onStatusChange(step?.order, status);
    }
  }

  dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
    const binary = atob(parts[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
  }

  startPeriodicSync() {
    if (this.syncInterval) return;
    
    this.syncInterval = setInterval(() => {
      if (this.queue.length > 0 && this.isOnline && !this.processing) {
        console.log('[SyncManager] Periodic sync triggered');
        this.processQueue();
      }
    }, SYNC_CONFIG.syncIntervalMs);
  }

  stopPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  async flush() {
    await this.processQueue();
    return {
      pending: this.queue.length,
      synced: this.syncedStepIds.size
    };
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      syncedCount: this.syncedStepIds.size,
      isOnline: this.isOnline,
      isProcessing: this.processing
    };
  }

  reset() {
    this.queue = [];
    this.syncedStepIds.clear();
    this.retryAttempts.clear();
    this.stopPeriodicSync();
    chrome.storage.local.remove(SYNC_CONFIG.offlineQueueKey);
  }
}

class SyncError extends Error {
  constructor(message, statusCode, errorType, body = '') {
    super(message);
    this.name = 'SyncError';
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.body = body;
    this.isNetworkError = false;
  }
}

const syncManager = new SyncManager();

export { syncManager, SyncManager, SyncStatus, SYNC_CONFIG };
