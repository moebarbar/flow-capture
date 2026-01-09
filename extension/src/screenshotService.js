class ScreenshotService {
  constructor() {
    this.pendingCaptures = new Map();
  }

  async captureVisibleTab() {
    return new Promise((resolve, reject) => {
      const messageId = `screenshot_${Date.now()}`;
      
      chrome.runtime.sendMessage(
        { type: 'SCREENSHOT_REQUEST', messageId },
        response => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response?.error) {
            reject(new Error(response.error));
          } else if (response?.dataUrl) {
            resolve(response.dataUrl);
          } else {
            reject(new Error('No screenshot data received'));
          }
        }
      );
    });
  }

  async captureWithHighlight(element, highlightColor = '#ef4444') {
    const originalOutline = element.style.outline;
    const originalOutlineOffset = element.style.outlineOffset;
    const originalZIndex = element.style.zIndex;
    const originalPosition = element.style.position;
    
    element.style.outline = `3px solid ${highlightColor}`;
    element.style.outlineOffset = '2px';
    
    await new Promise(r => setTimeout(r, 50));
    
    try {
      const dataUrl = await this.captureVisibleTab();
      return dataUrl;
    } finally {
      element.style.outline = originalOutline;
      element.style.outlineOffset = originalOutlineOffset;
      element.style.zIndex = originalZIndex;
      element.style.position = originalPosition;
    }
  }

  async cropToElement(fullDataUrl, bounds, padding = 50) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const devicePixelRatio = window.devicePixelRatio || 1;
        
        const x = Math.max(0, (bounds.viewportX - padding) * devicePixelRatio);
        const y = Math.max(0, (bounds.viewportY - padding) * devicePixelRatio);
        const width = Math.min(
          img.width - x,
          (bounds.width + padding * 2) * devicePixelRatio
        );
        const height = Math.min(
          img.height - y,
          (bounds.height + padding * 2) * devicePixelRatio
        );

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Failed to load screenshot'));
      img.src = fullDataUrl;
    });
  }

  dataUrlToBlob(dataUrl) {
    const parts = dataUrl.split(',');
    const mime = parts[0].match(/:(.*?);/)[1];
    const binary = atob(parts[1]);
    const array = new Uint8Array(binary.length);
    
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    
    return new Blob([array], { type: mime });
  }

  async uploadScreenshot(dataUrl, uploadUrl) {
    const blob = this.dataUrlToBlob(dataUrl);
    
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: blob,
      headers: {
        'Content-Type': 'image/png'
      }
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status}`);
    }

    return true;
  }
}

if (typeof window !== 'undefined') {
  window.FlowCaptureScreenshot = new ScreenshotService();
}
