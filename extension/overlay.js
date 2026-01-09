(function() {
  if (window.FlowCaptureOverlay) return;

  const OVERLAY_ID = 'flowcapture-overlay';
  let container = null;
  let shadow = null;
  let isRecording = false;
  let isPaused = false;
  let stepCount = 0;
  let highlightBox = null;

  function createOverlay() {
    if (document.getElementById(OVERLAY_ID)) {
      container = document.getElementById(OVERLAY_ID);
      shadow = container.shadowRoot;
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
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .control-panel {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #1a1a2e;
        border-radius: 12px;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 12px;
        pointer-events: auto;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.1);
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
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #ef4444;
        animation: pulse 1.5s infinite;
      }
      
      .status-dot.paused {
        background: #f59e0b;
        animation: none;
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      
      .step-count {
        background: rgba(255,255,255,0.1);
        padding: 4px 10px;
        border-radius: 6px;
        color: #fff;
        font-size: 13px;
      }
      
      .btn {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.15s;
      }
      
      .btn-pause {
        background: #f59e0b;
        color: #000;
      }
      
      .btn-pause:hover {
        background: #d97706;
      }
      
      .btn-stop {
        background: #ef4444;
        color: #fff;
      }
      
      .btn-stop:hover {
        background: #dc2626;
      }
      
      .btn-resume {
        background: #22c55e;
        color: #fff;
      }
      
      .btn-resume:hover {
        background: #16a34a;
      }
      
      .highlight-box {
        position: fixed;
        border: 3px solid #ef4444;
        background: rgba(239, 68, 68, 0.1);
        border-radius: 4px;
        pointer-events: none;
        transition: all 0.1s ease-out;
        box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2);
      }
      
      .highlight-flash {
        animation: flash 0.3s ease-out;
      }
      
      @keyframes flash {
        0% { background: rgba(239, 68, 68, 0.4); }
        100% { background: rgba(239, 68, 68, 0.1); }
      }
      
      .hidden {
        display: none !important;
      }
    `;

    const panel = document.createElement('div');
    panel.className = 'control-panel hidden';
    panel.innerHTML = `
      <div class="status">
        <div class="status-dot"></div>
        <span>Recording</span>
      </div>
      <div class="step-count">0 steps</div>
      <button class="btn btn-pause" data-action="pause">Pause</button>
      <button class="btn btn-stop" data-action="stop">Stop</button>
    `;

    highlightBox = document.createElement('div');
    highlightBox.className = 'highlight-box hidden';

    shadow.appendChild(styles);
    shadow.appendChild(panel);
    shadow.appendChild(highlightBox);

    document.body.appendChild(container);

    panel.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
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
    
    const panel = shadow.querySelector('.control-panel');
    panel.classList.remove('hidden');
  }

  function stopRecording(userInitiated = false) {
    isRecording = false;
    isPaused = false;
    
    const panel = shadow.querySelector('.control-panel');
    panel.classList.add('hidden');
    hideHighlight();
    
    if (userInitiated && window.FlowCaptureMessaging) {
      window.FlowCaptureMessaging.stopCapture();
    }
  }

  function togglePause() {
    isPaused = !isPaused;
    updateUI();
    
    if (window.FlowCaptureMessaging) {
      if (isPaused) {
        window.FlowCaptureMessaging.pauseCapture();
      } else {
        window.FlowCaptureMessaging.resumeCapture();
      }
    }
  }

  function updateUI() {
    const statusDot = shadow.querySelector('.status-dot');
    const statusText = shadow.querySelector('.status span');
    const stepCountEl = shadow.querySelector('.step-count');
    const pauseBtn = shadow.querySelector('.btn-pause, .btn-resume');

    if (isPaused) {
      statusDot.classList.add('paused');
      statusText.textContent = 'Paused';
      pauseBtn.className = 'btn btn-resume';
      pauseBtn.textContent = 'Resume';
      pauseBtn.dataset.action = 'resume';
    } else {
      statusDot.classList.remove('paused');
      statusText.textContent = 'Recording';
      pauseBtn.className = 'btn btn-pause';
      pauseBtn.textContent = 'Pause';
      pauseBtn.dataset.action = 'pause';
    }

    stepCountEl.textContent = `${stepCount} step${stepCount !== 1 ? 's' : ''}`;
  }

  function showHighlight(element) {
    if (!isRecording || isPaused || !highlightBox) return;
    
    const rect = element.getBoundingClientRect();
    highlightBox.style.left = `${rect.left - 3}px`;
    highlightBox.style.top = `${rect.top - 3}px`;
    highlightBox.style.width = `${rect.width + 6}px`;
    highlightBox.style.height = `${rect.height + 6}px`;
    highlightBox.classList.remove('hidden');
  }

  function hideHighlight() {
    if (highlightBox) {
      highlightBox.classList.add('hidden');
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

  window.FlowCaptureOverlay = {
    startRecording,
    stopRecording,
    togglePause,
    showHighlight,
    hideHighlight,
    flashHighlight,
    incrementStepCount,
    isOverlayClick,
    isRecording: () => isRecording,
    isPaused: () => isPaused,
    getStepCount: () => stepCount
  };
})();
