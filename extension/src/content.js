if (window.__flowcaptureInitialized) {
  console.log('FlowCapture: Already initialized, skipping');
} else {
  window.__flowcaptureInitialized = true;

  let isRecording = false;
  let isElementCaptureMode = false;
  let highlightOverlay = null;
  let hoverHighlight = null;
  let lastClickTime = 0;
  let borderColor = '#ef4444';
  const CLICK_DEBOUNCE_MS = 300;

  async function init() {
    try {
      const { isRecording: recording, borderColor: savedColor } = await chrome.storage.local.get(['isRecording', 'borderColor']);
      isRecording = recording || false;
      borderColor = savedColor || '#ef4444';
      
      if (isRecording) {
        setupEventListeners();
        showRecordingIndicator();
      }
    } catch (e) {
      console.error('FlowCapture init error:', e);
    }
  }

  // Listen for messages from the web page (for Screenshot Studio integration)
  window.addEventListener('message', async (event) => {
    if (event.data?.type === 'FLOWCAPTURE_REQUEST_SCREENSHOT') {
      console.log('FlowCapture: Received screenshot request from page');
      try {
        // Request screenshot from background script
        const response = await chrome.runtime.sendMessage({ type: 'CAPTURE_PAGE_SCREENSHOT' });
        if (response?.screenshot) {
          // Send screenshot back to the page
          window.postMessage({ 
            type: 'FLOWCAPTURE_SCREENSHOT_CAPTURED', 
            screenshot: response.screenshot 
          }, '*');
        }
      } catch (e) {
        console.error('FlowCapture: Failed to capture screenshot:', e);
      }
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message.type);
    
    if (message.type === 'START_RECORDING') {
      if (!isRecording) {
        isRecording = true;
        setupEventListeners();
        showRecordingIndicator();
      }
      sendResponse({ success: true });
    } else if (message.type === 'STOP_RECORDING') {
      if (isRecording) {
        isRecording = false;
        isElementCaptureMode = false;
        removeEventListeners();
        hideRecordingIndicator();
        removeHoverHighlight();
        removeElementCaptureUI();
      }
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
    }
    return true;
  });

  let listenersAttached = false;

  function setupEventListeners() {
    if (listenersAttached) return;
    listenersAttached = true;
    
    document.addEventListener('click', handleClick, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleChange, true);
    document.addEventListener('submit', handleSubmit, true);
    console.log('FlowCapture: Event listeners attached');
  }

  function removeEventListeners() {
    if (!listenersAttached) return;
    listenersAttached = false;
    
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('input', handleInput, true);
    document.removeEventListener('change', handleChange, true);
    document.removeEventListener('submit', handleSubmit, true);
    console.log('FlowCapture: Event listeners removed');
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
    if (isRecordingUI(target)) return;

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
    if (isRecordingUI(target)) return;

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
    if (!isRecording || isElementCaptureMode) return;
    
    const now = Date.now();
    if (now - lastClickTime < CLICK_DEBOUNCE_MS) return;
    lastClickTime = now;

    const target = event.target;
    if (isRecordingUI(target)) return;

    const step = {
      type: 'click',
      element: getElementInfo(target),
      selector: generateSelector(target),
      description: generateClickDescription(target),
      url: window.location.href,
      pageTitle: document.title
    };

    highlightElement(target);
    captureStep(step);
  }

  function handleInput(event) {
    if (!isRecording || isElementCaptureMode) return;
    
    const target = event.target;
    if (isRecordingUI(target)) return;
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
        url: window.location.href,
        pageTitle: document.title
      };

      captureStep(step);
    }, 500);
  }

  function handleChange(event) {
    if (!isRecording || isElementCaptureMode) return;
    
    const target = event.target;
    if (isRecordingUI(target)) return;
    
    if (target.tagName === 'SELECT' || target.type === 'checkbox' || target.type === 'radio') {
      const step = {
        type: 'change',
        element: getElementInfo(target),
        selector: generateSelector(target),
        value: getSelectValue(target),
        description: generateChangeDescription(target),
        url: window.location.href,
        pageTitle: document.title
      };

      captureStep(step);
    }
  }

  function handleSubmit(event) {
    if (!isRecording || isElementCaptureMode) return;
    
    const target = event.target;
    
    const step = {
      type: 'submit',
      element: getElementInfo(target),
      selector: generateSelector(target),
      description: `Submit form${target.name ? ` "${target.name}"` : ''}`,
      url: window.location.href,
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
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      }
    };
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
      return '[HIDDEN]';
    }
    
    if (name.includes('ssn') || name.includes('social') || name.includes('credit')) {
      return '[HIDDEN]';
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

  function isRecordingUI(element) {
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
      border: 3px solid #8b5cf6;
      border-radius: 6px;
      background: rgba(139, 92, 246, 0.1);
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

  function showRecordingIndicator() {
    let indicator = document.querySelector('.flowcapture-recording-indicator');
    if (indicator) return;

    indicator = document.createElement('div');
    indicator.className = 'flowcapture-overlay flowcapture-recording-indicator';
    indicator.innerHTML = `
      <span class="flowcapture-pulse"></span>
      <span>Recording</span>
    `;
    indicator.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      font-weight: 600;
      border-radius: 20px;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
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
          background: #ef4444;
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

  function hideRecordingIndicator() {
    const indicator = document.querySelector('.flowcapture-recording-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  function captureStep(step) {
    console.log('FlowCapture: Sending step to background:', step.type);
    
    chrome.runtime.sendMessage({
      type: 'CAPTURE_STEP',
      step
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('FlowCapture: Error sending step:', chrome.runtime.lastError);
      } else {
        console.log('FlowCapture: Step sent successfully');
      }
    });
  }

  init();
}
