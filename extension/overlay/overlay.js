/**
 * FlowCapture Overlay
 * Shadow DOM-based sticky UI with highlight box and control panel
 */

(function() {
  if (window.FlowCaptureOverlay) return;

  const OVERLAY_ID = 'flowcapture-overlay';
  const Z_INDEX = 2147483647;
  
  let container = null;
  let shadow = null;
  let isRecording = false;
  let isPaused = false;
  let stepCount = 0;
  let highlightBox = null;
  let controlPanel = null;

  function createOverlay() {
    if (document.getElementById(OVERLAY_ID)) {
      container = document.getElementById(OVERLAY_ID);
      shadow = container.shadowRoot;
      highlightBox = shadow.querySelector('.highlight-box');
      controlPanel = shadow.querySelector('.control-panel');
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
        transform: translateY(10px);
        transition: opacity 0.2s, transform 0.2s;
      }
      
      .control-panel.visible {
        opacity: 1;
        transform: translateY(0);
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
      
      .badge {
        position: absolute;
        top: -8px;
        right: -8px;
        background: #ef4444;
        color: white;
        font-size: 11px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 10px;
        min-width: 20px;
        text-align: center;
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
      <button class="btn btn-pause" data-action="pause">Pause</button>
      <button class="btn btn-stop" data-action="stop">Stop</button>
    `;

    highlightBox = document.createElement('div');
    highlightBox.className = 'highlight-box';

    shadow.appendChild(styles);
    shadow.appendChild(controlPanel);
    shadow.appendChild(highlightBox);

    document.body.appendChild(container);

    controlPanel.addEventListener('click', (e) => {
      const action = e.target.dataset?.action;
      if (action === 'pause') togglePause();
      if (action === 'resume') togglePause();
      if (action === 'stop') stopRecording(true);
    });
  }

  function startRecording() {
    createOverlay();
    isRecording = true;
    isPaused = false;
    stepCount = 0;
    updateUI();
    
    requestAnimationFrame(() => {
      controlPanel.classList.add('visible');
    });
  }

  function stopRecording(userInitiated = false) {
    isRecording = false;
    isPaused = false;
    
    controlPanel.classList.remove('visible');
    hideHighlight();
    
    if (userInitiated) {
      chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' }).catch(() => {});
    }
  }

  function togglePause() {
    isPaused = !isPaused;
    updateUI();
    
    const type = isPaused ? 'PAUSE_CAPTURE' : 'RESUME_CAPTURE';
    chrome.runtime.sendMessage({ type }).catch(() => {});
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
    if (container) {
      container.remove();
      container = null;
      shadow = null;
      highlightBox = null;
      controlPanel = null;
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
    isOverlayClick,
    destroy,
    isRecording: () => isRecording,
    isPaused: () => isPaused,
    getStepCount: () => stepCount
  };
})();
