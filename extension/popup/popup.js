document.addEventListener('DOMContentLoaded', async () => {
  const notRecordingPanel = document.getElementById('not-recording');
  const capturingPanel = document.getElementById('capturing');
  const finishedPanel = document.getElementById('finished');
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const resumeBtn = document.getElementById('resume-btn');
  const pulseIndicator = document.getElementById('pulse-indicator');
  const captureStatusText = document.getElementById('capture-status-text');
  const viewBtn = document.getElementById('view-btn');
  const newBtn = document.getElementById('new-btn');
  const openDashboard = document.getElementById('open-dashboard');
  const stepCount = document.getElementById('step-count');
  const finalStepCount = document.getElementById('final-step-count');
  const settingsLink = document.getElementById('settings-link');
  const settingsModal = document.getElementById('settings-modal');
  const apiUrlInput = document.getElementById('api-url');
  const saveSettingsBtn = document.getElementById('save-settings');
  const cancelSettingsBtn = document.getElementById('cancel-settings');
  const elementCaptureBtn = document.getElementById('element-capture-btn');
  const borderColorInput = document.getElementById('border-color');
  const colorPresets = document.querySelectorAll('.color-preset');
  const tabSelectorModal = document.getElementById('tab-selector-modal');
  const tabList = document.getElementById('tab-list');
  const cancelTabSelectBtn = document.getElementById('cancel-tab-select');

  let lastCaptureResult = null;

  function showPanel(panel) {
    notRecordingPanel.classList.add('hidden');
    capturingPanel.classList.add('hidden');
    finishedPanel.classList.add('hidden');
    panel.classList.remove('hidden');
  }

  function updatePauseResumeUI(isPaused) {
    if (isPaused) {
      pauseBtn.classList.add('hidden');
      resumeBtn.classList.remove('hidden');
      pulseIndicator.classList.add('paused');
      captureStatusText.textContent = 'Paused';
    } else {
      pauseBtn.classList.remove('hidden');
      resumeBtn.classList.add('hidden');
      pulseIndicator.classList.remove('paused');
      captureStatusText.textContent = 'Capturing...';
    }
  }

  async function updateState() {
    try {
      const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
      const settings = await chrome.storage.local.get(['highlightColor', 'apiBaseUrl']);
      
      if (settings.highlightColor) {
        borderColorInput.value = settings.highlightColor;
        updateActivePreset(settings.highlightColor);
      }
      
      if (settings.apiBaseUrl) {
        apiUrlInput.value = settings.apiBaseUrl;
      }

      if (state?.isCapturing) {
        showPanel(capturingPanel);
        stepCount.textContent = state.stepCount || 0;
        updatePauseResumeUI(state.isPaused);
      } else if (lastCaptureResult && lastCaptureResult.stepCount > 0) {
        showPanel(finishedPanel);
        finalStepCount.textContent = lastCaptureResult.stepCount;
      } else {
        showPanel(notRecordingPanel);
      }
    } catch (e) {
      console.error('Failed to get state:', e);
      showPanel(notRecordingPanel);
    }
  }

  function updateActivePreset(color) {
    colorPresets.forEach(preset => {
      if (preset.dataset.color.toLowerCase() === color.toLowerCase()) {
        preset.classList.add('active');
      } else {
        preset.classList.remove('active');
      }
    });
  }

  async function checkAndRequestPermissions() {
    try {
      const hasPermission = await chrome.permissions.contains({ origins: ['<all_urls>'] });
      
      if (!hasPermission) {
        const confirmed = confirm(
          'FlowCapture needs permission to capture on all websites.\n\n' +
          'Click OK to grant permission, or Cancel to configure specific sites in settings.'
        );
        
        if (confirmed) {
          const granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
          return granted;
        }
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  async function startCapture() {
    const hasPermission = await checkAndRequestPermissions();
    if (!hasPermission) {
      alert('Permission required to capture. Please grant access in the extension settings.');
      return;
    }

    const highlightColor = borderColorInput.value;
    await chrome.storage.local.set({ highlightColor });

    const result = await chrome.runtime.sendMessage({ 
      type: 'START_CAPTURE',
      data: { highlightColor }
    });

    if (result?.success) {
      showPanel(capturingPanel);
      stepCount.textContent = '0';
      updatePauseResumeUI(false);
      window.close();
    } else if (result?.error === 'Host permissions required') {
      alert('Permission required. Please grant access to capture on websites.');
    }
  }

  async function stopCapture() {
    const result = await chrome.runtime.sendMessage({ 
      type: 'STOP_CAPTURE'
    });

    if (result?.success) {
      lastCaptureResult = result;
      showPanel(finishedPanel);
      finalStepCount.textContent = result.stepCount || 0;
    }
  }

  startBtn.addEventListener('click', startCapture);
  
  stopBtn.addEventListener('click', stopCapture);

  pauseBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'PAUSE_CAPTURE' });
    updatePauseResumeUI(true);
  });

  resumeBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'RESUME_CAPTURE' });
    updatePauseResumeUI(false);
  });

  viewBtn.addEventListener('click', async () => {
    const settings = await chrome.storage.local.get(['apiBaseUrl']);
    const apiBaseUrl = settings.apiBaseUrl || '';
    
    if (apiBaseUrl && lastCaptureResult?.guideId) {
      chrome.tabs.create({ url: `${apiBaseUrl}/guides/${lastCaptureResult.guideId}` });
    } else if (apiBaseUrl) {
      chrome.tabs.create({ url: apiBaseUrl });
    } else {
      alert('Please configure your Dashboard URL in Settings first.');
    }
  });

  newBtn.addEventListener('click', () => {
    lastCaptureResult = null;
    showPanel(notRecordingPanel);
  });

  openDashboard.addEventListener('click', async (e) => {
    e.preventDefault();
    const settings = await chrome.storage.local.get(['apiBaseUrl']);
    const apiBaseUrl = settings.apiBaseUrl || '';
    
    if (apiBaseUrl) {
      chrome.tabs.create({ url: apiBaseUrl });
    } else {
      alert('Please configure your Dashboard URL in Settings first.');
      settingsModal.classList.remove('hidden');
    }
  });

  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    settingsModal.classList.remove('hidden');
  });

  saveSettingsBtn.addEventListener('click', async () => {
    let apiUrl = apiUrlInput.value.trim();
    
    if (apiUrl && !apiUrl.startsWith('http')) {
      apiUrl = 'https://' + apiUrl;
    }
    apiUrl = apiUrl.replace(/\/$/, '');
    
    await chrome.storage.local.set({ 
      apiBaseUrl: apiUrl,
      highlightColor: borderColorInput.value
    });
    
    settingsModal.classList.add('hidden');
  });

  cancelSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  borderColorInput.addEventListener('change', (e) => {
    updateActivePreset(e.target.value);
    chrome.storage.local.set({ highlightColor: e.target.value });
  });

  colorPresets.forEach(preset => {
    preset.addEventListener('click', () => {
      const color = preset.dataset.color;
      borderColorInput.value = color;
      updateActivePreset(color);
      chrome.storage.local.set({ highlightColor: color });
    });
  });

  elementCaptureBtn.addEventListener('click', async () => {
    const hasPermission = await checkAndRequestPermissions();
    if (!hasPermission) {
      alert('Permission required to capture elements.');
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && !tab.url.startsWith('chrome://')) {
      const highlightColor = borderColorInput.value;
      
      await chrome.runtime.sendMessage({ 
        type: 'START_CAPTURE',
        data: { 
          highlightColor,
          singleElement: true
        }
      });
      
      window.close();
    }
  });

  cancelTabSelectBtn.addEventListener('click', () => {
    tabSelectorModal.classList.add('hidden');
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'STATE_UPDATE') {
      const { isCapturing, isPaused, stepCount: count } = message.data || {};
      
      if (isCapturing) {
        showPanel(capturingPanel);
        stepCount.textContent = count || 0;
        updatePauseResumeUI(isPaused);
      }
    }
  });

  await updateState();
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
