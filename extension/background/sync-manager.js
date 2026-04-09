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
    this.onAuthRequired = null;
    this.onAuthRestored = null;
    this.syncInterval = null;
    this.isOnline = true;
    this.authExpired = false;
    this.authCheckTimer = null;
    this.extensionToken = null; // Bearer token for cross-origin auth
  }

  configure(apiBaseUrl, guideId) {
    this.apiBaseUrl = apiBaseUrl;
    this.guideId = guideId;
  }

  setExtensionToken(token) {
    this.extensionToken = token;
  }

  // Build fetch options, injecting Authorization header when a token is available.
  // Falls back to cookie-based auth when no token is set.
  buildFetchOptions(options = {}) {
    const headers = { ...(options.headers || {}) };
    if (this.extensionToken) {
      headers['Authorization'] = `Bearer ${this.extensionToken}`;
    }
    const opts = { ...options, headers };
    // Only include credentials when NOT using a Bearer token to avoid CORS
    // preflight issues on some configurations.
    if (!this.extensionToken) {
      opts.credentials = 'include';
    }
    return opts;
  }

  // Request a new extension token from the server (requires an active session cookie).
  async requestExtensionToken() {
    if (!this.apiBaseUrl) return null;
    try {
      const response = await this.fetchWithTimeout(
        `${this.apiBaseUrl}/api/auth/extension-token`,
        { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } },
        5000
      );
      if (!response.ok) return null;
      const { token } = await response.json();
      if (token) {
        this.extensionToken = token;
        await chrome.storage.local.set({ flowcapture_extension_token: token });
        console.log('[SyncManager] Extension token acquired and stored');
        return token;
      }
    } catch (e) {
      console.warn('[SyncManager] Could not acquire extension token:', e.message);
    }
    return null;
  }

  // Load a previously stored extension token from chrome.storage.local.
  async loadStoredToken() {
    try {
      const result = await chrome.storage.local.get('flowcapture_extension_token');
      if (result.flowcapture_extension_token) {
        this.extensionToken = result.flowcapture_extension_token;
        console.log('[SyncManager] Loaded stored extension token');
        return true;
      }
    } catch (e) {
      console.warn('[SyncManager] Could not load stored token:', e.message);
    }
    return false;
  }

  setStatusCallback(callback) {
    this.onStatusChange = callback;
  }

  setAuthRequiredCallback(callback) {
    this.onAuthRequired = callback;
  }

  setAuthRestoredCallback(callback) {
    this.onAuthRestored = callback;
  }

  clearAuthExpired() {
    if (!this.authExpired) return;
    
    this.authExpired = false;
    console.log('[SyncManager] Auth expired flag cleared');
    
    if (this.authCheckTimer) {
      clearTimeout(this.authCheckTimer);
      this.authCheckTimer = null;
    }
    
    if (this.onAuthRestored) {
      this.onAuthRestored();
    }
    
    if (this.queue.length > 0 && !this.processing) {
      this.processQueue();
    }
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
      screenshotUrl: step.screenshotUrl, // Already-uploaded URL (if available)
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
      metadata: step.elementMetadata || {}
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

    if (this.authExpired) {
      console.log('[SyncManager] Auth expired, queue paused until re-authentication');
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0 && this.isOnline && !this.authExpired) {
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
    const { step, screenshotDataUrl, screenshotUrl, stepId } = item;

    try {
      this.updateStepStatus(step, SyncStatus.UPLOADING);

      // Use already-uploaded URL if available, otherwise upload the data URL
      let imageUrl = screenshotUrl || null;
      if (!imageUrl && screenshotDataUrl) {
        imageUrl = await this.uploadScreenshot(screenshotDataUrl, stepId);
      }

      const payload = {
        ...step,
        imageUrl
      };

      const response = await this.fetchWithTimeout(
        `${this.apiBaseUrl}/api/guides/${this.guideId}/steps`,
        this.buildFetchOptions({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }),
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
      
      if (error.errorType === 'auth_required') {
        this.authExpired = true;
        console.log('[SyncManager] Auth expired detected, pausing sync');
        if (this.onAuthRequired) {
          this.onAuthRequired();
        }
        this.scheduleAuthCheck();
      } else if (error.isNetworkError || error.errorType === 'transient') {
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
      this.buildFetchOptions({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `step_${stepId}.png`,
          contentType: 'image/png',
          size: blob.size
        })
      }),
      5000
    );

    if (!presignedResponse.ok) {
      throw new SyncError('Failed to get upload URL', presignedResponse.status, 'transient');
    }

    const { uploadURL, objectPath } = await presignedResponse.json();

    // PUT to the presigned GCS URL - no auth headers needed here (it's a signed URL)
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

    // Ensure URL has /objects/ prefix for consistency with service-worker
    return objectPath.startsWith('/objects/') ? objectPath : `/objects/${objectPath}`;
  }

  async compressScreenshot(dataUrl) {
    // Service-worker-safe compression: no new Image(), no FileReader().
    // Uses createImageBitmap() + OffscreenCanvas + arrayBuffer() + btoa().
    try {
      const blob = this.dataUrlToBlob(dataUrl);
      const bitmap = await createImageBitmap(blob);
      let { width, height } = bitmap;
      const maxDimension = 1920;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = new OffscreenCanvas(width, height);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      const compressed = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
      const buf = await compressed.arrayBuffer();
      const bytes = new Uint8Array(buf);
      // Chunk btoa to avoid call-stack overflow on large images
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      return `data:image/jpeg;base64,${btoa(binary)}`;
    } catch (e) {
      console.warn('[SyncManager] Screenshot compression failed, uploading original:', e.message);
      return dataUrl;
    }
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

    // Ensure URL has /objects/ prefix for consistency with service-worker
    return objectPath.startsWith('/objects/') ? objectPath : `/objects/${objectPath}`;
  }

  async uploadScreenshotDirect(blob, stepId) {
    const presignedResponse = await this.fetchWithTimeout(
      `${this.apiBaseUrl}/api/uploads/request-url`,
      this.buildFetchOptions({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `step_${stepId}.png`,
          contentType: 'image/png'
        })
      }),
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

    // Ensure URL has /objects/ prefix for consistency with service-worker
    return objectPath.startsWith('/objects/') ? objectPath : `/objects/${objectPath}`;
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
    if (status === 401 || status === 403) {
      return 'auth_required';
    }
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

  scheduleAuthCheck() {
    if (this.authCheckTimer) return;
    if (!this.authExpired) return;
    
    this.authCheckTimer = setTimeout(async () => {
      this.authCheckTimer = null;
      
      if (!this.apiBaseUrl || !this.authExpired) {
        return;
      }
      
      try {
        const response = await this.fetchWithTimeout(
          `${this.apiBaseUrl}/api/user`,
          this.buildFetchOptions({ method: 'GET' }),
          5000
        );
        
        if (response.ok) {
          console.log('[SyncManager] Auth restored, resuming sync');
          this.clearAuthExpired();
        } else if (response.status === 401 || response.status === 403) {
          this.scheduleAuthCheck();
        } else {
          this.scheduleAuthCheck();
        }
      } catch {
        this.scheduleAuthCheck();
      }
    }, 15000);
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
