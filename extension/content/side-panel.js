/**
 * FlowCapture Sticky Side Editor Panel
 * 
 * Shadow DOM-isolated panel that persists across:
 * - Page navigation (traditional and SPA)
 * - Page refreshes (via content script re-injection)
 * - Tab switches (panel is part of DOM)
 */

(function() {
  if (window.__flowCaptureSidePanel) return;
  window.__flowCaptureSidePanel = true;

  const PANEL_HOST_ID = 'flowcapture-side-panel-host';
  const PANEL_WIDTH = 320;
  const COLLAPSED_WIDTH = 48;

  const MessageTypes = {
    GET_STATE: 'GET_STATE',
    STATE_UPDATE: 'STATE_UPDATE',
    TOGGLE_PANEL: 'TOGGLE_PANEL',
    PANEL_STATE_CHANGED: 'PANEL_STATE_CHANGED'
  };

  let panelHost = null;
  let shadowRoot = null;
  let isOpen = true;
  let isCapturing = false;
  let stepCount = 0;
  let port = null;
  let listenersAttached = false;
  
  const STORAGE_KEY = 'flowcapture_panel_open';
  
  function saveLocalState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ isOpen }));
    } catch (e) {}
  }
  
  function loadLocalState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.isOpen !== undefined) {
          isOpen = data.isOpen;
        }
      }
    } catch (e) {}
  }

  const PANEL_STYLES = `
    :host {
      all: initial;
      position: fixed !important;
      top: 0 !important;
      right: 0 !important;
      height: 100vh !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }

    * {
      box-sizing: border-box;
    }

    .panel-wrapper {
      position: relative;
      height: 100%;
      display: flex;
      pointer-events: none;
    }

    .toggle-tab {
      position: absolute;
      left: -32px;
      top: 50%;
      transform: translateY(-50%);
      width: 32px;
      height: 80px;
      background: #6366f1;
      border-radius: 8px 0 0 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
      transition: background 0.2s, left 0.3s;
    }

    .toggle-tab:hover {
      background: #4f46e5;
    }

    .toggle-tab svg {
      width: 16px;
      height: 16px;
      fill: white;
      transition: transform 0.3s;
    }

    .toggle-tab.collapsed svg {
      transform: rotate(180deg);
    }

    .panel-container {
      width: ${PANEL_WIDTH}px;
      height: 100%;
      background: #ffffff;
      border-left: 1px solid #e5e7eb;
      box-shadow: -4px 0 16px rgba(0, 0, 0, 0.1);
      display: flex;
      flex-direction: column;
      pointer-events: auto;
      transform: translateX(0);
      transition: transform 0.3s ease, width 0.3s ease;
    }

    .panel-container.collapsed {
      transform: translateX(100%);
    }

    .panel-header {
      padding: 16px;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }

    .panel-logo {
      width: 32px;
      height: 32px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .panel-logo svg {
      width: 20px;
      height: 20px;
      fill: white;
    }

    .panel-title {
      font-size: 16px;
      font-weight: 600;
      flex: 1;
    }

    .panel-close {
      width: 28px;
      height: 28px;
      background: rgba(255, 255, 255, 0.1);
      border: none;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }

    .panel-close:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .panel-close svg {
      width: 14px;
      height: 14px;
      fill: white;
    }

    .panel-content {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .status-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 16px;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }

    .status-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #9ca3af;
    }

    .status-dot.capturing {
      background: #22c55e;
      animation: pulse 2s infinite;
    }

    .status-dot.paused {
      background: #f59e0b;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .status-text {
      font-size: 14px;
      font-weight: 500;
      color: #374151;
    }

    .step-counter {
      font-size: 24px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 4px;
    }

    .step-label {
      font-size: 12px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .action-buttons {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .btn {
      padding: 12px 16px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #6366f1;
      color: white;
    }

    .btn-primary:hover {
      background: #4f46e5;
    }

    .btn-secondary {
      background: #f3f4f6;
      color: #374151;
    }

    .btn-secondary:hover {
      background: #e5e7eb;
    }

    .btn-danger {
      background: #fef2f2;
      color: #dc2626;
    }

    .btn-danger:hover {
      background: #fee2e2;
    }

    .btn svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }

    .recent-steps {
      margin-top: 16px;
    }

    .recent-steps-title {
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }

    .step-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      background: #f9fafb;
      border-radius: 8px;
      margin-bottom: 8px;
    }

    .step-number {
      width: 24px;
      height: 24px;
      background: #6366f1;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .step-info {
      flex: 1;
      min-width: 0;
    }

    .step-action {
      font-size: 13px;
      font-weight: 500;
      color: #111827;
      margin-bottom: 2px;
    }

    .step-element {
      font-size: 11px;
      color: #6b7280;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .empty-state {
      text-align: center;
      padding: 32px 16px;
      color: #6b7280;
    }

    .empty-state svg {
      width: 48px;
      height: 48px;
      fill: #d1d5db;
      margin-bottom: 12px;
    }

    .empty-state p {
      font-size: 14px;
      margin: 0;
    }

    .panel-footer {
      padding: 12px 16px;
      border-top: 1px solid #e5e7eb;
      background: #f9fafb;
      flex-shrink: 0;
    }

    .footer-text {
      font-size: 11px;
      color: #9ca3af;
      text-align: center;
    }
  `;

  const PANEL_HTML = `
    <div class="panel-wrapper">
      <div class="toggle-tab" id="toggleTab">
        <svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
      </div>
      <div class="panel-container" id="panelContainer">
        <div class="panel-header">
          <div class="panel-logo">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          </div>
          <span class="panel-title">FlowCapture</span>
          <button class="panel-close" id="panelClose">
            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
        <div class="panel-content">
          <div class="status-card">
            <div class="status-indicator">
              <div class="status-dot" id="statusDot"></div>
              <span class="status-text" id="statusText">Ready to capture</span>
            </div>
            <div class="step-counter" id="stepCounter">0</div>
            <div class="step-label">Steps captured</div>
          </div>
          <div class="action-buttons">
            <button class="btn btn-primary" id="btnStartStop">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
              <span>Start Capture</span>
            </button>
            <button class="btn btn-secondary" id="btnPause" style="display: none;">
              <svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              <span>Pause</span>
            </button>
          </div>
          <div class="recent-steps" id="recentSteps">
            <div class="recent-steps-title">Recent Steps</div>
            <div class="empty-state" id="emptyState">
              <svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
              <p>No steps captured yet</p>
            </div>
            <div id="stepsList"></div>
          </div>
        </div>
        <div class="panel-footer">
          <div class="footer-text">Press Alt+Shift+R to toggle capture</div>
        </div>
      </div>
    </div>
  `;

  function injectPanel() {
    loadLocalState();
    
    const existingHost = document.getElementById(PANEL_HOST_ID);
    if (existingHost) {
      panelHost = existingHost;
      shadowRoot = panelHost.shadowRoot;
      if (shadowRoot) {
        updatePanelVisibility();
        if (!listenersAttached) {
          setupEventListeners();
        }
        syncWithBackground();
        return;
      }
      existingHost.remove();
      listenersAttached = false;
    } else {
      listenersAttached = false;
    }

    panelHost = document.createElement('div');
    panelHost.id = PANEL_HOST_ID;
    panelHost.setAttribute('data-flowcapture-panel', 'true');
    
    shadowRoot = panelHost.attachShadow({ mode: 'open' });

    const styleEl = document.createElement('style');
    styleEl.textContent = PANEL_STYLES;
    shadowRoot.appendChild(styleEl);

    const container = document.createElement('div');
    container.innerHTML = PANEL_HTML;
    shadowRoot.appendChild(container);

    document.documentElement.appendChild(panelHost);

    setupEventListeners();
    updatePanelVisibility();
    syncWithBackground();
  }

  function setupEventListeners() {
    if (listenersAttached) return;
    listenersAttached = true;

    const toggleTab = shadowRoot.getElementById('toggleTab');
    const panelClose = shadowRoot.getElementById('panelClose');
    const btnStartStop = shadowRoot.getElementById('btnStartStop');
    const btnPause = shadowRoot.getElementById('btnPause');

    toggleTab?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePanel();
    });

    panelClose?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePanel();
    });

    btnStartStop?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isCapturing) {
        sendMessage('STOP_CAPTURE');
      } else {
        sendMessage('START_CAPTURE');
      }
    });

    btnPause?.addEventListener('click', (e) => {
      e.stopPropagation();
      sendMessage('PAUSE_CAPTURE');
    });
  }

  function togglePanel() {
    isOpen = !isOpen;
    updatePanelVisibility();
    saveLocalState();
    
    chrome.runtime.sendMessage({
      type: MessageTypes.PANEL_STATE_CHANGED,
      data: { isOpen }
    }).catch(() => {});
  }

  function updatePanelVisibility() {
    const panelContainer = shadowRoot.getElementById('panelContainer');
    const toggleTab = shadowRoot.getElementById('toggleTab');

    if (isOpen) {
      panelContainer?.classList.remove('collapsed');
      toggleTab?.classList.remove('collapsed');
    } else {
      panelContainer?.classList.add('collapsed');
      toggleTab?.classList.add('collapsed');
    }
  }

  function updateUI(state) {
    if (!shadowRoot) return;

    isCapturing = state.isCapturing || false;
    stepCount = state.stepCount || 0;
    
    if (state.panelOpen !== undefined) {
      isOpen = state.panelOpen;
      updatePanelVisibility();
    }

    const statusDot = shadowRoot.getElementById('statusDot');
    const statusText = shadowRoot.getElementById('statusText');
    const stepCounter = shadowRoot.getElementById('stepCounter');
    const btnStartStop = shadowRoot.getElementById('btnStartStop');
    const btnPause = shadowRoot.getElementById('btnPause');

    if (statusDot) {
      statusDot.className = 'status-dot';
      if (state.isCapturing) {
        statusDot.classList.add('capturing');
      } else if (state.isPaused) {
        statusDot.classList.add('paused');
      }
    }

    if (statusText) {
      if (state.isCapturing) {
        statusText.textContent = 'Recording...';
      } else if (state.isPaused) {
        statusText.textContent = 'Paused';
      } else {
        statusText.textContent = 'Ready to capture';
      }
    }

    if (stepCounter) {
      stepCounter.textContent = stepCount.toString();
    }

    if (btnStartStop) {
      if (isCapturing) {
        btnStartStop.innerHTML = `
          <svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12"/></svg>
          <span>Stop Capture</span>
        `;
        btnStartStop.classList.remove('btn-primary');
        btnStartStop.classList.add('btn-danger');
      } else {
        btnStartStop.innerHTML = `
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
          <span>Start Capture</span>
        `;
        btnStartStop.classList.remove('btn-danger');
        btnStartStop.classList.add('btn-primary');
      }
    }

    if (btnPause) {
      btnPause.style.display = isCapturing ? 'flex' : 'none';
    }
  }

  function addStepToList(step) {
    const stepsList = shadowRoot.getElementById('stepsList');
    const emptyState = shadowRoot.getElementById('emptyState');

    if (!stepsList) return;

    if (emptyState) {
      emptyState.style.display = 'none';
    }

    const stepItem = document.createElement('div');
    stepItem.className = 'step-item';
    stepItem.innerHTML = `
      <div class="step-number">${step.order || stepCount}</div>
      <div class="step-info">
        <div class="step-action">${step.actionType || 'Click'}</div>
        <div class="step-element">${step.selector || 'Unknown element'}</div>
      </div>
    `;

    stepsList.insertBefore(stepItem, stepsList.firstChild);

    while (stepsList.children.length > 5) {
      stepsList.removeChild(stepsList.lastChild);
    }
  }

  function sendMessage(type, data = {}) {
    if (port) {
      port.postMessage({ type, data });
    } else {
      chrome.runtime.sendMessage({ type, data }).catch(() => {});
    }
  }

  function connectPort() {
    try {
      port = chrome.runtime.connect({ name: 'flowcapture-side-panel' });
      
      port.onMessage.addListener((message) => {
        if (message.type === MessageTypes.STATE_UPDATE) {
          updateUI(message.data);
        }
      });

      port.onDisconnect.addListener(() => {
        port = null;
        setTimeout(connectPort, 1000);
      });
    } catch (e) {
      setTimeout(connectPort, 1000);
    }
  }

  function syncWithBackground(retryCount = 0) {
    chrome.runtime.sendMessage({ type: MessageTypes.GET_STATE })
      .then((state) => {
        if (state) {
          updateUI(state);
          saveLocalState();
        }
      })
      .catch(() => {
        if (retryCount < 3) {
          setTimeout(() => syncWithBackground(retryCount + 1), 500 * (retryCount + 1));
        }
      });
  }

  function setupNavigationObserver() {
    const observer = new MutationObserver(() => {
      if (!document.getElementById(PANEL_HOST_ID)) {
        injectPanel();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: false
    });

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      setTimeout(() => {
        if (!document.getElementById(PANEL_HOST_ID)) {
          injectPanel();
        }
      }, 100);
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      setTimeout(() => {
        if (!document.getElementById(PANEL_HOST_ID)) {
          injectPanel();
        }
      }, 100);
    };

    window.addEventListener('popstate', () => {
      setTimeout(() => {
        if (!document.getElementById(PANEL_HOST_ID)) {
          injectPanel();
        }
      }, 100);
    });
  }

  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case MessageTypes.STATE_UPDATE:
          updateUI(message.data);
          sendResponse({ success: true });
          break;
        case MessageTypes.TOGGLE_PANEL:
          togglePanel();
          sendResponse({ success: true });
          break;
        case 'STEP_ADDED':
          addStepToList(message.data);
          sendResponse({ success: true });
          break;
      }
      return true;
    });
  }

  function init() {
    injectPanel();
    setupNavigationObserver();
    setupMessageListener();
    connectPort();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.FlowCaptureSidePanel = {
    toggle: togglePanel,
    updateState: updateUI,
    addStep: addStepToList,
    isOpen: () => isOpen
  };
})();
