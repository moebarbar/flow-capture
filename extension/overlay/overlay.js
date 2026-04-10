/**
 * FlowCapture Overlay
 * Shadow DOM-based sticky UI with highlight box, control panel, and step preview panel
 */

(function() {
  if (window.FlowCaptureOverlay) return;

  const OVERLAY_ID = 'flowcapture-overlay';
  const Z_INDEX = 2147483647;
  const MAX_PREVIEW_STEPS = 5;
  
  let container = null;
  let shadow = null;
  let isRecording = false;
  let isPaused = false;
  let stepCount = 0;
  let highlightBox = null;
  let controlPanel = null;
  let previewPanel = null;
  let previewContent = null;
  let isPanelCollapsed = false;
  let capturedSteps = [];
  let updateDebounceTimer = null;

  function createOverlay() {
    if (document.getElementById(OVERLAY_ID)) {
      container = document.getElementById(OVERLAY_ID);
      shadow = container.shadowRoot;
      highlightBox = shadow.querySelector('.highlight-box');
      controlPanel = shadow.querySelector('.control-panel');
      previewPanel = shadow.querySelector('.preview-panel');
      previewContent = shadow.querySelector('.preview-content');
      return;
    }

    container = document.createElement('div');
    container.id = OVERLAY_ID;
    container.className = 'flowcapture-overlay';
    shadow = container.attachShadow({ mode: 'closed' });

    const styles = document.createElement('style');
    styles.textContent = `
      :host {
        all: initial;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: ${Z_INDEX};
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      * {
        box-sizing: border-box;
      }
      
      .control-panel {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border-radius: 12px;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        pointer-events: auto;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1);
        user-select: none;
        opacity: 0;
        display: none;
      }

      .control-panel.visible {
        opacity: 1;
        display: flex;
      }
      
      .status {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #fff;
        font-size: 14px;
        font-weight: 500;
      }
      
      .status-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #ef4444;
        animation: pulse 1.5s infinite;
        box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
      }
      
      .status-dot.paused {
        background: #f59e0b;
        animation: none;
        box-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(0.9); }
      }
      
      .step-count {
        background: rgba(255,255,255,0.1);
        padding: 6px 12px;
        border-radius: 8px;
        color: #fff;
        font-size: 13px;
        font-weight: 500;
        min-width: 70px;
        text-align: center;
      }
      
      .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        transition: all 0.15s;
        outline: none;
      }
      
      .btn:active {
        transform: scale(0.96);
      }
      
      .btn-pause {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: #000;
      }
      
      .btn-pause:hover {
        background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
      }
      
      .btn-stop {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: #fff;
      }
      
      .btn-stop:hover {
        background: linear-gradient(135deg, #f87171 0%, #ef4444 100%);
      }
      
      .btn-resume {
        background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
        color: #fff;
      }
      
      .btn-resume:hover {
        background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
      }
      
      .btn-toggle {
        background: rgba(255,255,255,0.1);
        color: #fff;
        padding: 8px 12px;
      }
      
      .btn-toggle:hover {
        background: rgba(255,255,255,0.2);
      }
      
      .highlight-box {
        position: fixed;
        border: 3px solid #ef4444;
        background: rgba(239, 68, 68, 0.08);
        border-radius: 4px;
        pointer-events: none;
        transition: all 0.1s ease-out;
        box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.15), 
                    inset 0 0 0 1px rgba(239, 68, 68, 0.3);
        opacity: 0;
        visibility: hidden;
      }
      
      .highlight-box.visible {
        opacity: 1;
        visibility: visible;
      }
      
      .highlight-flash {
        animation: flash 0.4s ease-out;
      }
      
      @keyframes flash {
        0% { 
          background: rgba(239, 68, 68, 0.4); 
          box-shadow: 0 0 0 8px rgba(239, 68, 68, 0.3), 
                      inset 0 0 0 1px rgba(239, 68, 68, 0.5);
        }
        100% { 
          background: rgba(239, 68, 68, 0.08); 
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.15), 
                      inset 0 0 0 1px rgba(239, 68, 68, 0.3);
        }
      }
      
      /* Preview Panel Styles */
      .preview-panel {
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 380px;
        max-height: calc(100vh - 120px);
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border-radius: 16px;
        pointer-events: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1);
        opacity: 0;
        display: none;
        overflow: hidden;
        flex-direction: column;
      }

      .preview-panel.visible {
        opacity: 1;
        display: flex;
      }
      
      .preview-panel.collapsed {
        max-height: 52px;
      }
      
      .preview-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        background: rgba(0,0,0,0.2);
        cursor: pointer;
        user-select: none;
      }
      
      .preview-header:hover {
        background: rgba(0,0,0,0.3);
      }
      
      .preview-title {
        color: #fff;
        font-size: 14px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .preview-badge {
        background: #ef4444;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 10px;
      }
      
      .collapse-icon {
        color: rgba(255,255,255,0.6);
        font-size: 18px;
        transition: transform 0.2s;
      }
      
      .preview-panel.collapsed .collapse-icon {
        transform: rotate(180deg);
      }
      
      .preview-content {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      
      .preview-content::-webkit-scrollbar {
        width: 6px;
      }
      
      .preview-content::-webkit-scrollbar-track {
        background: rgba(255,255,255,0.05);
        border-radius: 3px;
      }
      
      .preview-content::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.2);
        border-radius: 3px;
      }
      
      .preview-content::-webkit-scrollbar-thumb:hover {
        background: rgba(255,255,255,0.3);
      }
      
      .step-card {
        background: rgba(255,255,255,0.05);
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.08);
      }
      
      .step-card-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        background: rgba(0,0,0,0.2);
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }
      
      .step-number {
        background: #ef4444;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      
      .step-action {
        color: rgba(255,255,255,0.7);
        font-size: 12px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .step-screenshot {
        width: 100%;
        aspect-ratio: 16 / 9;
        background: #000;
        position: relative;
        overflow: hidden;
      }
      
      .step-screenshot img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      
      .step-screenshot-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%);
        color: rgba(255,255,255,0.3);
        font-size: 12px;
      }
      
      .step-fields {
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      
      .step-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      
      .step-field-label {
        color: rgba(255,255,255,0.5);
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .step-field-input {
        background: rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        padding: 10px 12px;
        color: #fff;
        font-size: 13px;
        outline: none;
        transition: border-color 0.2s, background 0.2s;
        resize: none;
        font-family: inherit;
      }
      
      .step-field-input:focus {
        border-color: rgba(239, 68, 68, 0.5);
        background: rgba(0,0,0,0.4);
      }
      
      .step-field-input::placeholder {
        color: rgba(255,255,255,0.3);
      }
      
      .step-field-input.title {
        font-weight: 600;
      }
      
      .step-field-input.description {
        min-height: 60px;
        line-height: 1.4;
      }
      
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        color: rgba(255,255,255,0.4);
        text-align: center;
      }
      
      .empty-state-icon {
        font-size: 48px;
        margin-bottom: 12px;
        opacity: 0.5;
      }
      
      .empty-state-text {
        font-size: 14px;
        line-height: 1.5;
      }
    `;

    controlPanel = document.createElement('div');
    controlPanel.className = 'control-panel';
    controlPanel.innerHTML = `
      <div class="status">
        <div class="status-dot"></div>
        <span class="status-text">Recording</span>
      </div>
      <div class="step-count">0 steps</div>
      <button class="btn btn-toggle" data-action="toggle" title="Toggle preview panel">Preview</button>
      <button class="btn btn-pause" data-action="pause">Pause</button>
      <button class="btn btn-stop" data-action="stop">Stop</button>
    `;

    previewPanel = document.createElement('div');
    previewPanel.className = 'preview-panel';
    previewPanel.innerHTML = `
      <div class="preview-header">
        <div class="preview-title">
          <span>Captured Steps</span>
          <span class="preview-badge">0</span>
        </div>
        <span class="collapse-icon">▼</span>
      </div>
      <div class="preview-content">
        <div class="empty-state">
          <div class="empty-state-icon">📸</div>
          <div class="empty-state-text">Click on elements to capture steps.<br/>Screenshots will appear here.</div>
        </div>
      </div>
    `;

    highlightBox = document.createElement('div');
    highlightBox.className = 'highlight-box';

    previewContent = previewPanel.querySelector('.preview-content');

    shadow.appendChild(styles);
    shadow.appendChild(previewPanel);
    shadow.appendChild(controlPanel);
    shadow.appendChild(highlightBox);

    document.body.appendChild(container);

    controlPanel.addEventListener('click', (e) => {
      const action = e.target.dataset?.action;
      if (action === 'pause') togglePause();
      if (action === 'resume') togglePause();
      if (action === 'stop') stopRecording(true);
      if (action === 'toggle') togglePreviewPanel();
    });

    previewPanel.querySelector('.preview-header').addEventListener('click', () => {
      togglePreviewCollapse();
    });
  }

  function startRecording() {
    createOverlay();
    isRecording = true;
    isPaused = false;
    stepCount = 0;
    cleanupBlobUrls(capturedSteps);
    capturedSteps = [];
    isPanelCollapsed = false;
    updateUI();
    updatePreviewPanel();
    setupMessageListener();
    
    requestAnimationFrame(() => {
      controlPanel.classList.add('visible');
      previewPanel.classList.add('visible');
      previewPanel.classList.remove('collapsed');
    });
  }
  
  function cleanupBlobUrls(steps) {
    steps.forEach(s => {
      if (s.screenshotDataUrl && s.screenshotDataUrl.startsWith('blob:')) {
        try { URL.revokeObjectURL(s.screenshotDataUrl); } catch (e) {}
      }
    });
  }
  
  let messageListenerSetup = false;
  
  function setupMessageListener() {
    if (messageListenerSetup) return;
    messageListenerSetup = true;
    
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'STEP_ADDED' && message.data) {
        updateStepWithMachineOrder(message.data);
      }
      return false;
    });
  }
  
  function updateStepWithMachineOrder(machineStep) {
    if (!machineStep.order) return;
    
    let matchedStep = null;
    
    if (machineStep.clientStepId) {
      matchedStep = capturedSteps.find(s => s.clientStepId === machineStep.clientStepId);
    }
    
    if (!matchedStep && machineStep.timestamp) {
      matchedStep = capturedSteps.find(s => 
        s.timestamp && 
        Math.abs(s.timestamp - machineStep.timestamp) < 500 &&
        !s.machineOrder
      );
    }
    
    if (matchedStep) {
      matchedStep.machineOrder = machineStep.order;
      matchedStep.order = machineStep.order;
      updatePreviewPanel();
    }
  }

  function stopRecording(userInitiated = false) {
    isRecording = false;
    isPaused = false;
    hideHighlight();

    if (userInitiated) {
      chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' }).catch(() => {});
    }

    // Show a brief "Finished" state on the control panel instead of hiding it.
    // This keeps the user informed that capture completed successfully.
    if (controlPanel) {
      const statusText = shadow.querySelector('.status-text');
      const statusDot = shadow.querySelector('.status-dot');
      const stepCountEl = shadow.querySelector('.step-count');
      if (statusText) statusText.textContent = 'Finished';
      if (statusDot) {
        statusDot.style.animation = 'none';
        statusDot.style.background = '#22c55e';
        statusDot.style.boxShadow = '0 0 8px rgba(34,197,94,0.6)';
      }
      // Hide the pause/stop buttons after capture ends
      const pauseBtn = shadow.querySelector('.btn-pause, .btn-resume');
      const stopBtn = shadow.querySelector('.btn-stop');
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (stopBtn) stopBtn.style.display = 'none';

      // Auto-hide the overlay after 4 seconds so it doesn't clutter the screen
      setTimeout(() => {
        if (!isRecording && controlPanel) {
          controlPanel.classList.remove('visible');
          previewPanel.classList.remove('visible');
          cleanupBlobUrls(capturedSteps);
          capturedSteps = [];
        }
      }, 4000);
    }
  }

  function togglePause() {
    isPaused = !isPaused;
    updateUI();
    
    const type = isPaused ? 'PAUSE_CAPTURE' : 'RESUME_CAPTURE';
    chrome.runtime.sendMessage({ type }).catch(() => {});
  }

  function togglePreviewPanel() {
    if (previewPanel.classList.contains('visible')) {
      previewPanel.classList.remove('visible');
    } else {
      previewPanel.classList.add('visible');
    }
  }

  function togglePreviewCollapse() {
    isPanelCollapsed = !isPanelCollapsed;
    if (isPanelCollapsed) {
      previewPanel.classList.add('collapsed');
    } else {
      previewPanel.classList.remove('collapsed');
    }
  }

  function updateUI() {
    if (!shadow) return;
    
    const statusDot = shadow.querySelector('.status-dot');
    const statusText = shadow.querySelector('.status-text');
    const stepCountEl = shadow.querySelector('.step-count');
    const pauseBtn = shadow.querySelector('.btn-pause, .btn-resume');

    if (isPaused) {
      statusDot?.classList.add('paused');
      if (statusText) statusText.textContent = 'Paused';
      if (pauseBtn) {
        pauseBtn.className = 'btn btn-resume';
        pauseBtn.textContent = 'Resume';
        pauseBtn.dataset.action = 'resume';
      }
    } else {
      statusDot?.classList.remove('paused');
      if (statusText) statusText.textContent = 'Recording';
      if (pauseBtn) {
        pauseBtn.className = 'btn btn-pause';
        pauseBtn.textContent = 'Pause';
        pauseBtn.dataset.action = 'pause';
      }
    }

    if (stepCountEl) {
      stepCountEl.textContent = `${stepCount} step${stepCount !== 1 ? 's' : ''}`;
    }
  }

  function updatePreviewPanel() {
    if (!previewContent || !previewPanel) return;

    const badge = previewPanel.querySelector('.preview-badge');
    if (badge) {
      badge.textContent = capturedSteps.length;
    }

    if (capturedSteps.length === 0) {
      previewContent.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📸</div>
          <div class="empty-state-text">Click on elements to capture steps.<br/>Screenshots will appear here.</div>
        </div>
      `;
      return;
    }

    const stepsToShow = capturedSteps.slice(-MAX_PREVIEW_STEPS);
    
    previewContent.innerHTML = stepsToShow.map((step, index) => {
      const stepNumber = step.order || (capturedSteps.length - stepsToShow.length + index + 1);
      const stepId = step.stepId || `temp-${index}`;
      const hasScreenshot = step.screenshotDataUrl && step.screenshotDataUrl.length > 0;
      const screenshotHtml = hasScreenshot
        ? `<img src="${step.screenshotDataUrl}" alt="Step ${stepNumber} screenshot" />`
        : `<div class="step-screenshot-placeholder">${step.actionType === 'input' ? 'Input action' : 'Capturing...'}</div>`;
      
      return `
        <div class="step-card" data-step-id="${stepId}" data-step-order="${stepNumber}">
          <div class="step-card-header">
            <div class="step-number">${stepNumber}</div>
            <div class="step-action">${step.actionType || step.action || 'click'}</div>
          </div>
          <div class="step-screenshot">
            ${screenshotHtml}
          </div>
          <div class="step-fields">
            <div class="step-field">
              <label class="step-field-label">Title</label>
              <input 
                type="text" 
                class="step-field-input title" 
                placeholder="Enter step title..."
                value="${escapeHtml(step.title || '')}"
                data-step-id="${stepId}"
                data-step-order="${stepNumber}"
                data-field="title"
              />
            </div>
            <div class="step-field">
              <label class="step-field-label">Description</label>
              <textarea 
                class="step-field-input description" 
                placeholder="Add a description..."
                data-step-id="${stepId}"
                data-step-order="${stepNumber}"
                data-field="description"
              >${escapeHtml(step.description || '')}</textarea>
            </div>
          </div>
        </div>
      `;
    }).join('');

    previewContent.querySelectorAll('.step-field-input').forEach(input => {
      input.addEventListener('input', handleFieldInput);
      input.addEventListener('blur', handleFieldBlur);
    });

    previewContent.scrollTop = previewContent.scrollHeight;
  }

  function handleFieldInput(e) {
    const stepId = e.target.dataset.stepId;
    const stepOrder = parseInt(e.target.dataset.stepOrder);
    const field = e.target.dataset.field;
    const value = e.target.value;

    const step = capturedSteps.find(s => s.stepId === stepId);
    if (step) {
      step[field] = value;
    }

    if (updateDebounceTimer) {
      clearTimeout(updateDebounceTimer);
    }
    updateDebounceTimer = setTimeout(() => {
      sendMetadataUpdate(stepId, stepOrder, field, value);
    }, 500);
  }

  function handleFieldBlur(e) {
    const stepId = e.target.dataset.stepId;
    const stepOrder = parseInt(e.target.dataset.stepOrder);
    const field = e.target.dataset.field;
    const value = e.target.value;

    if (updateDebounceTimer) {
      clearTimeout(updateDebounceTimer);
    }
    sendMetadataUpdate(stepId, stepOrder, field, value);
  }

  function sendMetadataUpdate(stepId, stepOrder, field, value) {
    const step = capturedSteps.find(s => s.stepId === stepId);
    const clientStepId = step?.clientStepId || stepId;
    const machineOrder = step?.machineOrder;
    
    if (!clientStepId && machineOrder === undefined) {
      console.log('[FlowCapture Overlay] Cannot send metadata update - no identifier available');
      return;
    }
    
    chrome.runtime.sendMessage({
      type: 'UPDATE_STEP_METADATA',
      data: {
        stepIndex: machineOrder,
        clientStepId: clientStepId,
        field,
        value
      }
    }).catch(() => {});
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function addCapturedStep(stepData) {
    const stepId = stepData.clientStepId || `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    capturedSteps.push({
      ...stepData,
      stepId: stepId,
      clientStepId: stepData.clientStepId || stepId,
      order: stepCount
    });

    if (capturedSteps.length > MAX_PREVIEW_STEPS * 2) {
      const removedSteps = capturedSteps.slice(0, capturedSteps.length - MAX_PREVIEW_STEPS);
      capturedSteps = capturedSteps.slice(-MAX_PREVIEW_STEPS);
      removedSteps.forEach(s => {
        if (s.screenshotDataUrl && s.screenshotDataUrl.startsWith('blob:')) {
          try { URL.revokeObjectURL(s.screenshotDataUrl); } catch (e) {}
        }
      });
    }

    updatePreviewPanel();

    if (isPanelCollapsed) {
      isPanelCollapsed = false;
      previewPanel?.classList.remove('collapsed');
    }
  }

  function showHighlight(element) {
    if (!isRecording || isPaused || !highlightBox) return;
    
    const rect = element.getBoundingClientRect();
    const padding = 3;
    
    highlightBox.style.left = `${rect.left - padding}px`;
    highlightBox.style.top = `${rect.top - padding}px`;
    highlightBox.style.width = `${rect.width + padding * 2}px`;
    highlightBox.style.height = `${rect.height + padding * 2}px`;
    highlightBox.classList.add('visible');
  }

  function hideHighlight() {
    if (highlightBox) {
      highlightBox.classList.remove('visible');
    }
  }

  function flashHighlight(element) {
    if (!highlightBox) return;
    
    showHighlight(element);
    highlightBox.classList.remove('highlight-flash');
    void highlightBox.offsetWidth;
    highlightBox.classList.add('highlight-flash');
  }

  function incrementStepCount() {
    stepCount++;
    updateUI();
  }

  function isOverlayClick(element) {
    let current = element;
    while (current) {
      if (current === container || current.id === OVERLAY_ID) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  function destroy() {
    cleanupBlobUrls(capturedSteps);
    capturedSteps = [];
    
    if (container) {
      container.remove();
      container = null;
      shadow = null;
      highlightBox = null;
      controlPanel = null;
      previewPanel = null;
      previewContent = null;
    }
  }

  window.FlowCaptureOverlay = {
    startRecording,
    stopRecording,
    togglePause,
    showHighlight,
    hideHighlight,
    flashHighlight,
    incrementStepCount,
    addCapturedStep,
    isOverlayClick,
    destroy,
    isRecording: () => isRecording,
    isPaused: () => isPaused,
    getStepCount: () => stepCount
  };
})();
