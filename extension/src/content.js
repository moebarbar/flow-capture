if (window.__flowcaptureInitialized) {
  console.log('FlowCapture: Already initialized, skipping');
} else {
  window.__flowcaptureInitialized = true;

  // Set DOM marker immediately for reliable extension detection
  try {
    const manifest = chrome.runtime.getManifest();
    document.documentElement.dataset.flowcaptureExtension = manifest.version;
  } catch (e) {
    document.documentElement.dataset.flowcaptureExtension = 'true';
  }

  let isCapturing = false;
  let isPaused = false;
  let isElementCaptureMode = false;
  let highlightOverlay = null;
  let hoverHighlight = null;
  let lastClickTime = 0;
  let borderColor = '#7C3AED';
  const CLICK_DEBOUNCE_MS = 300;

  async function init() {
    try {
      const { isCapturing: capturing, borderColor: savedColor, isPaused: paused } = await chrome.storage.local.get(['isCapturing', 'borderColor', 'isPaused']);
      isCapturing = capturing || false;
      isPaused = paused || false;
      borderColor = savedColor || '#7C3AED';
      
      if (isCapturing && !isPaused) {
        setupEventListeners();
        showCapturingIndicator();
      }
    } catch (e) {
      console.error('FlowCapture init error:', e);
    }
  }

  const ALLOWED_ORIGINS = [
    'https://flowcapture.replit.app',
    'http://localhost:5000',
    'https://localhost:5000'
  ];

  const ALLOWED_ORIGIN_SUFFIXES = [
    '.replit.dev',
    '.repl.co',
    '.replit.app'
  ];

  function hasAllowedSuffix(origin) {
    try {
      const url = new URL(origin);
      const hostname = url.hostname;
      return ALLOWED_ORIGIN_SUFFIXES.some(suffix => {
        if (hostname === suffix.substring(1)) return true;
        return hostname.endsWith(suffix);
      });
    } catch (e) {
      return false;
    }
  }

  async function isAllowedOrigin(origin) {
    if (ALLOWED_ORIGINS.includes(origin)) return true;
    
    try {
      const { apiBaseUrl } = await chrome.storage.local.get(['apiBaseUrl']);
      if (apiBaseUrl) {
        const configuredOrigin = new URL(apiBaseUrl).origin;
        if (origin === configuredOrigin) return true;
      }
    } catch (e) {}
    
    return hasAllowedSuffix(origin);
  }

  window.addEventListener('message', async (event) => {
    const originAllowed = await isAllowedOrigin(event.origin);
    if (!originAllowed && event.data?.type?.startsWith('FLOWCAPTURE_')) {
      console.warn('FlowCapture: Ignoring message from untrusted origin:', event.origin);
      return;
    }

    const responseOrigin = event.origin;

    if (event.data?.type === 'FLOWCAPTURE_REQUEST_SCREENSHOT') {
      console.log('FlowCapture: Received screenshot request from page');
      try {
        const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_PAGE_SCREENSHOT' });
        if (response?.screenshot) {
          window.postMessage({ 
            type: 'FLOWCAPTURE_SCREENSHOT_CAPTURED', 
            screenshot: response.screenshot 
          }, responseOrigin);
        }
      } catch (e) {
        console.error('FlowCapture: Failed to capture screenshot:', e);
      }
    } else if (event.data?.type === 'FLOWCAPTURE_SET_SESSION') {
      console.log('FlowCapture: Received capture session from page');
      try {
        const session = event.data.session;
        const response = await chrome.runtime.sendMessage({ 
          type: 'SET_CAPTURE_SESSION', 
          session 
        });
        if (response?.error === 'permissions_required') {
          window.postMessage({ 
            type: 'FLOWCAPTURE_SESSION_SET', 
            success: false,
            error: 'permissions_required'
          }, responseOrigin);
        } else {
          window.postMessage({ 
            type: 'FLOWCAPTURE_SESSION_SET', 
            success: response?.success || false 
          }, responseOrigin);
        }
      } catch (e) {
        console.error('FlowCapture: Failed to set capture session:', e);
        window.postMessage({ 
          type: 'FLOWCAPTURE_SESSION_SET', 
          success: false,
          error: e.message 
        }, responseOrigin);
      }
    } else if (event.data?.type === 'FLOWCAPTURE_CLEAR_SESSION') {
      console.log('FlowCapture: Clearing capture session');
      try {
        const response = await chrome.runtime.sendMessage({ type: 'CLEAR_CAPTURE_SESSION' });
        window.postMessage({ 
          type: 'FLOWCAPTURE_SESSION_CLEARED', 
          success: response?.success || false 
        }, responseOrigin);
      } catch (e) {
        console.error('FlowCapture: Failed to clear capture session:', e);
      }
    } else if (event.data?.type === 'FLOWCAPTURE_CHECK_EXTENSION') {
      const manifest = chrome.runtime.getManifest();
      window.postMessage({ 
        type: 'FLOWCAPTURE_EXTENSION_PRESENT', 
        version: manifest.version 
      }, responseOrigin);
    } else if (event.data?.type === 'FLOWCAPTURE_GET_SESSION') {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_CAPTURE_SESSION' });
        window.postMessage({ 
          type: 'FLOWCAPTURE_SESSION_STATUS', 
          hasSession: response?.hasSession || false,
          flowId: response?.flowId 
        }, responseOrigin);
      } catch (e) {
        window.postMessage({ 
          type: 'FLOWCAPTURE_SESSION_STATUS', 
          hasSession: false 
        }, responseOrigin);
      }
    } else if (event.data?.type === 'FLOWCAPTURE_CHECK_PERMISSIONS') {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'CHECK_PERMISSIONS' });
        window.postMessage({ 
          type: 'FLOWCAPTURE_PERMISSIONS_STATUS', 
          hasPermission: response?.hasPermission || false
        }, responseOrigin);
      } catch (e) {
        window.postMessage({ 
          type: 'FLOWCAPTURE_PERMISSIONS_STATUS', 
          hasPermission: false,
          error: e.message
        }, responseOrigin);
      }
    } else if (event.data?.type === 'FLOWCAPTURE_REQUEST_PERMISSIONS') {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'REQUEST_PERMISSIONS' });
        window.postMessage({ 
          type: 'FLOWCAPTURE_PERMISSIONS_RESULT', 
          granted: response?.granted || false
        }, responseOrigin);
      } catch (e) {
        window.postMessage({ 
          type: 'FLOWCAPTURE_PERMISSIONS_RESULT', 
          granted: false,
          error: e.message
        }, responseOrigin);
      }
    } else if (event.data?.type === 'FLOWCAPTURE_PAUSE_CAPTURE') {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'PAUSE_CAPTURE' });
        window.postMessage({ 
          type: 'FLOWCAPTURE_PAUSE_RESULT', 
          success: response?.success || false
        }, responseOrigin);
      } catch (e) {
        console.error('FlowCapture: Failed to pause capture:', e);
      }
    } else if (event.data?.type === 'FLOWCAPTURE_RESUME_CAPTURE') {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'RESUME_CAPTURE' });
        window.postMessage({ 
          type: 'FLOWCAPTURE_RESUME_RESULT', 
          success: response?.success || false
        }, responseOrigin);
      } catch (e) {
        console.error('FlowCapture: Failed to resume capture:', e);
      }
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message.action || message.type);
    
    if (message.action === 'startCapture' || message.type === 'START_CAPTURE') {
      if (!isCapturing) {
        isCapturing = true;
        isPaused = false;
        setupEventListeners();
        showCapturingIndicator();
      }
      // Broadcast state update to web app
      window.postMessage({ 
        type: 'FLOWCAPTURE_STATE_UPDATE',
        isCapturing,
        isPaused 
      }, window.origin);
      sendResponse({ success: true });
    } else if (message.action === 'stopCapture' || message.type === 'STOP_CAPTURE') {
      if (isCapturing) {
        isCapturing = false;
        isPaused = false;
        isElementCaptureMode = false;
        removeEventListeners();
        hideCapturingIndicator();
        removeHoverHighlight();
        removeElementCaptureUI();
      }
      // Broadcast state update to web app
      window.postMessage({ 
        type: 'FLOWCAPTURE_STATE_UPDATE',
        isCapturing,
        isPaused 
      }, window.origin);
      sendResponse({ success: true });
    } else if (message.action === 'pauseCapture' || message.type === 'PAUSE_CAPTURE') {
      isPaused = true;
      updateCapturingIndicator();
      // Broadcast state update to web app
      window.postMessage({ 
        type: 'FLOWCAPTURE_STATE_UPDATE',
        isCapturing,
        isPaused 
      }, window.origin);
      sendResponse({ success: true });
    } else if (message.action === 'resumeCapture' || message.type === 'RESUME_CAPTURE') {
      isPaused = false;
      updateCapturingIndicator();
      // Broadcast state update to web app
      window.postMessage({ 
        type: 'FLOWCAPTURE_STATE_UPDATE',
        isCapturing,
        isPaused 
      }, window.origin);
      sendResponse({ success: true });
    } else if (message.type === 'START_ELEMENT_CAPTURE') {
      startElementCaptureMode();
      sendResponse({ success: true });
    } else if (message.type === 'CANCEL_ELEMENT_CAPTURE') {
      cancelElementCaptureMode();
      sendResponse({ success: true });
    } else if (message.type === 'SET_BORDER_COLOR') {
      borderColor = message.color;
      chrome.storage.local.set({ borderColor: message.color });
      updateHoverHighlightColor();
      sendResponse({ success: true });
    } else if (message.type === 'GET_BORDER_COLOR') {
      sendResponse({ color: borderColor });
    } else if (message.type === 'SESSION_EXPIRED') {
      window.postMessage({ type: 'FLOWCAPTURE_SESSION_EXPIRED' }, window.origin);
      sendResponse({ success: true });
    } else if (message.type === 'EXTENSION_UPDATED') {
      // Notify the web app that the extension was updated
      window.postMessage({ 
        type: 'FLOWCAPTURE_EXTENSION_UPDATED',
        version: message.version,
        hadActiveSession: message.hadActiveSession
      }, window.origin);
      sendResponse({ success: true });
    }
    return true;
  });

  let listenersAttached = false;

  let lastUrl = window.location.href;

  function setupEventListeners() {
    if (listenersAttached) return;
    listenersAttached = true;
    
    document.addEventListener('click', handleClick, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleChange, true);
    document.addEventListener('submit', handleSubmit, true);
    window.addEventListener('popstate', handleNavigation, true);
    window.addEventListener('hashchange', handleNavigation, true);
    
    // Monitor URL changes for SPAs (pushState/replaceState)
    startUrlMonitoring();
    
    console.log('FlowCapture: Event listeners attached');
  }

  function removeEventListeners() {
    if (!listenersAttached) return;
    listenersAttached = false;
    
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('input', handleInput, true);
    document.removeEventListener('change', handleChange, true);
    document.removeEventListener('submit', handleSubmit, true);
    window.removeEventListener('popstate', handleNavigation, true);
    window.removeEventListener('hashchange', handleNavigation, true);
    
    stopUrlMonitoring();
    
    console.log('FlowCapture: Event listeners removed');
  }

  let urlMonitorInterval = null;

  function startUrlMonitoring() {
    if (urlMonitorInterval) return;
    lastUrl = window.location.href;
    
    urlMonitorInterval = setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        handleUrlChange(lastUrl, currentUrl);
        lastUrl = currentUrl;
      }
    }, 500);
  }

  function stopUrlMonitoring() {
    if (urlMonitorInterval) {
      clearInterval(urlMonitorInterval);
      urlMonitorInterval = null;
    }
  }

  function handleUrlChange(fromUrl, toUrl) {
    if (!isCapturing || isPaused) return;
    
    // Skip non-http URLs
    try {
      const parsedUrl = new URL(toUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) return;
      
      const step = {
        type: 'navigation',
        description: `Navigate to ${parsedUrl.pathname}`,
        pageUrl: toUrl,
        pageTitle: document.title,
        metadata: {
          fromUrl,
          toUrl,
          navigationType: 'spa'
        }
      };
      
      captureStep(step);
    } catch (e) {
      console.log('FlowCapture: Skipping invalid URL', toUrl);
    }
  }

  function handleNavigation(event) {
    if (!isCapturing || isPaused) return;
    
    const currentUrl = window.location.href;
    if (currentUrl === lastUrl) return;
    
    // Skip non-http URLs
    try {
      const parsedUrl = new URL(currentUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) return;
      
      const step = {
        type: 'navigation',
        description: `Navigate ${event.type === 'popstate' ? 'back/forward' : ''} to ${parsedUrl.pathname}`,
        pageUrl: currentUrl,
        pageTitle: document.title,
        metadata: {
          navigationType: event.type
        }
      };
      
      lastUrl = currentUrl;
      captureStep(step);
    } catch (e) {
      console.log('FlowCapture: Skipping invalid navigation URL');
    }
  }

  function startElementCaptureMode() {
    isElementCaptureMode = true;
    document.addEventListener('mousemove', handleElementHover, true);
    document.addEventListener('click', handleElementSelect, true);
    document.addEventListener('keydown', handleEscapeKey, true);
    showElementCaptureUI();
    document.body.style.cursor = 'crosshair';
  }

  function cancelElementCaptureMode() {
    isElementCaptureMode = false;
    document.removeEventListener('mousemove', handleElementHover, true);
    document.removeEventListener('click', handleElementSelect, true);
    document.removeEventListener('keydown', handleEscapeKey, true);
    removeHoverHighlight();
    removeElementCaptureUI();
    document.body.style.cursor = '';
  }

  function handleEscapeKey(event) {
    if (event.key === 'Escape' && isElementCaptureMode) {
      cancelElementCaptureMode();
      chrome.runtime.sendMessage({ type: 'ELEMENT_CAPTURE_CANCELLED' });
    }
  }

  function handleElementHover(event) {
    if (!isElementCaptureMode) return;
    
    const target = event.target;
    if (isCaptureUI(target)) return;

    const rect = target.getBoundingClientRect();
    
    if (!hoverHighlight) {
      hoverHighlight = document.createElement('div');
      hoverHighlight.className = 'flowcapture-overlay flowcapture-hover-highlight';
      hoverHighlight.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 2147483645;
        border: 3px solid ${borderColor};
        border-radius: 4px;
        background: ${hexToRgba(borderColor, 0.1)};
        box-shadow: 0 0 0 4px ${hexToRgba(borderColor, 0.2)}, 0 0 20px ${hexToRgba(borderColor, 0.3)};
        transition: all 0.1s ease-out;
      `;
      document.body.appendChild(hoverHighlight);
    }

    hoverHighlight.style.left = `${rect.left - 3}px`;
    hoverHighlight.style.top = `${rect.top - 3}px`;
    hoverHighlight.style.width = `${rect.width + 6}px`;
    hoverHighlight.style.height = `${rect.height + 6}px`;
  }

  function updateHoverHighlightColor() {
    if (hoverHighlight) {
      hoverHighlight.style.borderColor = borderColor;
      hoverHighlight.style.background = hexToRgba(borderColor, 0.1);
      hoverHighlight.style.boxShadow = `0 0 0 4px ${hexToRgba(borderColor, 0.2)}, 0 0 20px ${hexToRgba(borderColor, 0.3)}`;
    }
  }

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function handleElementSelect(event) {
    if (!isElementCaptureMode) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const target = event.target;
    if (isCaptureUI(target)) return;

    const rect = target.getBoundingClientRect();
    const elementInfo = getElementInfo(target);
    
    const captureData = {
      type: 'element_capture',
      element: elementInfo,
      selector: generateSelector(target),
      description: `Captured element: ${getElementText(target) || target.tagName.toLowerCase()}`,
      url: window.location.href,
      pageTitle: document.title,
      elementBounds: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      },
      borderColor: borderColor
    };

    showCaptureFlash(rect);
    
    chrome.runtime.sendMessage({
      type: 'CAPTURE_ELEMENT',
      captureData
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('FlowCapture: Error capturing element:', chrome.runtime.lastError);
      } else {
        console.log('FlowCapture: Element captured successfully');
      }
    });

    cancelElementCaptureMode();
  }

  function showCaptureFlash(rect) {
    const flash = document.createElement('div');
    flash.className = 'flowcapture-overlay flowcapture-capture-flash';
    flash.style.cssText = `
      position: fixed;
      left: ${rect.left - 4}px;
      top: ${rect.top - 4}px;
      width: ${rect.width + 8}px;
      height: ${rect.height + 8}px;
      border: 4px solid ${borderColor};
      border-radius: 6px;
      background: ${hexToRgba(borderColor, 0.2)};
      pointer-events: none;
      z-index: 2147483647;
      animation: flowcapture-flash 0.5s ease-out forwards;
    `;
    
    document.body.appendChild(flash);
    
    setTimeout(() => {
      flash.remove();
    }, 500);
  }

  function removeHoverHighlight() {
    if (hoverHighlight) {
      hoverHighlight.remove();
      hoverHighlight = null;
    }
  }

  function showElementCaptureUI() {
    let ui = document.querySelector('.flowcapture-element-capture-ui');
    if (ui) return;

    ui = document.createElement('div');
    ui.className = 'flowcapture-overlay flowcapture-element-capture-ui';
    ui.innerHTML = `
      <div class="flowcapture-element-capture-header">
        <span class="flowcapture-element-capture-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
          </svg>
        </span>
        <span>Click on any element to capture</span>
      </div>
      <div class="flowcapture-element-capture-hint">Press ESC to cancel</div>
    `;
    ui.style.cssText = `
      position: fixed;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 12px 20px;
      background: linear-gradient(135deg, #1e1e2e, #2d2d44);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
      z-index: 2147483647;
      pointer-events: none;
      animation: flowcapture-slide-down 0.3s ease-out;
    `;

    let style = document.getElementById('flowcapture-element-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'flowcapture-element-styles';
      style.textContent = `
        .flowcapture-element-capture-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .flowcapture-element-capture-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: ${borderColor};
          border-radius: 6px;
        }
        .flowcapture-element-capture-hint {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }
        @keyframes flowcapture-slide-down {
          0% { transform: translateX(-50%) translateY(-20px); opacity: 0; }
          100% { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        @keyframes flowcapture-flash {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.02); }
          100% { opacity: 0; transform: scale(1.05); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(ui);
  }

  function removeElementCaptureUI() {
    const ui = document.querySelector('.flowcapture-element-capture-ui');
    if (ui) {
      ui.remove();
    }
  }

  function handleClick(event) {
    if (!isCapturing || isElementCaptureMode || isPaused) return;
    
    const now = Date.now();
    if (now - lastClickTime < CLICK_DEBOUNCE_MS) return;
    lastClickTime = now;

    const target = event.target;
    if (isCaptureUI(target)) return;

    const step = {
      type: 'click',
      element: getElementInfo(target),
      selector: generateSelector(target),
      description: generateClickDescription(target),
      pageUrl: window.location.href,
      pageTitle: document.title
    };

    highlightElement(target);
    captureStep(step);
  }

  function handleInput(event) {
    if (!isCapturing || isElementCaptureMode || isPaused) return;
    
    const target = event.target;
    if (isCaptureUI(target)) return;
    if (!isTextInput(target)) return;

    if (target._inputTimeout) {
      clearTimeout(target._inputTimeout);
    }

    target._inputTimeout = setTimeout(() => {
      const step = {
        type: 'input',
        element: getElementInfo(target),
        selector: generateSelector(target),
        value: maskSensitiveInput(target),
        description: generateInputDescription(target),
        pageUrl: window.location.href,
        pageTitle: document.title
      };

      captureStep(step);
    }, 500);
  }

  function handleChange(event) {
    if (!isCapturing || isElementCaptureMode || isPaused) return;
    
    const target = event.target;
    if (isCaptureUI(target)) return;
    
    if (target.tagName === 'SELECT' || target.type === 'checkbox' || target.type === 'radio') {
      const step = {
        type: 'change',
        element: getElementInfo(target),
        selector: generateSelector(target),
        value: getSelectValue(target),
        description: generateChangeDescription(target),
        pageUrl: window.location.href,
        pageTitle: document.title
      };

      captureStep(step);
    }
  }

  function handleSubmit(event) {
    if (!isCapturing || isElementCaptureMode || isPaused) return;
    
    const target = event.target;
    
    const step = {
      type: 'submit',
      element: getElementInfo(target),
      selector: generateSelector(target),
      description: `Submit form${target.name ? ` "${target.name}"` : ''}`,
      pageUrl: window.location.href,
      pageTitle: document.title
    };

    captureStep(step);
  }

  function getElementInfo(element) {
    const rect = element.getBoundingClientRect();
    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id || null,
      className: typeof element.className === 'string' ? element.className : null,
      text: getElementText(element),
      type: element.type || null,
      name: element.name || null,
      placeholder: element.placeholder || null,
      ariaLabel: element.getAttribute('aria-label') || null,
      role: element.getAttribute('role') || null,
      href: element.href || null,
      xpath: getXPath(element),
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      }
    };
  }

  function getXPath(element) {
    if (element.id) {
      return `//*[@id="${element.id}"]`;
    }
    
    const parts = [];
    let current = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 1;
      let sibling = current.previousSibling;
      
      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === current.tagName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }
      
      const tagName = current.tagName.toLowerCase();
      parts.unshift(`${tagName}[${index}]`);
      current = current.parentNode;
    }
    
    return '/' + parts.join('/');
  }

  function getElementText(element) {
    const text = element.innerText || element.textContent || '';
    return text.trim().substring(0, 100);
  }

  function generateSelector(element) {
    if (element.id) {
      return `#${CSS.escape(element.id)}`;
    }

    const testId = element.getAttribute('data-testid');
    if (testId) {
      return `[data-testid="${testId}"]`;
    }

    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      return `[aria-label="${ariaLabel}"]`;
    }

    const name = element.getAttribute('name');
    if (name) {
      return `${element.tagName.toLowerCase()}[name="${name}"]`;
    }

    let selector = element.tagName.toLowerCase();
    
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.split(' ').filter(c => c && !c.includes(':'));
      if (classes.length > 0) {
        selector += '.' + classes.slice(0, 2).map(c => CSS.escape(c)).join('.');
      }
    }

    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(c => c.tagName === element.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(element) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    return selector;
  }

  function generateClickDescription(element) {
    const tag = element.tagName.toLowerCase();
    const text = getElementText(element);
    const role = element.getAttribute('role');
    const ariaLabel = element.getAttribute('aria-label');

    if (tag === 'button' || role === 'button') {
      return `Click "${text || ariaLabel || 'button'}" button`;
    }
    
    if (tag === 'a') {
      return `Click "${text || 'link'}" link`;
    }
    
    if (tag === 'input') {
      const type = element.type;
      if (type === 'submit') {
        return `Click "${element.value || 'Submit'}" button`;
      }
      if (type === 'checkbox') {
        return `${element.checked ? 'Check' : 'Uncheck'} "${element.name || 'checkbox'}"`;
      }
      if (type === 'radio') {
        return `Select "${element.value || 'option'}"`;
      }
      return `Click on ${element.placeholder || element.name || 'input field'}`;
    }

    if (text) {
      return `Click on "${text.substring(0, 50)}"`;
    }

    return `Click on ${tag} element`;
  }

  function generateInputDescription(element) {
    const label = findLabel(element);
    const placeholder = element.placeholder;
    const name = element.name;

    const fieldName = label || placeholder || name || 'field';
    return `Enter text in "${fieldName}"`;
  }

  function generateChangeDescription(element) {
    const label = findLabel(element);
    const name = element.name;
    const fieldName = label || name || 'field';

    if (element.tagName === 'SELECT') {
      const selectedOption = element.options[element.selectedIndex];
      return `Select "${selectedOption?.text || 'option'}" from "${fieldName}"`;
    }

    if (element.type === 'checkbox') {
      return `${element.checked ? 'Check' : 'Uncheck'} "${fieldName}"`;
    }

    if (element.type === 'radio') {
      return `Select "${element.value}" for "${fieldName}"`;
    }

    return `Change "${fieldName}"`;
  }

  function findLabel(element) {
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) return label.textContent.trim();
    }

    const parentLabel = element.closest('label');
    if (parentLabel) {
      return parentLabel.textContent.replace(element.value || '', '').trim();
    }

    return null;
  }

  function isTextInput(element) {
    if (element.tagName === 'TEXTAREA') return true;
    if (element.tagName === 'INPUT') {
      const type = element.type?.toLowerCase();
      return ['text', 'email', 'password', 'search', 'tel', 'url', 'number'].includes(type);
    }
    return element.isContentEditable;
  }

  function maskSensitiveInput(element) {
    const type = element.type?.toLowerCase();
    const name = element.name?.toLowerCase() || '';
    
    if (type === 'password' || name.includes('password') || name.includes('secret') || name.includes('token')) {
      return '[REDACTED]';
    }
    
    if (name.includes('ssn') || name.includes('social') || name.includes('credit')) {
      return '[REDACTED]';
    }

    return element.value?.substring(0, 50) || '';
  }

  function getSelectValue(element) {
    if (element.tagName === 'SELECT') {
      return element.options[element.selectedIndex]?.text || '';
    }
    if (element.type === 'checkbox') {
      return element.checked ? 'checked' : 'unchecked';
    }
    if (element.type === 'radio') {
      return element.value;
    }
    return element.value;
  }

  function isCaptureUI(element) {
    return element.closest('.flowcapture-overlay') !== null;
  }

  function highlightElement(element) {
    if (highlightOverlay) {
      highlightOverlay.remove();
    }

    const rect = element.getBoundingClientRect();
    
    highlightOverlay = document.createElement('div');
    highlightOverlay.className = 'flowcapture-overlay flowcapture-highlight';
    highlightOverlay.style.cssText = `
      position: fixed;
      left: ${rect.left - 4}px;
      top: ${rect.top - 4}px;
      width: ${rect.width + 8}px;
      height: ${rect.height + 8}px;
      border: 3px solid #7C3AED;
      border-radius: 6px;
      background: rgba(124, 58, 237, 0.1);
      pointer-events: none;
      z-index: 2147483646;
      animation: flowcapture-pulse 0.3s ease-out;
    `;

    document.body.appendChild(highlightOverlay);

    setTimeout(() => {
      if (highlightOverlay) {
        highlightOverlay.remove();
        highlightOverlay = null;
      }
    }, 500);
  }

  function showCapturingIndicator() {
    let indicator = document.querySelector('.flowcapture-capturing-indicator');
    if (indicator) {
      indicator.remove();
    }

    indicator = document.createElement('div');
    indicator.className = 'flowcapture-overlay flowcapture-capturing-indicator';
    indicator.innerHTML = `
      <span class="flowcapture-pulse"></span>
      <span>Capturing</span>
    `;
    indicator.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: linear-gradient(135deg, #7C3AED, #8b5cf6);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      font-weight: 600;
      border-radius: 20px;
      box-shadow: 0 4px 12px rgba(124, 58, 237, 0.4);
      z-index: 2147483647;
      pointer-events: none;
    `;

    let style = document.getElementById('flowcapture-styles');
    if (!style) {
      style = document.createElement('style');
      style.id = 'flowcapture-styles';
      style.textContent = `
        .flowcapture-pulse {
          width: 8px;
          height: 8px;
          background: #22c55e;
          border-radius: 50%;
          animation: flowcapture-blink 1s ease-in-out infinite;
        }
        @keyframes flowcapture-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes flowcapture-pulse {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(indicator);
  }

  function updateCapturingIndicator() {
    const indicator = document.querySelector('.flowcapture-capturing-indicator');
    if (!indicator) return;
    
    if (isPaused) {
      indicator.innerHTML = `
        <span class="flowcapture-pulse" style="background: #f59e0b;"></span>
        <span>Paused</span>
      `;
      indicator.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
      indicator.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.4)';
    } else {
      indicator.innerHTML = `
        <span class="flowcapture-pulse"></span>
        <span>Capturing</span>
      `;
      indicator.style.background = 'linear-gradient(135deg, #7C3AED, #8b5cf6)';
      indicator.style.boxShadow = '0 4px 12px rgba(124, 58, 237, 0.4)';
    }
  }

  function hideCapturingIndicator() {
    const indicator = document.querySelector('.flowcapture-capturing-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  function captureStep(step) {
    console.log('FlowCapture: Capturing step:', step.type);
    
    chrome.runtime.sendMessage({
      type: 'CAPTURE_STEP',
      step
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('FlowCapture: Error sending step:', chrome.runtime.lastError);
      } else {
        console.log('FlowCapture: Step captured successfully');
      }
    });

    chrome.runtime.sendMessage({
      action: 'newStep',
      step
    });
  }

  init();
}
