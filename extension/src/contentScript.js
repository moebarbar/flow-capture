(function() {
  if (window.__flowCaptureInjected) return;
  window.__flowCaptureInjected = true;

  let isCapturing = false;
  let isPaused = false;
  let captureConfig = { highlightColor: '#ef4444' };
  let lastCapturedElement = null;
  let lastCaptureTime = 0;
  const DEBOUNCE_MS = 300;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(src);
      script.type = 'text/javascript';
      script.onload = () => {
        script.remove();
        resolve();
      };
      script.onerror = () => {
        script.remove();
        reject(new Error(`Failed to load: ${src}`));
      };
      (document.head || document.documentElement).appendChild(script);
    });
  }

  async function loadModules() {
    await loadScript('src/selectorEngine.js');
    await loadScript('src/overlay.js');
    await loadScript('src/screenshotService.js');
  }

  async function init() {
    try {
      await loadModules();
    } catch (e) {
      console.error('[FlowCapture] Failed to load modules:', e);
    }
    
    setupEventListeners();
    setupMessageListener();
    
    const state = await chrome.runtime.sendMessage({ type: 'GET_CAPTURE_STATE' });
    if (state?.isCapturing) {
      startCapture(state.config);
    }
  }

  function setupEventListeners() {
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleChange, true);
    document.addEventListener('keydown', handleKeydown, true);
  }

  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'START_CAPTURE':
          startCapture(message.data);
          sendResponse({ success: true });
          break;
        case 'STOP_CAPTURE':
          stopCapture();
          sendResponse({ success: true });
          break;
        case 'PAUSE_CAPTURE':
          pauseCapture();
          sendResponse({ success: true });
          break;
        case 'RESUME_CAPTURE':
          resumeCapture();
          sendResponse({ success: true });
          break;
        case 'GET_STATE':
          sendResponse({ isCapturing, isPaused });
          break;
        case 'PING':
          sendResponse({ pong: true });
          break;
      }
      return true;
    });
  }

  function startCapture(config = {}) {
    isCapturing = true;
    isPaused = false;
    captureConfig = { ...captureConfig, ...config };
    
    if (window.FlowCaptureOverlay) {
      window.FlowCaptureOverlay.startRecording(captureConfig.highlightColor);
    }
  }

  function stopCapture() {
    isCapturing = false;
    isPaused = false;
    
    if (window.FlowCaptureOverlay) {
      window.FlowCaptureOverlay.stopRecording();
    }
  }

  function pauseCapture() {
    isPaused = true;
    if (window.FlowCaptureOverlay) {
      window.FlowCaptureOverlay.hideHighlight();
    }
  }

  function resumeCapture() {
    isPaused = false;
  }

  function handleMouseOver(event) {
    if (!isCapturing || isPaused) return;
    
    const target = event.target;
    if (!isInteractableElement(target)) return;
    if (isOverlayElement(target)) return;

    if (window.FlowCaptureOverlay) {
      window.FlowCaptureOverlay.showHighlight(target);
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
    
    const target = event.target;
    if (!isInteractableElement(target)) return;
    if (isOverlayElement(target)) return;
    if (isDuplicateCapture(target)) return;

    event.stopPropagation();

    await captureStep(target, 'click');
  }

  async function handleInput(event) {
    if (!isCapturing || isPaused) return;
    
    const target = event.target;
    if (!isInputElement(target)) return;
    if (isOverlayElement(target)) return;
  }

  async function handleChange(event) {
    if (!isCapturing || isPaused) return;
    
    const target = event.target;
    if (!isInputElement(target)) return;
    if (isOverlayElement(target)) return;
    if (isDuplicateCapture(target)) return;

    await captureStep(target, 'input');
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && isCapturing) {
      if (window.FlowCaptureOverlay) {
        window.FlowCaptureOverlay.togglePause();
      }
    }
  }

  async function captureStep(element, actionType) {
    lastCapturedElement = element;
    lastCaptureTime = Date.now();

    const selectorEngine = window.FlowCaptureSelectorEngine;
    const screenshotService = window.FlowCaptureScreenshot;

    if (!selectorEngine || !screenshotService) {
      console.error('[FlowCapture] Services not loaded');
      return;
    }

    const selectors = selectorEngine.getSelector(element);
    const bounds = selectorEngine.getElementBounds(element);
    const description = selectorEngine.getElementDescription(element);

    let screenshot = null;
    try {
      const fullScreenshot = await screenshotService.captureWithHighlight(element, captureConfig.highlightColor);
      screenshot = fullScreenshot;
    } catch (e) {
      console.error('[FlowCapture] Screenshot failed:', e);
    }

    const step = {
      id: `step_${Date.now()}`,
      title: generateStepTitle(element, actionType),
      description,
      actionType,
      selector: selectors?.css,
      xpath: selectors?.xpath,
      url: window.location.href,
      pageTitle: document.title,
      bounds,
      screenshot,
      timestamp: Date.now()
    };

    if (window.FlowCaptureOverlay) {
      window.FlowCaptureOverlay.addStep(step);
    }

    chrome.runtime.sendMessage({ 
      type: 'STEP_CAPTURED', 
      data: step 
    });
  }

  function generateStepTitle(element, actionType) {
    const tag = element.tagName.toLowerCase();
    const text = getElementText(element);
    const type = element.type || '';
    const placeholder = element.placeholder || '';
    const ariaLabel = element.getAttribute('aria-label') || '';

    if (actionType === 'click') {
      if (tag === 'button' || element.getAttribute('role') === 'button') {
        return `Click "${text || ariaLabel || 'button'}"`;
      }
      if (tag === 'a') {
        return `Click link "${text || 'link'}"`;
      }
      if (tag === 'input' && (type === 'submit' || type === 'button')) {
        return `Click "${element.value || 'Submit'}"`;
      }
      if (tag === 'input' && type === 'checkbox') {
        return `Toggle "${ariaLabel || text || 'checkbox'}"`;
      }
      if (tag === 'input' && type === 'radio') {
        return `Select "${ariaLabel || text || 'option'}"`;
      }
      return `Click ${text ? `"${text}"` : tag}`;
    }

    if (actionType === 'input') {
      if (tag === 'input') {
        return `Enter text in "${placeholder || ariaLabel || type || 'field'}"`;
      }
      if (tag === 'textarea') {
        return `Enter text in "${placeholder || ariaLabel || 'text area'}"`;
      }
      if (tag === 'select') {
        return `Select from "${ariaLabel || 'dropdown'}"`;
      }
    }

    return `${actionType} on ${tag}`;
  }

  function getElementText(element) {
    const directText = element.textContent?.trim();
    if (directText && directText.length <= 30) {
      return directText;
    }
    return element.innerText?.trim()?.substring(0, 30) || '';
  }

  function isInteractableElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute('role');
    
    const interactableTags = ['a', 'button', 'input', 'select', 'textarea', 'label'];
    const interactableRoles = ['button', 'link', 'menuitem', 'option', 'tab', 'checkbox', 'radio', 'switch'];
    
    if (interactableTags.includes(tag)) return true;
    if (role && interactableRoles.includes(role)) return true;
    if (element.onclick || element.hasAttribute('onclick')) return true;
    if (element.hasAttribute('tabindex') && element.tabIndex >= 0) return true;
    if (window.getComputedStyle(element).cursor === 'pointer') return true;
    
    return false;
  }

  function isInputElement(element) {
    const tag = element.tagName.toLowerCase();
    return ['input', 'textarea', 'select'].includes(tag);
  }

  function isOverlayElement(element) {
    let current = element;
    while (current) {
      if (current.id === 'flowcapture-overlay') return true;
      current = current.parentElement;
    }
    return false;
  }

  function isDuplicateCapture(element) {
    if (element === lastCapturedElement && Date.now() - lastCaptureTime < DEBOUNCE_MS) {
      return true;
    }
    return false;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
