(function() {
  if (window.__flowCaptureContentLoaded) return;
  window.__flowCaptureContentLoaded = true;

  document.documentElement.dataset.flowcaptureExtension = chrome.runtime.getManifest().version || 'true';

  let isCapturing = false;
  let isPaused = false;
  let lastElement = null;
  let lastCaptureTime = 0;
  const DEBOUNCE_MS = 300;

  // Trusted origin patterns for FlowCapture web app
  // NOTE: For production deployment, update this list to include your production domain
  // or use externally_connectable in manifest.json for more secure validation
  const TRUSTED_ORIGIN_SUFFIXES = [
    '.repl.co',
    '.replit.dev',
    '.replit.app',
    '.flowcapture.com',  // Production domain (update as needed)
    '.flowcapture.app'   // Alternative production domain
  ];
  const TRUSTED_EXACT_ORIGINS = [
    'http://localhost:5000',
    'http://0.0.0.0:5000',
    'https://repl.co',
    'https://replit.dev',
    'https://replit.app',
    'https://flowcapture.com',
    'https://flowcapture.app'
  ];
  
  function isOriginTrusted(origin) {
    if (!origin || typeof origin !== 'string') return false;
    
    // Check exact matches first
    if (TRUSTED_EXACT_ORIGINS.includes(origin)) return true;
    
    // Check suffix matches for subdomains
    try {
      const url = new URL(origin);
      // Only trust https for production domains
      if (url.protocol === 'https:') {
        return TRUSTED_ORIGIN_SUFFIXES.some(suffix => url.hostname.endsWith(suffix));
      }
      // Also trust http for local development
      if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '0.0.0.0')) {
        return true;
      }
    } catch {
      return false;
    }
    
    return false;
  }

  function setupWebAppListener() {
    window.addEventListener('message', (event) => {
      // Security: Only accept messages from same window and trusted origins
      if (event.source !== window) return;
      if (!isOriginTrusted(event.origin)) {
        console.warn('[FlowCapture] Rejected message from untrusted origin:', event.origin);
        return;
      }
      
      switch (event.data?.type) {
        case 'FLOWCAPTURE_CHECK_EXTENSION':
          window.postMessage({
            type: 'FLOWCAPTURE_EXTENSION_PRESENT',
            version: chrome.runtime.getManifest().version
          }, event.origin);
          break;
          
        case 'FLOWCAPTURE_CHECK_PERMISSIONS':
          chrome.runtime.sendMessage({ type: 'CHECK_PERMISSIONS' }, (response) => {
            window.postMessage({
              type: 'FLOWCAPTURE_PERMISSIONS_STATUS',
              hasPermission: response?.hasPermission || false
            }, event.origin);
          });
          break;
          
        case 'FLOWCAPTURE_REQUEST_PERMISSIONS':
          chrome.runtime.sendMessage({ type: 'REQUEST_PERMISSIONS' }, (response) => {
            window.postMessage({
              type: 'FLOWCAPTURE_PERMISSIONS_RESULT',
              granted: response?.granted || false
            }, event.origin);
          });
          break;
          
        case 'FLOWCAPTURE_START_CAPTURE':
          chrome.runtime.sendMessage({
            type: 'START_CAPTURE',
            data: event.data.data || {}
          }, (response) => {
            window.postMessage({
              type: 'FLOWCAPTURE_CAPTURE_STARTED',
              success: response?.success || false
            }, event.origin);
          });
          break;
          
        case 'FLOWCAPTURE_STOP_CAPTURE':
          chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' }, (response) => {
            window.postMessage({
              type: 'FLOWCAPTURE_SESSION_ENDED',
              success: response?.success || false,
              stepCount: response?.stepCount || 0
            }, event.origin);
          });
          break;
          
        case 'FLOWCAPTURE_GET_STATUS':
          chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
            window.postMessage({
              type: 'FLOWCAPTURE_STATUS',
              isCapturing: response?.isCapturing || false,
              isPaused: response?.isPaused || false,
              stepCount: response?.stepCount || 0,
              guideId: response?.guideId || null
            }, event.origin);
          });
          break;
          
        case 'FLOWCAPTURE_SET_SESSION':
          chrome.runtime.sendMessage({ 
            type: 'SET_SESSION', 
            session: event.data.session 
          }, (response) => {
            window.postMessage({
              type: 'FLOWCAPTURE_SESSION_SET',
              success: response?.success || false,
              error: response?.error
            }, event.origin);
          });
          break;
          
        case 'FLOWCAPTURE_CLEAR_SESSION':
          chrome.runtime.sendMessage({ type: 'CLEAR_SESSION' }, (response) => {
            window.postMessage({
              type: 'FLOWCAPTURE_SESSION_CLEARED',
              success: response?.success || false
            }, event.origin);
          });
          break;
      }
    });
  }

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
    setupWebAppListener();
    
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
      window.FlowCaptureOverlay.stopRecording(false);
    }
    
    // Only notify trusted origins (same origin as current page)
    window.postMessage({
      type: 'FLOWCAPTURE_SESSION_ENDED',
      success: true
    }, window.location.origin);
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
