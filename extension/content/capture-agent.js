/**
 * FlowCapture Capture Agent
 * Handles DOM event capture, element serialization, and overlay coordination
 */

(function() {
  if (window.__flowCaptureCaptureAgent) return;
  window.__flowCaptureCaptureAgent = true;

  // Set DOM marker for extension detection by the web app
  try {
    document.documentElement.dataset.flowcaptureExtension = chrome.runtime.getManifest().version || 'true';
  } catch (e) {
    // Silently fail if chrome.runtime is not available
  }

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

    if (element.id && isValidCssIdentifier(element.id)) {
      return `#${CSS.escape(element.id)}`;
    }

    const dataTestId = element.getAttribute('data-testid');
    if (dataTestId) {
      return `[data-testid="${escapeAttrValue(dataTestId)}"]`;
    }

    const dataId = element.getAttribute('data-id');
    if (dataId) {
      return `[data-id="${escapeAttrValue(dataId)}"]`;
    }

    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.length <= 50) {
      return `[aria-label="${escapeAttrValue(ariaLabel)}"]`;
    }

    const name = element.getAttribute('name');
    if (name && element.tagName.match(/^(INPUT|SELECT|TEXTAREA|BUTTON)$/)) {
      return `${element.tagName.toLowerCase()}[name="${escapeAttrValue(name)}"]`;
    }

    const title = element.getAttribute('title');
    if (title && title.length <= 50) {
      return `[title="${escapeAttrValue(title)}"]`;
    }

    const role = element.getAttribute('role');
    if (role) {
      const allWithRole = document.querySelectorAll(`[role="${role}"]`);
      if (allWithRole.length === 1) {
        return `[role="${role}"]`;
      }
      
      const parent = element.parentElement;
      if (parent) {
        const siblingsWithRole = Array.from(parent.children).filter(
          el => el.getAttribute('role') === role
        );
        if (siblingsWithRole.length === 1) {
          const parentSelector = generateParentSelector(parent);
          if (parentSelector) {
            return `${parentSelector} > [role="${role}"]`;
          }
        }
      }
    }

    return generatePathSelector(element);
  }

  function generateParentSelector(parent) {
    if (!parent || parent === document.body) return null;
    
    if (parent.id && isValidCssIdentifier(parent.id)) {
      return `#${CSS.escape(parent.id)}`;
    }
    
    const dataTestId = parent.getAttribute('data-testid');
    if (dataTestId) {
      return `[data-testid="${escapeAttrValue(dataTestId)}"]`;
    }
    
    return null;
  }

  function generatePathSelector(element) {
    const path = [];
    let current = element;
    
    while (current && current !== document.body && path.length < 5) {
      let selector = current.tagName.toLowerCase();
      
      if (current.id && isValidCssIdentifier(current.id)) {
        path.unshift(`#${CSS.escape(current.id)}`);
        break;
      }
      
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\s+/)
          .filter(c => c && !c.startsWith('flowcapture') && !c.startsWith('_') && isValidCssIdentifier(c))
          .slice(0, 2);
        if (classes.length) {
          selector += '.' + classes.map(c => CSS.escape(c)).join('.');
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

  function isValidCssIdentifier(str) {
    if (!str || typeof str !== 'string') return false;
    return /^[a-zA-Z][\w-]*$/.test(str) && !str.match(/^\d/);
  }

  function escapeAttrValue(str) {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function getElementMetadata(element) {
    const rect = element.getBoundingClientRect();
    
    const innerText = getVisibleText(element);
    const fullText = (element.textContent || '').trim().slice(0, 200);
    
    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id || null,
      classList: Array.from(element.classList || []),
      innerText: innerText,
      textContent: fullText,
      placeholder: element.getAttribute('placeholder'),
      name: element.getAttribute('name'),
      type: element.getAttribute('type'),
      href: element.getAttribute('href'),
      ariaLabel: element.getAttribute('aria-label'),
      role: element.getAttribute('role'),
      title: element.getAttribute('title'),
      alt: element.getAttribute('alt'),
      value: element.value || null,
      dataTestId: element.getAttribute('data-testid'),
      isButton: element.tagName === 'BUTTON' || element.getAttribute('role') === 'button',
      isLink: element.tagName === 'A' || element.getAttribute('role') === 'link',
      isInput: ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName),
      rect: {
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        centerX: Math.round(rect.left + rect.width / 2),
        centerY: Math.round(rect.top + rect.height / 2)
      }
    };
  }

  function getVisibleText(element) {
    if (element.tagName === 'INPUT') {
      return element.placeholder || element.value || '';
    }
    if (element.tagName === 'IMG') {
      return element.alt || '';
    }
    
    const childNodes = element.childNodes;
    let text = '';
    
    for (let i = 0; i < childNodes.length; i++) {
      const node = childNodes[i];
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    }
    
    text = text.trim();
    if (text) return text.slice(0, 100);
    
    return (element.innerText || element.textContent || '').trim().slice(0, 100);
  }

  function generateStepTitle(element, actionType) {
    const metadata = getElementMetadata(element);
    const tag = element.tagName;
    const role = metadata.role;
    
    let elementLabel = getElementLabel(element, metadata);
    elementLabel = truncateText(elementLabel, 40);
    
    const actionVerbs = {
      click: 'Click',
      input: 'Enter text in',
      select: 'Select',
      check: 'Check',
      uncheck: 'Uncheck',
      hover: 'Hover over'
    };
    
    const verb = actionVerbs[actionType] || 'Interact with';
    
    const elementTypes = {
      BUTTON: 'Button',
      A: 'Link',
      INPUT: getInputTypeName(metadata.type),
      TEXTAREA: 'Text Area',
      SELECT: 'Dropdown',
      IMG: 'Image',
      LABEL: 'Label',
      CHECKBOX: 'Checkbox',
      RADIO: 'Radio Button'
    };
    
    let elementTypeName = elementTypes[tag] || '';
    
    if (role === 'button') elementTypeName = 'Button';
    else if (role === 'link') elementTypeName = 'Link';
    else if (role === 'tab') elementTypeName = 'Tab';
    else if (role === 'menuitem') elementTypeName = 'Menu Item';
    else if (role === 'checkbox') elementTypeName = 'Checkbox';
    else if (role === 'radio') elementTypeName = 'Radio Button';
    
    if (elementLabel && elementTypeName) {
      return `${verb} "${elementLabel}" ${elementTypeName}`;
    } else if (elementLabel) {
      return `${verb} "${elementLabel}"`;
    } else if (elementTypeName) {
      return `${verb} ${elementTypeName}`;
    } else {
      return `${verb} Element`;
    }
  }

  function generateStepDescription(element, actionType) {
    const metadata = getElementMetadata(element);
    const label = getElementLabel(element, metadata);
    const tag = element.tagName;
    const role = metadata.role;
    
    const truncatedLabel = truncateText(label, 50);
    
    const elementDescription = getElementDescription(tag, role, metadata);
    
    switch (actionType) {
      case 'click':
        if (metadata.isButton || role === 'button') {
          return `User clicks the "${truncatedLabel || 'Submit'}" button${getButtonContext(metadata)}.`;
        }
        if (metadata.isLink || tag === 'A') {
          const href = metadata.href;
          if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
            return `User clicks the "${truncatedLabel || 'link'}" link to navigate to another page.`;
          }
          return `User clicks the "${truncatedLabel || 'link'}" link.`;
        }
        if (tag === 'INPUT' && metadata.type === 'checkbox') {
          return `User ${element.checked ? 'checks' : 'unchecks'} the "${truncatedLabel || 'checkbox'}" option.`;
        }
        if (tag === 'INPUT' && metadata.type === 'radio') {
          return `User selects the "${truncatedLabel || 'radio'}" option.`;
        }
        return `User clicks ${elementDescription}${truncatedLabel ? ` labeled "${truncatedLabel}"` : ''}.`;
        
      case 'input':
        if (tag === 'TEXTAREA') {
          return `User enters text in the "${truncatedLabel || 'text area'}" field.`;
        }
        if (tag === 'SELECT') {
          return `User selects an option from the "${truncatedLabel || 'dropdown'}" menu.`;
        }
        return `User enters text in the "${truncatedLabel || getInputTypeName(metadata.type)}" field.`;
        
      default:
        return `User interacts with ${elementDescription}.`;
    }
  }

  function getElementLabel(element, metadata) {
    if (metadata.ariaLabel) return metadata.ariaLabel;
    if (metadata.title) return metadata.title;
    if (metadata.innerText) return metadata.innerText;
    if (metadata.placeholder) return metadata.placeholder;
    if (metadata.alt) return metadata.alt;
    if (metadata.name) return humanizeString(metadata.name);
    if (metadata.id) return humanizeString(metadata.id);
    if (metadata.dataTestId) return humanizeString(metadata.dataTestId);
    return '';
  }

  function getInputTypeName(type) {
    const typeNames = {
      text: 'Text Field',
      email: 'Email Field',
      password: 'Password Field',
      search: 'Search Field',
      tel: 'Phone Field',
      url: 'URL Field',
      number: 'Number Field',
      date: 'Date Picker',
      file: 'File Input',
      checkbox: 'Checkbox',
      radio: 'Radio Button',
      submit: 'Submit Button',
      button: 'Button'
    };
    return typeNames[type] || 'Input Field';
  }

  function getElementDescription(tag, role, metadata) {
    if (role) {
      const roleDescriptions = {
        button: 'the button',
        link: 'the link',
        tab: 'the tab',
        menuitem: 'the menu item',
        checkbox: 'the checkbox',
        radio: 'the radio button',
        textbox: 'the text field',
        combobox: 'the dropdown'
      };
      if (roleDescriptions[role]) return roleDescriptions[role];
    }
    
    const tagDescriptions = {
      BUTTON: 'the button',
      A: 'the link',
      INPUT: `the ${getInputTypeName(metadata.type).toLowerCase()}`,
      TEXTAREA: 'the text area',
      SELECT: 'the dropdown',
      LABEL: 'the label',
      IMG: 'the image'
    };
    
    return tagDescriptions[tag] || 'the element';
  }

  function getButtonContext(metadata) {
    if (metadata.type === 'submit') return ' to submit the form';
    if (metadata.name?.toLowerCase().includes('cancel')) return ' to cancel the action';
    if (metadata.name?.toLowerCase().includes('save')) return ' to save changes';
    if (metadata.name?.toLowerCase().includes('delete')) return ' to delete the item';
    return '';
  }

  function humanizeString(str) {
    if (!str) return '';
    return str
      .replace(/[-_]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();
  }

  function truncateText(text, maxLength) {
    if (!text) return '';
    text = text.trim();
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3).trim() + '...';
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
      if (current.id === OVERLAY_ID || 
          current.id === 'flowcapture-side-panel-host' ||
          current.classList?.contains('flowcapture-overlay') ||
          current.hasAttribute?.('data-flowcapture-panel')) {
        return true;
      }
      if (current.getRootNode?.() instanceof ShadowRoot) {
        const host = current.getRootNode().host;
        if (host?.id === 'flowcapture-side-panel-host' || 
            host?.hasAttribute?.('data-flowcapture-panel')) {
          return true;
        }
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

    // Create persistent highlight box that will appear in the screenshot
    let highlightBox = null;
    let screenshotDataUrl = null;
    
    try {
      // Only create highlight if document.body is available
      if (document.body) {
        highlightBox = document.createElement('div');
        highlightBox.id = 'flowcapture-screenshot-highlight';
        highlightBox.style.cssText = `
          position: fixed;
          border: 3px solid #ef4444;
          background: rgba(239, 68, 68, 0.15);
          border-radius: 4px;
          pointer-events: none;
          z-index: 2147483646;
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.3);
          transition: none;
        `;
        
        const rect = element.getBoundingClientRect();
        highlightBox.style.left = `${rect.left - 4}px`;
        highlightBox.style.top = `${rect.top - 4}px`;
        highlightBox.style.width = `${rect.width + 8}px`;
        highlightBox.style.height = `${rect.height + 8}px`;
        
        document.body.appendChild(highlightBox);
        
        // Wait for the highlight to render before capturing
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }

      const response = await chrome.runtime.sendMessage({ type: MessageTypes.SCREENSHOT_REQUEST });
      if (response?.dataUrl) {
        screenshotDataUrl = response.dataUrl;
      }
    } catch (e) {
      console.log('[FlowCapture] Screenshot capture failed:', e);
    } finally {
      // Always clean up the highlight, even if errors occur
      if (highlightBox && highlightBox.parentNode) {
        highlightBox.remove();
      }
      // Also clean up any orphaned highlights from previous captures
      const orphanedHighlight = document.getElementById('flowcapture-screenshot-highlight');
      if (orphanedHighlight) {
        orphanedHighlight.remove();
      }
    }

    const actionType = 'click';
    const title = generateStepTitle(element, actionType);
    const description = generateStepDescription(element, actionType);

    const step = {
      action: actionType,
      actionType: actionType,
      title: title,
      description: description,
      selector: selector,
      url: window.location.href,
      pageTitle: document.title,
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

    const actionType = 'input';
    const title = generateStepTitle(element, actionType);
    const description = generateStepDescription(element, actionType);

    const step = {
      action: actionType,
      actionType: actionType,
      title: title,
      description: description,
      selector: selector,
      url: window.location.href,
      pageTitle: document.title,
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
