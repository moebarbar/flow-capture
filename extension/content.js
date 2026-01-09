(function() {
  if (window.__flowCaptureContentLoaded) return;
  window.__flowCaptureContentLoaded = true;

  let isCapturing = false;
  let isPaused = false;
  let lastElement = null;
  let lastCaptureTime = 0;
  const DEBOUNCE_MS = 300;

  function loadScript(src) {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(src);
      script.onload = () => {
        script.remove();
        resolve();
      };
      script.onerror = () => {
        script.remove();
        resolve();
      };
      (document.head || document.documentElement).appendChild(script);
    });
  }

  async function init() {
    await loadScript('messaging.js');
    await loadScript('selector.js');
    await loadScript('screenshot.js');
    await loadScript('overlay.js');

    setupEventListeners();
    setupMessageListener();
    setupNavigationListeners();

    try {
      const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      if (state?.isCapturing) {
        startCapture();
      }
    } catch (e) {}
  }

  function setupEventListeners() {
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleClick, true);
  }

  function setupNavigationListeners() {
    const originalPushState = history.pushState;
    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      reportNavigation();
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      reportNavigation();
    };

    window.addEventListener('popstate', reportNavigation);
  }

  function reportNavigation() {
    if (isCapturing && !isPaused) {
      chrome.runtime.sendMessage({
        type: 'NAVIGATION',
        data: { url: window.location.href, title: document.title }
      }).catch(() => {});
    }
  }

  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'START_CAPTURE':
          startCapture();
          sendResponse({ success: true });
          break;
        case 'STOP_CAPTURE':
          stopCapture();
          sendResponse({ success: true });
          break;
        case 'PAUSE_CAPTURE':
          isPaused = true;
          sendResponse({ success: true });
          break;
        case 'RESUME_CAPTURE':
          isPaused = false;
          sendResponse({ success: true });
          break;
        case 'PING':
          sendResponse({ pong: true });
          break;
      }
      return true;
    });
  }

  function startCapture() {
    isCapturing = true;
    isPaused = false;
    
    if (window.FlowCaptureOverlay) {
      window.FlowCaptureOverlay.startRecording();
    }
  }

  function stopCapture() {
    isCapturing = false;
    isPaused = false;
    
    if (window.FlowCaptureOverlay) {
      window.FlowCaptureOverlay.stopRecording();
    }
  }

  function handleMouseOver(event) {
    if (!isCapturing || isPaused) return;
    
    const element = event.target;
    if (!window.FlowCaptureSelector?.isInteractable(element)) return;
    if (window.FlowCaptureSelector?.isOverlayElement(element)) return;
    if (window.FlowCaptureOverlay?.isOverlayClick(element)) return;

    window.FlowCaptureOverlay?.showHighlight(element);
  }

  function handleMouseOut(event) {
    if (!isCapturing || isPaused) return;
    window.FlowCaptureOverlay?.hideHighlight();
  }

  async function handleClick(event) {
    if (!isCapturing || isPaused) return;
    
    const element = event.target;
    
    if (window.FlowCaptureOverlay?.isOverlayClick(element)) return;
    if (window.FlowCaptureSelector?.isOverlayElement(element)) return;
    if (!window.FlowCaptureSelector?.isInteractable(element)) return;

    if (element === lastElement && Date.now() - lastCaptureTime < DEBOUNCE_MS) return;
    lastElement = element;
    lastCaptureTime = Date.now();

    const selector = window.FlowCaptureSelector?.generate(element);
    if (!selector) return;

    let screenshot = null;
    try {
      screenshot = await window.FlowCaptureScreenshot?.captureWithHighlight(element);
    } catch (e) {}

    const step = {
      action: 'click',
      selector: selector,
      url: window.location.href,
      screenshot: screenshot,
      timestamp: Date.now()
    };

    window.FlowCaptureOverlay?.incrementStepCount();

    chrome.runtime.sendMessage({
      type: 'STEP_CAPTURED',
      data: step
    }).catch(() => {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
