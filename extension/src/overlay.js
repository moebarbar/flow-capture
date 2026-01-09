class CaptureOverlay {
  constructor() {
    this.container = null;
    this.shadowRoot = null;
    this.highlight = null;
    this.panel = null;
    this.isRecording = false;
    this.isPaused = false;
    this.isMinimized = false;
    this.steps = [];
    this.currentElement = null;
    this.highlightColor = '#ef4444';
  }

  init() {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.id = 'flowcapture-overlay';
    this.shadowRoot = this.container.attachShadow({ mode: 'closed' });

    const styleLink = document.createElement('link');
    styleLink.rel = 'stylesheet';
    styleLink.href = chrome.runtime.getURL('src/styles.css');
    this.shadowRoot.appendChild(styleLink);

    const wrapper = document.createElement('div');
    wrapper.className = 'fc-overlay-container';
    wrapper.innerHTML = `
      <div class="fc-highlight-overlay fc-hidden" id="fc-highlight">
        <div class="fc-highlight-label" id="fc-highlight-label"></div>
      </div>
      <div class="fc-capture-panel fc-hidden" id="fc-panel">
        <div class="fc-panel-header">
          <div class="fc-panel-title">
            <div class="fc-recording-dot" id="fc-recording-dot"></div>
            <span>FlowCapture</span>
          </div>
          <div class="fc-panel-controls">
            <button class="fc-btn" id="fc-pause-btn" title="Pause">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="6" y="4" width="4" height="16"/>
                <rect x="14" y="4" width="4" height="16"/>
              </svg>
            </button>
            <button class="fc-btn fc-hidden" id="fc-resume-btn" title="Resume">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5,3 19,12 5,21"/>
              </svg>
            </button>
            <button class="fc-btn" id="fc-minimize-btn" title="Minimize">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="fc-panel-body">
          <div class="fc-step-count">
            <span class="fc-step-count-label">Steps captured</span>
            <span class="fc-step-count-value" id="fc-step-count">0</span>
          </div>
          <div class="fc-steps-preview" id="fc-steps-preview"></div>
        </div>
        <div class="fc-panel-footer">
          <button class="fc-btn-secondary" id="fc-cancel-btn">Cancel</button>
          <button class="fc-btn-primary" id="fc-finish-btn">Finish Capture</button>
        </div>
      </div>
    `;
    this.shadowRoot.appendChild(wrapper);

    document.body.appendChild(this.container);

    this.highlight = this.shadowRoot.getElementById('fc-highlight');
    this.highlightLabel = this.shadowRoot.getElementById('fc-highlight-label');
    this.panel = this.shadowRoot.getElementById('fc-panel');
    this.stepCount = this.shadowRoot.getElementById('fc-step-count');
    this.stepsPreview = this.shadowRoot.getElementById('fc-steps-preview');
    this.recordingDot = this.shadowRoot.getElementById('fc-recording-dot');

    this.bindEvents();
  }

  bindEvents() {
    this.shadowRoot.getElementById('fc-pause-btn').addEventListener('click', () => this.togglePause());
    this.shadowRoot.getElementById('fc-resume-btn').addEventListener('click', () => this.togglePause());
    this.shadowRoot.getElementById('fc-minimize-btn').addEventListener('click', () => this.toggleMinimize());
    this.shadowRoot.getElementById('fc-cancel-btn').addEventListener('click', () => this.cancel());
    this.shadowRoot.getElementById('fc-finish-btn').addEventListener('click', () => this.finish());
  }

  startRecording(highlightColor) {
    this.init();
    if (highlightColor) {
      this.highlightColor = highlightColor;
      this.highlight.style.setProperty('--fc-highlight-color', highlightColor);
    }
    this.isRecording = true;
    this.isPaused = false;
    this.steps = [];
    this.panel.classList.remove('fc-hidden');
    this.updateUI();
    this.showToast('Recording started - click on elements to capture');
  }

  stopRecording() {
    this.isRecording = false;
    this.isPaused = false;
    this.hideHighlight();
    this.panel.classList.add('fc-hidden');
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    this.updateUI();
    
    const pauseBtn = this.shadowRoot.getElementById('fc-pause-btn');
    const resumeBtn = this.shadowRoot.getElementById('fc-resume-btn');
    
    if (this.isPaused) {
      pauseBtn.classList.add('fc-hidden');
      resumeBtn.classList.remove('fc-hidden');
      this.recordingDot.classList.add('paused');
      this.hideHighlight();
      this.showToast('Recording paused');
    } else {
      pauseBtn.classList.remove('fc-hidden');
      resumeBtn.classList.add('fc-hidden');
      this.recordingDot.classList.remove('paused');
      this.showToast('Recording resumed');
    }

    chrome.runtime.sendMessage({ 
      type: this.isPaused ? 'PAUSE_CAPTURE' : 'RESUME_CAPTURE' 
    });
  }

  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    this.panel.classList.toggle('fc-minimized', this.isMinimized);
  }

  cancel() {
    if (confirm('Are you sure you want to cancel? All captured steps will be lost.')) {
      chrome.runtime.sendMessage({ type: 'STOP_CAPTURE', data: { cancelled: true } });
      this.stopRecording();
    }
  }

  finish() {
    chrome.runtime.sendMessage({ type: 'STOP_CAPTURE', data: { cancelled: false } });
    this.stopRecording();
  }

  showHighlight(element) {
    if (!this.isRecording || this.isPaused) return;
    if (this.container.contains(element)) return;

    this.currentElement = element;
    const rect = element.getBoundingClientRect();

    this.highlight.style.left = `${rect.left - 3}px`;
    this.highlight.style.top = `${rect.top - 3}px`;
    this.highlight.style.width = `${rect.width + 6}px`;
    this.highlight.style.height = `${rect.height + 6}px`;

    const description = window.FlowCaptureSelectorEngine?.getElementDescription(element) || element.tagName.toLowerCase();
    this.highlightLabel.textContent = description;

    this.highlight.classList.remove('fc-hidden');
  }

  hideHighlight() {
    this.highlight.classList.add('fc-hidden');
    this.currentElement = null;
  }

  addStep(step) {
    this.steps.push(step);
    this.updateUI();
  }

  updateUI() {
    this.stepCount.textContent = this.steps.length;
    
    this.stepsPreview.innerHTML = '';
    const recentSteps = this.steps.slice(-3).reverse();
    
    recentSteps.forEach((step, index) => {
      const stepEl = document.createElement('div');
      stepEl.className = 'fc-step-item';
      stepEl.innerHTML = `
        <img class="fc-step-thumbnail" src="${step.screenshot || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>'}" alt="">
        <div class="fc-step-info">
          <div class="fc-step-title">${this.escapeHtml(step.title || `Step ${this.steps.length - index}`)}</div>
          <div class="fc-step-action">${this.escapeHtml(step.actionType || 'click')}</div>
        </div>
        <button class="fc-step-delete" data-index="${this.steps.length - 1 - index}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `;
      
      stepEl.querySelector('.fc-step-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(e.currentTarget.dataset.index);
        this.deleteStep(idx);
      });
      
      this.stepsPreview.appendChild(stepEl);
    });
  }

  deleteStep(index) {
    this.steps.splice(index, 1);
    this.updateUI();
    chrome.runtime.sendMessage({ type: 'DELETE_STEP', data: { index } });
  }

  showToast(message, duration = 2000) {
    const existing = this.shadowRoot.querySelector('.fc-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'fc-toast';
    toast.textContent = message;
    this.shadowRoot.appendChild(toast);

    setTimeout(() => toast.remove(), duration);
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  destroy() {
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.shadowRoot = null;
    }
  }
}

if (typeof window !== 'undefined') {
  window.FlowCaptureOverlay = new CaptureOverlay();
}
