/**
 * FlowCapture Capture Agent
 * Handles DOM event capture, element serialization, and overlay coordination
 */

(function() {
  if (window.__flowCaptureCaptureAgent) return;
  window.__flowCaptureCaptureAgent = true;

  const MessageTypes = {
    START_CAPTURE: 'START_CAPTURE',
    STOP_CAPTURE: 'STOP_CAPTURE',
    PAUSE_CAPTURE: 'PAUSE_CAPTURE',
    RESUME_CAPTURE: 'RESUME_CAPTURE',
    STEP_CAPTURED: 'STEP_CAPTURED',
    SCREENSHOT_REQUEST: 'SCREENSHOT_REQUEST',
    PREPARE_SCREENSHOT: 'PREPARE_SCREENSHOT',
    READY_FOR_CAPTURE: 'READY_FOR_CAPTURE',
    GET_STATE: 'GET_STATE',
    STATE_UPDATE: 'STATE_UPDATE',
    SET_SESSION: 'SET_SESSION',
    CLEAR_SESSION: 'CLEAR_SESSION',
    CHECK_PERMISSIONS: 'CHECK_PERMISSIONS',
    REQUEST_PERMISSIONS: 'REQUEST_PERMISSIONS',
    NAVIGATION: 'NAVIGATION',
    PING: 'PING'
  };

  const PortNames = {
    CAPTURE_AGENT: 'flowcapture-capture-agent'
  };

  const OVERLAY_ID = 'flowcapture-overlay';
  const DEBOUNCE_MS = 300;
  
  let isCapturing = false;
  let isPaused = false;
  let lastElement = null;
  let lastCaptureTime = 0;
  let port = null;

  const TRUSTED_ORIGIN_SUFFIXES = [
    '.repl.co',
    '.replit.dev',
    '.replit.app',
    '.flowcapture.com',
    '.flowcapture.app'
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
    if (TRUSTED_EXACT_ORIGINS.includes(origin)) return true;
    
    try {
      const url = new URL(origin);
      if (url.protocol === 'https:') {
        return TRUSTED_ORIGIN_SUFFIXES.some(suffix => url.hostname.endsWith(suffix));
      }
      if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '0.0.0.0')) {
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  function connectPort() {
    try {
      port = chrome.runtime.connect({ name: PortNames.CAPTURE_AGENT });
      
      port.onMessage.addListener((message) => {
        handleBackgroundMessage(message);
      });
      
      port.onDisconnect.addListener(() => {
        port = null;
        setTimeout(connectPort, 1000);
      });
    } catch (e) {
      console.log('[FlowCapture] Port connection failed, retrying...');
      setTimeout(connectPort, 1000);
    }
  }

  function handleBackgroundMessage(message) {
    switch (message.type) {
      case MessageTypes.STATE_UPDATE:
        if (message.data) {
          const wasCapturing = isCapturing;
          isCapturing = message.data.isCapturing;
          isPaused = message.data.isPaused;
          
          if (!wasCapturing && isCapturing) {
            startCapture();
          } else if (wasCapturing && !isCapturing) {
            stopCapture();
          }
        }
        break;
      case MessageTypes.START_CAPTURE:
        startCapture();
        break;
      case MessageTypes.STOP_CAPTURE:
        stopCapture();
        break;
      case MessageTypes.PAUSE_CAPTURE:
        isPaused = true;
        break;
      case MessageTypes.RESUME_CAPTURE:
        isPaused = false;
        break;
      case MessageTypes.PREPARE_SCREENSHOT:
        prepareForScreenshot(message.data);
        break;
    }
  }

  function setupWebAppListener() {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      if (!isOriginTrusted(event.origin)) {
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
          chrome.runtime.sendMessage({ type: MessageTypes.CHECK_PERMISSIONS }, (response) => {
            window.postMessage({
              type: 'FLOWCAPTURE_PERMISSIONS_STATUS',
              hasPermission: response?.hasPermission || false
            }, event.origin);
          });
          break;
          
        case 'FLOWCAPTURE_REQUEST_PERMISSIONS':
          chrome.runtime.sendMessage({ type: MessageTypes.REQUEST_PERMISSIONS }, (response) => {
            window.postMessage({
              type: 'FLOWCAPTURE_PERMISSIONS_RESULT',
              granted: response?.granted || false
            }, event.origin);
          });
          break;
          
        case 'FLOWCAPTURE_START_CAPTURE':
          chrome.runtime.sendMessage({
            type: MessageTypes.START_CAPTURE,
            data: event.data.data || {}
          }, (response) => {
            window.postMessage({
              type: 'FLOWCAPTURE_CAPTURE_STARTED',
              success: response?.success || false
            }, event.origin);
          });
          break;
          
        case 'FLOWCAPTURE_STOP_CAPTURE':
          chrome.runtime.sendMessage({ type: MessageTypes.STOP_CAPTURE }, (response) => {
            window.postMessage({
              type: 'FLOWCAPTURE_SESSION_ENDED',
              success: response?.success || false,
              stepCount: response?.stepCount || 0
            }, event.origin);
          });
          break;
          
        case 'FLOWCAPTURE_GET_STATUS':
          chrome.runtime.sendMessage({ type: MessageTypes.GET_STATE }, (response) => {
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
            type: MessageTypes.SET_SESSION, 
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
          chrome.runtime.sendMessage({ type: MessageTypes.CLEAR_SESSION }, (response) => {
            window.postMessage({
              type: 'FLOWCAPTURE_SESSION_CLEARED',
              success: response?.success || false
            }, event.origin);
          });
          break;
      }
    });
  }

  function generateSelector(element) {
    if (!element || element === document.body || element === document.documentElement) {
      return null;
    }

    if (element.id && /^[a-zA-Z][\w-]*$/.test(element.id)) {
      return `#${element.id}`;
    }

    const dataTestId = element.getAttribute('data-testid');
    if (dataTestId) {
      return `[data-testid="${dataTestId}"]`;
    }

    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      const escaped = ariaLabel.replace(/"/g, '\\"');
      return `[aria-label="${escaped}"]`;
    }

    const path = [];
    let current = element;
    
    while (current && current !== document.body && path.length < 5) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id && /^[a-zA-Z][\w-]*$/.test(current.id)) {
        path.unshift(`#${current.id}`);
        break;
      }
      
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/)
          .filter(c => c && !c.startsWith('flowcapture') && /^[a-zA-Z][\w-]*$/.test(c))
          .slice(0, 2);
        if (classes.length) {
          selector += '.' + classes.join('.');
        }
      }
      
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(el => el.tagName === current.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }
      
      path.unshift(selector);
      current = parent;
    }
    
    return path.join(' > ');
  }

  function getElementMetadata(element) {
    const rect = element.getBoundingClientRect();
    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id || null,
      classList: Array.from(element.classList || []),
      textContent: (element.textContent || '').trim().slice(0, 100),
      placeholder: element.getAttribute('placeholder'),
      name: element.getAttribute('name'),
      type: element.getAttribute('type'),
      href: element.getAttribute('href'),
      ariaLabel: element.getAttribute('aria-label'),
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      }
    };
  }

  function isInteractable(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    
    const interactableTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL'];
    if (interactableTags.includes(element.tagName)) return true;
    
    const role = element.getAttribute('role');
    if (['button', 'link', 'checkbox', 'radio', 'tab', 'menuitem', 'option'].includes(role)) {
      return true;
    }
    
    if (element.onclick || element.getAttribute('onclick')) return true;
    if (element.hasAttribute('tabindex') && element.getAttribute('tabindex') !== '-1') return true;
    
    const style = window.getComputedStyle(element);
    if (style.cursor === 'pointer') return true;
    
    return false;
  }

  function isOverlayElement(element) {
    let current = element;
    while (current) {
      if (current.id === OVERLAY_ID || current.classList?.contains('flowcapture-overlay')) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  function startCapture() {
    isCapturing = true;
    isPaused = false;
    
    if (window.FlowCaptureOverlay) {
      window.FlowCaptureOverlay.startRecording();
    }
    
    injectOverlay();
  }

  function stopCapture() {
    isCapturing = false;
    isPaused = false;
    
    if (window.FlowCaptureOverlay) {
      window.FlowCaptureOverlay.stopRecording(false);
    }
    
    window.postMessage({
      type: 'FLOWCAPTURE_SESSION_ENDED',
      success: true
    }, window.location.origin);
  }

  function prepareForScreenshot(data) {
    const element = data?.selector ? document.querySelector(data.selector) : null;
    
    if (element) {
      element.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
    
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (port) {
          port.postMessage({ type: MessageTypes.READY_FOR_CAPTURE, data: { ready: true } });
        } else {
          chrome.runtime.sendMessage({ type: MessageTypes.READY_FOR_CAPTURE, data: { ready: true } });
        }
      });
    });
  }

  async function injectOverlay() {
    if (document.getElementById(OVERLAY_ID)) return;
    
    try {
      const overlayScript = document.createElement('script');
      overlayScript.src = chrome.runtime.getURL('overlay/overlay.js');
      overlayScript.onload = () => overlayScript.remove();
      (document.head || document.documentElement).appendChild(overlayScript);
    } catch (e) {
      console.log('[FlowCapture] Overlay injection failed:', e);
    }
  }

  function handleMouseOver(event) {
    if (!isCapturing || isPaused) return;
    
    const element = event.target;
    if (!isInteractable(element)) return;
    if (isOverlayElement(element)) return;

    if (window.FlowCaptureOverlay) {
      window.FlowCaptureOverlay.showHighlight(element);
    }
  }

  function handleMouseOut(event) {
    if (!isCapturing || isPaused) return;
    
    if (window.FlowCaptureOverlay) {
      window.FlowCaptureOverlay.hideHighlight();
    }
  }

  async function handleClick(event) {
    if (!isCapturing || isPaused) return;
    
    const element = event.target;
    
    if (isOverlayElement(element)) return;
    if (!isInteractable(element)) return;

    if (element === lastElement && Date.now() - lastCaptureTime < DEBOUNCE_MS) return;
    lastElement = element;
    lastCaptureTime = Date.now();

    const selector = generateSelector(element);
    if (!selector) return;

    if (window.FlowCaptureOverlay) {
      window.FlowCaptureOverlay.flashHighlight(element);
    }

    let screenshotDataUrl = null;
    try {
      const response = await chrome.runtime.sendMessage({ type: MessageTypes.SCREENSHOT_REQUEST });
      if (response?.dataUrl) {
        screenshotDataUrl = response.dataUrl;
      }
    } catch (e) {
      console.log('[FlowCapture] Screenshot request failed:', e);
    }

    const step = {
      action: 'click',
      actionType: 'click',
      selector: selector,
      url: window.location.href,
      screenshotDataUrl: screenshotDataUrl,
      elementMetadata: getElementMetadata(element),
      timestamp: Date.now()
    };

    if (window.FlowCaptureOverlay) {
      window.FlowCaptureOverlay.incrementStepCount();
    }

    if (port) {
      port.postMessage({ type: MessageTypes.STEP_CAPTURED, data: step });
    } else {
      chrome.runtime.sendMessage({ type: MessageTypes.STEP_CAPTURED, data: step }).catch(() => {});
    }
  }

  function handleInput(event) {
    if (!isCapturing || isPaused) return;
    
    const element = event.target;
    if (isOverlayElement(element)) return;
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) return;

    if (element === lastElement && Date.now() - lastCaptureTime < 1000) return;
    lastElement = element;
    lastCaptureTime = Date.now();

    const selector = generateSelector(element);
    if (!selector) return;

    const step = {
      action: 'input',
      actionType: 'input',
      selector: selector,
      url: window.location.href,
      elementMetadata: getElementMetadata(element),
      timestamp: Date.now()
    };

    if (port) {
      port.postMessage({ type: MessageTypes.STEP_CAPTURED, data: step });
    } else {
      chrome.runtime.sendMessage({ type: MessageTypes.STEP_CAPTURED, data: step }).catch(() => {});
    }
  }

  function setupEventListeners() {
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('input', handleInput, true);
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
      const message = {
        type: MessageTypes.NAVIGATION,
        data: { url: window.location.href, title: document.title }
      };
      
      if (port) {
        port.postMessage(message);
      } else {
        chrome.runtime.sendMessage(message).catch(() => {});
      }
    }
  }

  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case MessageTypes.START_CAPTURE:
          startCapture();
          sendResponse({ success: true });
          break;
        case MessageTypes.STOP_CAPTURE:
          stopCapture();
          sendResponse({ success: true });
          break;
        case MessageTypes.PAUSE_CAPTURE:
          isPaused = true;
          sendResponse({ success: true });
          break;
        case MessageTypes.RESUME_CAPTURE:
          isPaused = false;
          sendResponse({ success: true });
          break;
        case MessageTypes.PREPARE_SCREENSHOT:
          prepareForScreenshot(message.data);
          sendResponse({ success: true });
          break;
        case MessageTypes.PING:
          sendResponse({ pong: true });
          break;
      }
      return true;
    });
  }

  async function init() {
    document.documentElement.dataset.flowcaptureExtension = chrome.runtime.getManifest().version || 'true';
    
    setupWebAppListener();
    setupEventListeners();
    setupMessageListener();
    setupNavigationListeners();
    connectPort();

    try {
      const state = await chrome.runtime.sendMessage({ type: MessageTypes.GET_STATE });
      if (state?.isCapturing) {
        startCapture();
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
