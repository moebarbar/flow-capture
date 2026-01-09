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
      gap: 10px;
      padding: 10px;
      background: #f9fafb;
      border-radius: 8px;
      margin-bottom: 8px;
      border: 1px solid #e5e7eb;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .step-item:hover {
      border-color: #c7d2fe;
      box-shadow: 0 2px 4px rgba(99, 102, 241, 0.1);
    }

    .step-item.editing {
      border-color: #6366f1;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
    }

    .step-number {
      width: 22px;
      height: 22px;
      background: #6366f1;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .step-screenshot {
      width: 48px;
      height: 36px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
      flex-shrink: 0;
      cursor: pointer;
      border: 1px solid #d1d5db;
    }

    .step-screenshot img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .step-screenshot.no-image {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .step-screenshot.no-image svg {
      width: 16px;
      height: 16px;
      fill: #9ca3af;
    }

    .step-info {
      flex: 1;
      min-width: 0;
    }

    .step-title {
      font-size: 12px;
      font-weight: 500;
      color: #111827;
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
    }

    .step-title:hover {
      color: #6366f1;
    }

    .step-title-input {
      width: 100%;
      font-size: 12px;
      font-weight: 500;
      padding: 2px 4px;
      border: 1px solid #6366f1;
      border-radius: 4px;
      outline: none;
      margin-bottom: 2px;
    }

    .step-description {
      font-size: 10px;
      color: #6b7280;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 2px;
    }

    .step-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 9px;
      color: #9ca3af;
    }

    .step-meta-item {
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .step-meta-item svg {
      width: 10px;
      height: 10px;
      fill: currentColor;
    }

    .step-actions {
      display: flex;
      flex-direction: column;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .step-item:hover .step-actions {
      opacity: 1;
    }

    .step-action-btn {
      width: 20px;
      height: 20px;
      background: transparent;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6b7280;
      transition: background 0.2s, color 0.2s;
    }

    .step-action-btn:hover {
      background: #e5e7eb;
      color: #374151;
    }

    .step-action-btn svg {
      width: 12px;
      height: 12px;
      fill: currentColor;
    }

    .screenshot-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      cursor: pointer;
    }

    .screenshot-modal img {
      max-width: 90%;
      max-height: 90%;
      border-radius: 8px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5);
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
      const isPaused = btnPause.textContent.includes('Resume');
      sendMessage(isPaused ? 'RESUME_CAPTURE' : 'PAUSE_CAPTURE');
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
    const isPaused = state.isPaused || false;
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
      if (isCapturing && !isPaused) {
        statusDot.classList.add('capturing');
      } else if (isPaused) {
        statusDot.classList.add('paused');
      }
    }

    if (statusText) {
      if (isCapturing && !isPaused) {
        statusText.textContent = 'Recording...';
      } else if (isPaused) {
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
      if (isPaused) {
        btnPause.innerHTML = `
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          <span>Resume</span>
        `;
        btnPause.classList.remove('btn-secondary');
        btnPause.classList.add('btn-primary');
      } else {
        btnPause.innerHTML = `
          <svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          <span>Pause</span>
        `;
        btnPause.classList.remove('btn-primary');
        btnPause.classList.add('btn-secondary');
      }
    }

    if (state.steps && Array.isArray(state.steps)) {
      renderAllSteps(state.steps);
    }
  }

  let stepsData = [];

  function addStepToList(step) {
    const stepsList = shadowRoot.getElementById('stepsList');
    const emptyState = shadowRoot.getElementById('emptyState');

    if (!stepsList) return;

    if (emptyState) {
      emptyState.style.display = 'none';
    }

    stepsData.unshift(step);
    if (stepsData.length > 10) stepsData.pop();

    renderStep(stepsList, step, true);

    while (stepsList.children.length > 5) {
      stepsList.removeChild(stepsList.lastChild);
    }
  }

  function renderStep(container, step, prepend = false) {
    const stepItem = document.createElement('div');
    stepItem.className = 'step-item';
    stepItem.dataset.stepOrder = step.order;

    const screenshotHtml = step.screenshotDataUrl || step.screenshotUrl
      ? `<div class="step-screenshot" data-action="preview-screenshot">
           <img src="${step.screenshotDataUrl || step.screenshotUrl}" alt="Step ${step.order}">
         </div>`
      : `<div class="step-screenshot no-image">
           <svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
         </div>`;

    const title = step.title || `Step ${step.order}`;
    const description = step.description || step.selector || '';
    const actionType = step.actionType || 'click';

    stepItem.innerHTML = `
      <div class="step-number">${step.order}</div>
      ${screenshotHtml}
      <div class="step-info">
        <div class="step-title" data-action="edit-title" title="Click to edit">${escapeHtml(title)}</div>
        <div class="step-description">${escapeHtml(description)}</div>
        <div class="step-meta">
          <span class="step-meta-item">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"/></svg>
            ${formatTime(step.timestamp)}
          </span>
          <span class="step-meta-item action-badge">${actionType}</span>
        </div>
      </div>
      <div class="step-actions">
        <button class="step-action-btn" data-action="edit-title" title="Edit title">
          <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
        </button>
      </div>
    `;

    stepItem.addEventListener('click', (e) => handleStepItemClick(e, step, stepItem));

    if (prepend) {
      container.insertBefore(stepItem, container.firstChild);
    } else {
      container.appendChild(stepItem);
    }

    return stepItem;
  }

  function handleStepItemClick(e, step, stepItem) {
    e.stopPropagation();
    const action = e.target.closest('[data-action]')?.dataset.action;

    switch (action) {
      case 'edit-title':
        startEditingTitle(step, stepItem);
        break;
      case 'preview-screenshot':
        showScreenshotModal(step);
        break;
    }
  }

  function startEditingTitle(step, stepItem) {
    const titleEl = stepItem.querySelector('.step-title');
    if (!titleEl) return;

    stepItem.classList.add('editing');
    const currentTitle = step.title || `Step ${step.order}`;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'step-title-input';
    input.value = currentTitle;

    titleEl.replaceWith(input);
    input.focus();
    input.select();

    const finishEditing = (save = true) => {
      const newTitle = input.value.trim() || `Step ${step.order}`;
      stepItem.classList.remove('editing');

      const newTitleEl = document.createElement('div');
      newTitleEl.className = 'step-title';
      newTitleEl.dataset.action = 'edit-title';
      newTitleEl.title = 'Click to edit';
      newTitleEl.textContent = newTitle;

      input.replaceWith(newTitleEl);

      if (save && newTitle !== currentTitle) {
        step.title = newTitle;
        sendMessage('STEP_UPDATED', { order: step.order, title: newTitle });
      }
    };

    input.addEventListener('blur', () => finishEditing(true));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        finishEditing(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finishEditing(false);
      }
    });
  }

  function showScreenshotModal(step) {
    const imgSrc = step.screenshotDataUrl || step.screenshotUrl;
    if (!imgSrc) return;

    const modal = document.createElement('div');
    modal.className = 'screenshot-modal';
    modal.innerHTML = `<img src="${imgSrc}" alt="Step ${step.order} screenshot">`;

    modal.addEventListener('click', () => modal.remove());

    shadowRoot.appendChild(modal);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function renderAllSteps(steps) {
    const stepsList = shadowRoot.getElementById('stepsList');
    const emptyState = shadowRoot.getElementById('emptyState');

    if (!stepsList) return;

    stepsList.innerHTML = '';
    stepsData = [...steps].reverse().slice(0, 10);

    if (stepsData.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    stepsData.forEach(step => renderStep(stepsList, step, false));
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
