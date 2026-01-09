const Screenshot = {
  async capture() {
    try {
      const response = await window.FlowCaptureMessaging.requestScreenshot();
      if (response?.dataUrl) {
        return response.dataUrl;
      }
      return null;
    } catch (e) {
      console.error('[FlowCapture] Screenshot capture failed:', e);
      return null;
    }
  },

  async captureWithHighlight(element) {
    if (element && window.FlowCaptureOverlay) {
      window.FlowCaptureOverlay.flashHighlight(element);
    }
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return await this.capture();
  }
};

if (typeof window !== 'undefined') {
  window.FlowCaptureScreenshot = Screenshot;
}
