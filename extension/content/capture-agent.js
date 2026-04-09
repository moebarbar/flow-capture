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
  const SCROLL_DEBOUNCE_MS = 1500;
  const DOM_CHANGE_WINDOW_MS = 600; // time after a click to watch for DOM changes

  let isCapturing = false;
  let isPaused = false;
  let lastElement = null;
  let lastCaptureTime = 0;
  let lastScrollCapture = 0;
  let port = null;
  let pendingDomChangeTimeout = null;
  let mutationObserver = null;
  let lastClickedElement = null;

  const TRUSTED_ORIGIN_SUFFIXES = [
    '.repl.co',
    '.replit.dev',
    '.replit.app',
    '.flowcapture.com',
    '.flowcapture.app',
    '.up.railway.app'
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
      
      // Send READY_FOR_CAPTURE immediately after port connects
      // This tells the service worker to promote this tab from pending to captured
      console.log('[FlowCapture] Port connected, sending READY_FOR_CAPTURE');
      port.postMessage({ type: MessageTypes.READY_FOR_CAPTURE, data: { ready: true } });
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
            version: chrome.runtime.getManifest().version,
            extensionId: chrome.runtime.id
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
        case 'FLOWCAPTURE_GET_STATE':
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

        case 'FLOWCAPTURE_PAUSE_CAPTURE':
          chrome.runtime.sendMessage({ type: MessageTypes.PAUSE_CAPTURE }, (response) => {
            window.postMessage({
              type: 'FLOWCAPTURE_PAUSE_RESULT',
              success: response?.success || false
            }, event.origin);
          });
          break;

        case 'FLOWCAPTURE_RESUME_CAPTURE':
          chrome.runtime.sendMessage({ type: MessageTypes.RESUME_CAPTURE }, (response) => {
            window.postMessage({
              type: 'FLOWCAPTURE_RESUME_RESULT',
              success: response?.success || false
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
        
        case 'FLOWCAPTURE_START_CAPTURE_SESSION':
          // This triggers opening the tab selector and starts the capture session flow
          // Uses external messaging to the background service worker
          const sessionData = event.data.session || {};
          chrome.runtime.sendMessage({ 
            type: 'START_CAPTURE_SESSION_VIA_CONTENT',
            data: {
              guideId: sessionData.guideId,
              workspaceId: sessionData.workspaceId,
              apiBaseUrl: window.location.origin,
              token: sessionData.token,
              expiresAt: sessionData.expiresAt,
              returnTabId: 'current' // Will be resolved by service worker
            }
          }, (response) => {
            window.postMessage({
              type: 'FLOWCAPTURE_CAPTURE_SESSION_STARTED',
              success: response?.success || false,
              error: response?.error,
              message: response?.message
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

    // Find the nearest form and its context
    const form = element.closest('form');
    const formName = form
      ? (form.getAttribute('aria-label') || form.getAttribute('name') || form.id || null)
      : null;

    // Find the nearest landmark/section for page context
    const landmark = element.closest('main, nav, header, footer, section, article, aside, [role="main"], [role="navigation"], [role="dialog"], [role="alertdialog"]');
    const landmarkTag = landmark ? landmark.tagName.toLowerCase() : null;
    const landmarkRole = landmark ? (landmark.getAttribute('role') || landmarkTag) : null;
    const landmarkLabel = landmark
      ? (landmark.getAttribute('aria-label') || landmark.getAttribute('aria-labelledby')
          ? document.getElementById(landmark.getAttribute('aria-labelledby'))?.textContent?.trim()
          : null) || null
      : null;

    // Find nearest heading for section context (h1-h6 before this element)
    let nearestHeading = null;
    try {
      const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'));
      // Find last heading that appears before element in DOM order
      for (let i = headings.length - 1; i >= 0; i--) {
        const h = headings[i];
        if (h.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) {
          nearestHeading = h.textContent?.trim().slice(0, 80) || null;
          break;
        }
      }
    } catch (_) {}

    // Find associated label (for inputs)
    let associatedLabel = null;
    if (element.id) {
      const labelEl = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (labelEl) associatedLabel = labelEl.textContent?.trim().slice(0, 80) || null;
    }
    if (!associatedLabel) {
      const parentLabel = element.closest('label');
      if (parentLabel) {
        associatedLabel = parentLabel.textContent?.trim().slice(0, 80) || null;
      }
    }

    // Capture aria-describedby text
    let ariaDescription = null;
    const describedBy = element.getAttribute('aria-describedby');
    if (describedBy) {
      const descEl = document.getElementById(describedBy);
      if (descEl) ariaDescription = descEl.textContent?.trim().slice(0, 100) || null;
    }

    // Capture selected option text for SELECT elements
    let selectedOptionText = null;
    if (element.tagName === 'SELECT' && element.selectedIndex >= 0) {
      selectedOptionText = element.options[element.selectedIndex]?.text?.trim() || null;
    }

    // Capture parent context text (one level up, useful for icon buttons)
    let parentText = null;
    if (!innerText && element.parentElement) {
      parentText = getVisibleText(element.parentElement)?.slice(0, 100) || null;
    }

    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id || null,
      classList: Array.from(element.classList || []),
      innerText,
      textContent: fullText,
      placeholder: element.getAttribute('placeholder'),
      name: element.getAttribute('name'),
      type: element.getAttribute('type'),
      href: element.getAttribute('href'),
      ariaLabel: element.getAttribute('aria-label'),
      ariaDescription,
      role: element.getAttribute('role'),
      title: element.getAttribute('title'),
      alt: element.getAttribute('alt'),
      value: element.tagName === 'INPUT' && element.type !== 'password' ? (element.value || null) : null,
      dataTestId: element.getAttribute('data-testid'),
      isButton: element.tagName === 'BUTTON' || element.getAttribute('role') === 'button',
      isLink: element.tagName === 'A' || element.getAttribute('role') === 'link',
      isInput: ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName),
      isContentEditable: element.isContentEditable || false,
      associatedLabel,
      selectedOptionText,
      parentText,
      formContext: formName,
      pageSection: landmarkRole,
      pageSectionLabel: landmarkLabel,
      nearestHeading,
      pageTitle: document.title,
      pageUrl: window.location.href,
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

    // Standard HTML interactive elements
    const interactableTags = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL', 'SUMMARY', 'DETAILS'];
    if (interactableTags.includes(element.tagName)) return true;

    // ARIA roles — extended set covering modern component libraries
    const role = element.getAttribute('role');
    const interactableRoles = [
      'button', 'link', 'checkbox', 'radio', 'tab', 'menuitem', 'option',
      'switch', 'treeitem', 'gridcell', 'columnheader', 'rowheader',
      'combobox', 'listbox', 'spinbutton', 'slider', 'searchbox',
      'menuitemcheckbox', 'menuitemradio', 'menubar', 'toolbar'
    ];
    if (role && interactableRoles.includes(role)) return true;

    // contenteditable (rich text editors — Notion, Quill, Slate, etc.)
    if (element.isContentEditable) return true;

    // Inline onclick handler
    if (element.getAttribute('onclick')) return true;

    // tabindex=0 marks intentionally focusable custom elements
    if (element.getAttribute('tabindex') === '0') return true;

    // Cursor:pointer is the most reliable signal for custom clickable elements
    try {
      const style = window.getComputedStyle(element);
      if (style.cursor === 'pointer') return true;
    } catch (_) {}

    // React synthetic event handlers — React attaches to fiber
    // __reactFiberXXX or __reactInternalInstanceXXX
    const reactKey = Object.keys(element).find(
      k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
    );
    if (reactKey) {
      try {
        let fiber = element[reactKey];
        while (fiber) {
          const props = fiber.memoizedProps || fiber.pendingProps;
          if (props && (props.onClick || props.onMouseDown || props.onPointerDown)) return true;
          fiber = fiber.return;
          if (fiber && fiber.stateNode === document) break;
        }
      } catch (_) {}
    }

    // Vue 3: __vueParentComponent
    if (element.__vueParentComponent || element._vei?.click) return true;

    // Angular: __ngContext__ or ng-click
    if (element.__ngContext__ || element.getAttribute('ng-click') || element.getAttribute('(click)')) return true;

    // data-action, data-click, data-href are common patterns in custom UIs
    if (
      element.hasAttribute('data-action') ||
      element.hasAttribute('data-click') ||
      element.hasAttribute('data-href') ||
      element.hasAttribute('data-url') ||
      element.hasAttribute('data-link')
    ) return true;

    return false;
  }

  /**
   * Walk up the DOM to find the most semantically meaningful interactive ancestor.
   * e.g. if user clicks <span> inside <button>, return the <button>.
   * If user clicks icon inside <div role="button">, return the div.
   */
  function findInteractableTarget(element) {
    if (!element) return null;
    let current = element;
    let depth = 0;
    while (current && depth < 5) {
      if (isInteractable(current)) return current;
      // Don't walk past landmarks — they aren't the button
      const tag = current.tagName;
      if (['MAIN', 'NAV', 'HEADER', 'FOOTER', 'SECTION', 'ARTICLE', 'FORM', 'BODY'].includes(tag)) break;
      current = current.parentElement;
      depth++;
    }
    // Fall back to original element if nothing found up the tree
    return isInteractable(element) ? element : null;
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
    setupMutationObserver();
  }

  function stopCapture() {
    isCapturing = false;
    isPaused = false;

    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
    if (pendingDomChangeTimeout) {
      clearTimeout(pendingDomChangeTimeout);
      pendingDomChangeTimeout = null;
    }

    if (window.FlowCaptureOverlay) {
      window.FlowCaptureOverlay.stopRecording(false);
    }

    window.postMessage({
      type: 'FLOWCAPTURE_SESSION_ENDED',
      success: true
    }, window.location.origin);
  }

  // Selectors that identify sensitive inputs that must be masked in screenshots
  const SENSITIVE_INPUT_SELECTORS = [
    'input[type="password"]',
    'input[autocomplete="cc-number"]',
    'input[autocomplete="cc-csc"]',
    'input[autocomplete="cc-exp"]',
    'input[autocomplete="cc-exp-month"]',
    'input[autocomplete="cc-exp-year"]',
    'input[name*="ssn"]',
    'input[name*="social"]',
    'input[name*="credit"]',
    'input[name*="card"]',
    'input[name*="cvv"]',
    'input[name*="cvc"]',
    'input[id*="ssn"]',
    'input[id*="credit"]',
    'input[id*="card-number"]',
  ].join(',');

  const MASK_ATTR = 'data-flowcapture-mask';

  // Overlay opaque rectangles over sensitive fields before a screenshot.
  // Returns a cleanup function that removes the overlays.
  function maskSensitiveFields() {
    const sensitiveEls = document.querySelectorAll(SENSITIVE_INPUT_SELECTORS);
    const masks = [];

    sensitiveEls.forEach((el) => {
      try {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const mask = document.createElement('div');
        mask.setAttribute(MASK_ATTR, '1');
        mask.style.cssText = `
          position: fixed;
          left: ${rect.left}px;
          top: ${rect.top}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
          background: #1a1a1a;
          z-index: 2147483647;
          pointer-events: none;
          border-radius: 3px;
        `;
        document.body.appendChild(mask);
        masks.push(mask);
      } catch (_) {}
    });

    return function removeMasks() {
      masks.forEach((m) => { if (m.parentNode) m.remove(); });
    };
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
    if (isOverlayElement(event.target)) return;

    // Walk up to the most meaningful interactive ancestor for the highlight
    const element = findInteractableTarget(event.target);
    if (!element) return;

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

    // Walk up to find the real interactive target (e.g. <span> inside <button>)
    const element = findInteractableTarget(event.target) || event.target;

    if (isOverlayElement(element)) return;
    if (!isInteractable(element)) return;

    if (element === lastElement && Date.now() - lastCaptureTime < DEBOUNCE_MS) return;
    lastElement = element;
    lastCaptureTime = Date.now();
    lastClickedElement = element;

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

      // Mask sensitive fields (passwords, credit cards, etc.) before screenshot
      const removeMasks = maskSensitiveFields();

      try {
        const response = await chrome.runtime.sendMessage({ type: MessageTypes.SCREENSHOT_REQUEST });
        if (response?.dataUrl) {
          screenshotDataUrl = response.dataUrl;
        }
      } finally {
        // Always remove masks immediately after screenshot
        removeMasks();
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
    const clientStepId = `cs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const step = {
      clientStepId: clientStepId,
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
      window.FlowCaptureOverlay.addCapturedStep(step);
    }

    if (port) {
      port.postMessage({ type: MessageTypes.STEP_CAPTURED, data: step });
    } else {
      chrome.runtime.sendMessage({ type: MessageTypes.STEP_CAPTURED, data: step }).catch(() => {});
    }
  }

  async function handleInput(event) {
    if (!isCapturing || isPaused) return;

    const element = event.target;
    if (isOverlayElement(element)) return;
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) return;

    if (element === lastElement && Date.now() - lastCaptureTime < 1000) return;
    lastElement = element;
    lastCaptureTime = Date.now();

    const selector = generateSelector(element);
    if (!selector) return;

    // Capture screenshot for input steps (same as click, but no highlight box for privacy)
    let screenshotDataUrl = null;
    const isPasswordField = element.type === 'password';

    if (!isPasswordField) {
      // Draw a subtle focus ring around the input field in the screenshot
      let highlightBox = null;
      try {
        if (document.body) {
          highlightBox = document.createElement('div');
          highlightBox.style.cssText = `
            position: fixed;
            border: 3px solid #3b82f6;
            background: rgba(59, 130, 246, 0.1);
            border-radius: 4px;
            pointer-events: none;
            z-index: 2147483646;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.25);
            transition: none;
          `;
          const rect = element.getBoundingClientRect();
          highlightBox.style.left = `${rect.left - 4}px`;
          highlightBox.style.top = `${rect.top - 4}px`;
          highlightBox.style.width = `${rect.width + 8}px`;
          highlightBox.style.height = `${rect.height + 8}px`;
          document.body.appendChild(highlightBox);
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        }

        const removeMasks = maskSensitiveFields();
        try {
          const response = await chrome.runtime.sendMessage({ type: MessageTypes.SCREENSHOT_REQUEST });
          if (response?.dataUrl) screenshotDataUrl = response.dataUrl;
        } finally {
          removeMasks();
        }
      } catch (e) {
        // Screenshot failure is non-fatal for input steps
      } finally {
        if (highlightBox && highlightBox.parentNode) highlightBox.remove();
      }
    }

    const actionType = 'input';
    const title = generateStepTitle(element, actionType);
    const description = generateStepDescription(element, actionType);
    const clientStepId = `cs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const step = {
      clientStepId: clientStepId,
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
      window.FlowCaptureOverlay.addCapturedStep(step);
    }

    if (port) {
      port.postMessage({ type: MessageTypes.STEP_CAPTURED, data: step });
    } else {
      chrome.runtime.sendMessage({ type: MessageTypes.STEP_CAPTURED, data: step }).catch(() => {});
    }
  }

  async function handleKeyDown(event) {
    if (!isCapturing || isPaused) return;
    if (isOverlayElement(event.target)) return;

    const key = event.key;
    const target = event.target;

    // Enter on a form element = form submission
    if (key === 'Enter' && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON')) {
      // Only capture if there's an associated form (prevents capturing every Enter keystroke)
      const form = target.closest('form');
      if (!form && target.tagName !== 'BUTTON') return;

      const now = Date.now();
      if (now - lastCaptureTime < DEBOUNCE_MS) return;
      lastCaptureTime = now;

      let screenshotDataUrl = null;
      try {
        const removeMasks = maskSensitiveFields();
        try {
          const response = await chrome.runtime.sendMessage({ type: MessageTypes.SCREENSHOT_REQUEST });
          if (response?.dataUrl) screenshotDataUrl = response.dataUrl;
        } finally {
          removeMasks();
        }
      } catch (_) {}

      const metadata = getElementMetadata(target);
      const formLabel = form
        ? (form.getAttribute('aria-label') || form.id || 'form')
        : null;

      const step = {
        clientStepId: `cs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        action: 'input',
        actionType: 'input',
        title: formLabel ? `Submit "${formLabel}"` : 'Submit Form',
        description: `User presses Enter to submit the ${formLabel ? `"${formLabel}" ` : ''}form.`,
        selector: generateSelector(target),
        url: window.location.href,
        pageTitle: document.title,
        screenshotDataUrl,
        elementMetadata: { ...metadata, keyPressed: 'Enter', isFormSubmit: true },
        timestamp: Date.now()
      };

      if (window.FlowCaptureOverlay) {
        window.FlowCaptureOverlay.incrementStepCount();
        window.FlowCaptureOverlay.addCapturedStep(step);
      }
      if (port) port.postMessage({ type: MessageTypes.STEP_CAPTURED, data: step });
      else chrome.runtime.sendMessage({ type: MessageTypes.STEP_CAPTURED, data: step }).catch(() => {});
    }

    // Escape key = dismissing dialog/modal/dropdown
    if (key === 'Escape') {
      const now = Date.now();
      if (now - lastCaptureTime < DEBOUNCE_MS) return;
      // Only capture Escape if there's actually a modal/dialog open
      const dialog = document.querySelector('[role="dialog"], [role="alertdialog"], .modal, [data-modal], [aria-modal="true"]');
      if (!dialog) return;
      lastCaptureTime = now;

      const step = {
        clientStepId: `cs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        action: 'click',
        actionType: 'click',
        title: 'Dismiss Dialog',
        description: 'User presses Escape to close the dialog.',
        selector: null,
        url: window.location.href,
        pageTitle: document.title,
        screenshotDataUrl: null,
        elementMetadata: { keyPressed: 'Escape', pageTitle: document.title, pageUrl: window.location.href },
        timestamp: Date.now()
      };

      if (port) port.postMessage({ type: MessageTypes.STEP_CAPTURED, data: step });
      else chrome.runtime.sendMessage({ type: MessageTypes.STEP_CAPTURED, data: step }).catch(() => {});
    }
  }

  function handleScroll() {
    if (!isCapturing || isPaused) return;
    const now = Date.now();
    if (now - lastScrollCapture < SCROLL_DEBOUNCE_MS) return;

    // Only capture significant scrolls (more than 40% of viewport height)
    const scrollY = window.scrollY || window.pageYOffset;
    const viewportH = window.innerHeight;
    // We store scroll position at capture time to compare on next scroll
    if (!handleScroll._lastY) handleScroll._lastY = 0;
    const delta = Math.abs(scrollY - handleScroll._lastY);
    if (delta < viewportH * 0.4) return;

    handleScroll._lastY = scrollY;
    lastScrollCapture = now;

    const direction = scrollY > (handleScroll._prevY || 0) ? 'down' : 'up';
    handleScroll._prevY = scrollY;

    const step = {
      clientStepId: `cs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action: 'scroll',
      actionType: 'scroll',
      title: `Scroll ${direction === 'down' ? 'Down' : 'Up'} Page`,
      description: `User scrolls ${direction} the page.`,
      selector: null,
      url: window.location.href,
      pageTitle: document.title,
      screenshotDataUrl: null,
      elementMetadata: { scrollY: Math.round(scrollY), scrollDirection: direction, pageTitle: document.title, pageUrl: window.location.href },
      timestamp: Date.now()
    };

    if (port) port.postMessage({ type: MessageTypes.STEP_CAPTURED, data: step });
    else chrome.runtime.sendMessage({ type: MessageTypes.STEP_CAPTURED, data: step }).catch(() => {});
  }

  /**
   * Watch for significant DOM changes after a click (modals, dropdowns, tooltips appearing).
   * When a new dialog/dropdown appears, capture it as a contextual step.
   */
  function setupMutationObserver() {
    if (mutationObserver) mutationObserver.disconnect();

    mutationObserver = new MutationObserver((mutations) => {
      if (!isCapturing || isPaused) return;

      // Only care about added nodes
      let significantChange = null;

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (isOverlayElement(node)) continue;

          const tag = node.tagName;
          const role = node.getAttribute?.('role');

          // Detect modal/dialog appearing
          if (
            role === 'dialog' || role === 'alertdialog' ||
            node.getAttribute?.('aria-modal') === 'true' ||
            node.classList?.contains('modal') ||
            node.classList?.contains('dialog') ||
            node.hasAttribute?.('data-modal')
          ) {
            significantChange = { type: 'modal', label: node.getAttribute?.('aria-label') || node.querySelector?.('h1,h2,h3')?.textContent?.trim() || 'dialog' };
            break;
          }

          // Detect dropdown/menu appearing
          if (
            role === 'listbox' || role === 'menu' || role === 'combobox' ||
            node.classList?.contains('dropdown') ||
            node.classList?.contains('popover') ||
            node.classList?.contains('menu')
          ) {
            significantChange = { type: 'dropdown', label: node.getAttribute?.('aria-label') || 'menu' };
            break;
          }

          // Detect toast/notification appearing
          if (
            role === 'alert' || role === 'status' || role === 'log' ||
            node.classList?.contains('toast') ||
            node.classList?.contains('notification') ||
            node.classList?.contains('snackbar') ||
            node.classList?.contains('alert')
          ) {
            const text = node.textContent?.trim().slice(0, 100);
            significantChange = { type: 'notification', label: text || 'notification' };
            break;
          }
        }
        if (significantChange) break;
      }

      if (!significantChange) return;

      // Debounce — only capture DOM changes within DOM_CHANGE_WINDOW_MS after a click
      if (Date.now() - lastCaptureTime > DOM_CHANGE_WINDOW_MS * 3) return;
      if (pendingDomChangeTimeout) clearTimeout(pendingDomChangeTimeout);

      pendingDomChangeTimeout = setTimeout(async () => {
        let screenshotDataUrl = null;
        try {
          const removeMasks = maskSensitiveFields();
          try {
            const response = await chrome.runtime.sendMessage({ type: MessageTypes.SCREENSHOT_REQUEST });
            if (response?.dataUrl) screenshotDataUrl = response.dataUrl;
          } finally {
            removeMasks();
          }
        } catch (_) {}

        const typeLabels = { modal: 'Dialog Opens', dropdown: 'Menu Opens', notification: 'Notification Appears' };
        const typeDescriptions = {
          modal: `A dialog "${significantChange.label}" appears after the previous action.`,
          dropdown: `A dropdown menu appears after the previous action.`,
          notification: `A notification appears: "${significantChange.label}".`
        };

        const step = {
          clientStepId: `cs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          action: 'click',
          actionType: 'click',
          title: typeLabels[significantChange.type] || 'UI Change',
          description: typeDescriptions[significantChange.type] || 'The UI changed after the previous action.',
          selector: null,
          url: window.location.href,
          pageTitle: document.title,
          screenshotDataUrl,
          elementMetadata: { domChange: significantChange, pageTitle: document.title, pageUrl: window.location.href },
          timestamp: Date.now()
        };

        if (window.FlowCaptureOverlay) {
          window.FlowCaptureOverlay.incrementStepCount();
          window.FlowCaptureOverlay.addCapturedStep(step);
        }
        if (port) port.postMessage({ type: MessageTypes.STEP_CAPTURED, data: step });
        else chrome.runtime.sendMessage({ type: MessageTypes.STEP_CAPTURED, data: step }).catch(() => {});
      }, 300);
    });

    mutationObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  // ─── Drag & Drop ─────────────────────────────────────────────────────────────
  let dragSource = null;
  function handleDragStart(event) {
    if (!isCapturing || isPaused) return;
    dragSource = event.target;
  }

  async function handleDrop(event) {
    if (!isCapturing || isPaused) return;
    if (isOverlayElement(event.target)) return;

    const now = Date.now();
    if (now - lastCaptureTime < DEBOUNCE_MS) return;
    lastCaptureTime = now;

    let screenshotDataUrl = null;
    try {
      const removeMasks = maskSensitiveFields();
      try {
        const response = await chrome.runtime.sendMessage({ type: MessageTypes.SCREENSHOT_REQUEST });
        if (response?.dataUrl) screenshotDataUrl = response.dataUrl;
      } finally { removeMasks(); }
    } catch (_) {}

    const sourceLabel = dragSource ? getVisibleText(dragSource).slice(0, 60) : null;
    const targetLabel = getVisibleText(event.target).slice(0, 60);

    const step = {
      clientStepId: `cs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action: 'click', actionType: 'click',
      title: sourceLabel ? `Drag "${sourceLabel}" to ${targetLabel || 'target'}` : 'Drag and Drop Item',
      description: `User drags${sourceLabel ? ` "${sourceLabel}"` : ' an item'} and drops it${targetLabel ? ` onto "${targetLabel}"` : ''}.`,
      selector: generateSelector(event.target),
      url: window.location.href, pageTitle: document.title,
      screenshotDataUrl,
      elementMetadata: { ...getElementMetadata(event.target), isDragDrop: true, dragSourceText: sourceLabel, pageTitle: document.title, pageUrl: window.location.href },
      timestamp: Date.now()
    };
    dragSource = null;
    if (window.FlowCaptureOverlay) { window.FlowCaptureOverlay.incrementStepCount(); window.FlowCaptureOverlay.addCapturedStep(step); }
    if (port) port.postMessage({ type: MessageTypes.STEP_CAPTURED, data: step });
    else chrome.runtime.sendMessage({ type: MessageTypes.STEP_CAPTURED, data: step }).catch(() => {});
  }

  // ─── File Upload ──────────────────────────────────────────────────────────────
  async function handleFileChange(event) {
    if (!isCapturing || isPaused) return;
    const input = event.target;
    if (input.tagName !== 'INPUT' || input.type !== 'file') return;
    if (!input.files || input.files.length === 0) return;
    if (isOverlayElement(input)) return;

    const now = Date.now();
    if (now - lastCaptureTime < DEBOUNCE_MS) return;
    lastCaptureTime = now;

    const fileNames = Array.from(input.files).map(f => f.name).join(', ').slice(0, 80);
    const fieldLabel = getElementLabel(input, getElementMetadata(input)) || 'file';

    let screenshotDataUrl = null;
    try {
      const removeMasks = maskSensitiveFields();
      try {
        const response = await chrome.runtime.sendMessage({ type: MessageTypes.SCREENSHOT_REQUEST });
        if (response?.dataUrl) screenshotDataUrl = response.dataUrl;
      } finally { removeMasks(); }
    } catch (_) {}

    const step = {
      clientStepId: `cs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action: 'input', actionType: 'input',
      title: `Upload File via "${fieldLabel}"`,
      description: `User uploads ${input.files.length > 1 ? `${input.files.length} files` : `"${fileNames}"`} using the "${fieldLabel}" file input.`,
      selector: generateSelector(input),
      url: window.location.href, pageTitle: document.title,
      screenshotDataUrl,
      elementMetadata: { ...getElementMetadata(input), isFileUpload: true, fileNames, fileCount: input.files.length, pageTitle: document.title, pageUrl: window.location.href },
      timestamp: Date.now()
    };
    if (window.FlowCaptureOverlay) { window.FlowCaptureOverlay.incrementStepCount(); window.FlowCaptureOverlay.addCapturedStep(step); }
    if (port) port.postMessage({ type: MessageTypes.STEP_CAPTURED, data: step });
    else chrome.runtime.sendMessage({ type: MessageTypes.STEP_CAPTURED, data: step }).catch(() => {});
  }

  // ─── Clipboard (Copy/Paste) ───────────────────────────────────────────────────
  async function handlePaste(event) {
    if (!isCapturing || isPaused) return;
    if (isOverlayElement(event.target)) return;
    const target = event.target;
    if (!['INPUT', 'TEXTAREA'].includes(target.tagName) && !target.isContentEditable) return;

    const now = Date.now();
    if (now - lastCaptureTime < 800) return; // longer debounce for paste
    lastCaptureTime = now;

    const fieldLabel = getElementLabel(target, getElementMetadata(target)) || target.tagName.toLowerCase();
    const text = event.clipboardData?.getData('text')?.slice(0, 50) || '';

    const step = {
      clientStepId: `cs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action: 'input', actionType: 'input',
      title: `Paste into "${fieldLabel}"`,
      description: `User pastes${text ? ` "${text}${text.length >= 50 ? '...' : ''}"` : ' content'} into the "${fieldLabel}" field.`,
      selector: generateSelector(target),
      url: window.location.href, pageTitle: document.title,
      screenshotDataUrl: null,
      elementMetadata: { ...getElementMetadata(target), isPaste: true, pastedTextPreview: text, pageTitle: document.title, pageUrl: window.location.href },
      timestamp: Date.now()
    };
    if (window.FlowCaptureOverlay) { window.FlowCaptureOverlay.incrementStepCount(); window.FlowCaptureOverlay.addCapturedStep(step); }
    if (port) port.postMessage({ type: MessageTypes.STEP_CAPTURED, data: step });
    else chrome.runtime.sendMessage({ type: MessageTypes.STEP_CAPTURED, data: step }).catch(() => {});
  }

  // ─── Right-click / Context Menu ───────────────────────────────────────────────
  async function handleContextMenu(event) {
    if (!isCapturing || isPaused) return;
    if (isOverlayElement(event.target)) return;
    const element = findInteractableTarget(event.target) || event.target;

    const now = Date.now();
    if (now - lastCaptureTime < DEBOUNCE_MS) return;
    lastCaptureTime = now;

    let screenshotDataUrl = null;
    let highlightBox = null;
    try {
      if (document.body) {
        highlightBox = document.createElement('div');
        highlightBox.style.cssText = `position:fixed;border:3px solid #8b5cf6;background:rgba(139,92,246,0.15);border-radius:4px;pointer-events:none;z-index:2147483646;`;
        const rect = element.getBoundingClientRect();
        highlightBox.style.left = `${rect.left - 4}px`; highlightBox.style.top = `${rect.top - 4}px`;
        highlightBox.style.width = `${rect.width + 8}px`; highlightBox.style.height = `${rect.height + 8}px`;
        document.body.appendChild(highlightBox);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      }
      const removeMasks = maskSensitiveFields();
      try {
        const response = await chrome.runtime.sendMessage({ type: MessageTypes.SCREENSHOT_REQUEST });
        if (response?.dataUrl) screenshotDataUrl = response.dataUrl;
      } finally { removeMasks(); }
    } catch (_) {} finally {
      if (highlightBox?.parentNode) highlightBox.remove();
    }

    const label = getElementLabel(element, getElementMetadata(element)) || 'element';
    const step = {
      clientStepId: `cs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action: 'click', actionType: 'click',
      title: `Right-click "${label}"`,
      description: `User right-clicks on "${label}" to open a context menu.`,
      selector: generateSelector(element),
      url: window.location.href, pageTitle: document.title,
      screenshotDataUrl,
      elementMetadata: { ...getElementMetadata(element), isRightClick: true, pageTitle: document.title, pageUrl: window.location.href },
      timestamp: Date.now()
    };
    if (window.FlowCaptureOverlay) { window.FlowCaptureOverlay.incrementStepCount(); window.FlowCaptureOverlay.addCapturedStep(step); }
    if (port) port.postMessage({ type: MessageTypes.STEP_CAPTURED, data: step });
    else chrome.runtime.sendMessage({ type: MessageTypes.STEP_CAPTURED, data: step }).catch(() => {});
  }

  // ─── Focus on complex widgets (date pickers, sliders, etc.) ──────────────────
  let lastFocusedElement = null;
  let lastFocusTime = 0;
  function handleFocusIn(event) {
    if (!isCapturing || isPaused) return;
    if (isOverlayElement(event.target)) return;
    const el = event.target;
    // Only capture focus on non-standard complex widgets
    const role = el.getAttribute('role');
    const complexRoles = ['slider', 'spinbutton', 'combobox', 'listbox', 'tree', 'grid', 'treegrid', 'radiogroup'];
    if (!complexRoles.includes(role) && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
    if (el === lastFocusedElement) return;
    lastFocusedElement = el;
    lastFocusTime = Date.now();
  }

  async function handleFocusOut(event) {
    if (!isCapturing || isPaused) return;
    if (isOverlayElement(event.target)) return;
    const el = event.target;
    if (el !== lastFocusedElement) return;

    const role = el.getAttribute('role');
    const complexRoles = ['slider', 'spinbutton'];
    if (!complexRoles.includes(role)) { lastFocusedElement = null; return; }

    // Only capture if user spent time on widget and value changed
    if (Date.now() - lastFocusTime < 500) { lastFocusedElement = null; return; }

    const now = Date.now();
    if (now - lastCaptureTime < DEBOUNCE_MS) { lastFocusedElement = null; return; }
    lastCaptureTime = now;
    lastFocusedElement = null;

    const value = el.getAttribute('aria-valuenow') || el.getAttribute('aria-valuetext') || el.value || '';
    const label = el.getAttribute('aria-label') || el.getAttribute('title') || role;

    const step = {
      clientStepId: `cs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action: 'input', actionType: 'input',
      title: `Set "${label}" to ${value}`,
      description: `User sets the "${label}" ${role} to ${value || 'a value'}.`,
      selector: generateSelector(el),
      url: window.location.href, pageTitle: document.title,
      screenshotDataUrl: null,
      elementMetadata: { ...getElementMetadata(el), widgetValue: value, pageTitle: document.title, pageUrl: window.location.href },
      timestamp: Date.now()
    };
    if (port) port.postMessage({ type: MessageTypes.STEP_CAPTURED, data: step });
    else chrome.runtime.sendMessage({ type: MessageTypes.STEP_CAPTURED, data: step }).catch(() => {});
  }

  // ─── Shadow DOM support ───────────────────────────────────────────────────────
  // Shadow DOM hosts are invisible to regular event listeners unless we pierce them.
  // We use event delegation: clicks bubble up through shadow roots to the document in
  // composed event paths. We re-read event.composedPath() to find the real target.
  function getRealTarget(event) {
    try {
      const path = event.composedPath();
      if (path && path.length > 0) return path[0];
    } catch (_) {}
    return event.target;
  }

  // Override existing handlers to use composedPath for Shadow DOM
  const _origHandleClick = handleClick;
  handleClick = async function(event) {
    // Swap real target from composed path before delegating
    try {
      const realTarget = getRealTarget(event);
      if (realTarget !== event.target) {
        Object.defineProperty(event, 'target', { value: realTarget, configurable: true });
      }
    } catch (_) {}
    return _origHandleClick(event);
  };

  // ─── iframe bridging ──────────────────────────────────────────────────────────
  // Content scripts run in iframes too (all_frames: false in manifest, but we can
  // listen for postMessage from child frames to capture steps happening in iframes).
  function setupIframeBridge() {
    window.addEventListener('message', (event) => {
      if (!isCapturing || isPaused) return;
      if (event.data?.type !== 'FLOWCAPTURE_IFRAME_STEP') return;
      // Forward iframe steps to the service worker
      const step = event.data.step;
      if (!step) return;
      if (port) port.postMessage({ type: MessageTypes.STEP_CAPTURED, data: step });
      else chrome.runtime.sendMessage({ type: MessageTypes.STEP_CAPTURED, data: step }).catch(() => {});
    });

    // Also emit our own steps to parent window (if we're in an iframe)
    if (window !== window.top) {
      const _origSend = function(step) {
        try { window.parent.postMessage({ type: 'FLOWCAPTURE_IFRAME_STEP', step }, '*'); } catch (_) {}
      };
      // Patch the step emission functions to also forward to parent
      const origPortPost = port ? port.postMessage.bind(port) : null;
      if (port) {
        const origPost = port.postMessage.bind(port);
        port.postMessage = function(msg) {
          if (msg?.type === MessageTypes.STEP_CAPTURED) _origSend(msg.data);
          return origPost(msg);
        };
      }
    }
  }

  function setupEventListeners() {
    document.addEventListener('mouseover', handleMouseOver, true);
    document.addEventListener('mouseout', handleMouseOut, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('dragstart', handleDragStart, true);
    document.addEventListener('drop', handleDrop, true);
    document.addEventListener('change', (event) => {
      if (event.target?.tagName === 'SELECT') handleInput(event);
      if (event.target?.tagName === 'INPUT' && event.target?.type === 'file') handleFileChange(event);
    }, true);
    document.addEventListener('paste', handlePaste, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('focusout', handleFocusOut, true);
    window.addEventListener('scroll', handleScroll, { passive: true });
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
        case 'FLOWCAPTURE_CAPTURE_STARTED':
          if (message.guideId && message.sessionNonce) {
            window.postMessage({
              type: 'FLOWCAPTURE_CAPTURE_STARTED',
              guideId: message.guideId,
              sessionNonce: message.sessionNonce,
              extensionId: chrome.runtime.id
            }, window.location.origin);
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Invalid capture started payload' });
          }
          break;
        case 'FLOWCAPTURE_CAPTURE_COMPLETE':
          if (message.guideId && typeof message.stepCount === 'number' && message.sessionNonce) {
            window.postMessage({
              type: 'FLOWCAPTURE_CAPTURE_COMPLETE',
              guideId: message.guideId,
              stepCount: message.stepCount,
              sessionNonce: message.sessionNonce,
              extensionId: chrome.runtime.id
            }, window.location.origin);
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, error: 'Invalid completion payload' });
          }
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
    setupIframeBridge();
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
