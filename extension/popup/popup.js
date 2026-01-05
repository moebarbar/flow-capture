document.addEventListener('DOMContentLoaded', async () => {
  const notRecordingPanel = document.getElementById('not-recording');
  const recordingPanel = document.getElementById('recording');
  const finishedPanel = document.getElementById('finished');
  const syncPanel = document.getElementById('sync-panel');
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  const viewBtn = document.getElementById('view-btn');
  const newBtn = document.getElementById('new-btn');
  const syncBtn = document.getElementById('sync-btn');
  const skipSyncBtn = document.getElementById('skip-sync-btn');
  const openDashboard = document.getElementById('open-dashboard');
  const stepCount = document.getElementById('step-count');
  const finalStepCount = document.getElementById('final-step-count');
  const workspaceSelect = document.getElementById('workspace-select');
  const guideTitleInput = document.getElementById('guide-title');
  const syncStatus = document.getElementById('sync-status');
  const settingsLink = document.getElementById('settings-link');
  const settingsModal = document.getElementById('settings-modal');
  const apiUrlInput = document.getElementById('api-url');
  const saveSettingsBtn = document.getElementById('save-settings');
  const cancelSettingsBtn = document.getElementById('cancel-settings');
  const elementCaptureBtn = document.getElementById('element-capture-btn');
  const captureElementDuringRecording = document.getElementById('capture-element-during-recording');
  const borderColorInput = document.getElementById('border-color');
  const colorPresets = document.querySelectorAll('.color-preset');

  function showPanel(panel) {
    notRecordingPanel.classList.add('hidden');
    recordingPanel.classList.add('hidden');
    finishedPanel.classList.add('hidden');
    syncPanel.classList.add('hidden');
    panel.classList.remove('hidden');
  }

  async function updateState() {
    const { isRecording, steps, guideId, borderColor } = await chrome.storage.local.get(['isRecording', 'steps', 'guideId', 'borderColor']);
    
    if (borderColor) {
      borderColorInput.value = borderColor;
      updateActivePreset(borderColor);
    }
    
    if (isRecording) {
      showPanel(recordingPanel);
      stepCount.textContent = (steps || []).length;
    } else if (guideId) {
      showPanel(finishedPanel);
      finalStepCount.textContent = (steps || []).length;
    } else if (steps && steps.length > 0) {
      await loadWorkspaces();
      showPanel(syncPanel);
    } else {
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

  async function loadWorkspaces() {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_WORKSPACES' }, resolve);
      });
      
      if (response.error) {
        syncStatus.textContent = 'Please log in to sync';
        syncStatus.classList.add('error');
        return;
      }

      workspaceSelect.innerHTML = '';
      const workspaces = response.workspaces || [];
      
      if (workspaces.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No workspaces found';
        workspaceSelect.appendChild(option);
      } else {
        workspaces.forEach(ws => {
          const option = document.createElement('option');
          option.value = ws.id;
          option.textContent = ws.name;
          workspaceSelect.appendChild(option);
        });
      }
    } catch (error) {
      syncStatus.textContent = 'Failed to load workspaces';
      syncStatus.classList.add('error');
    }
  }

  startBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({ 
      isRecording: true, 
      steps: [],
      guideId: null,
      startTime: Date.now()
    });
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'START_RECORDING' });
    }
    
    chrome.runtime.sendMessage({ type: 'START_RECORDING' });
    showPanel(recordingPanel);
    stepCount.textContent = '0';
  });

  stopBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({ isRecording: false });
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'STOP_RECORDING' });
    }
    
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
    
    await loadWorkspaces();
    showPanel(syncPanel);
  });

  elementCaptureBtn.addEventListener('click', async () => {
    window.close();
    
    chrome.runtime.sendMessage({ type: 'START_ELEMENT_CAPTURE' });
  });

  captureElementDuringRecording.addEventListener('click', async () => {
    window.close();
    
    chrome.runtime.sendMessage({ type: 'START_ELEMENT_CAPTURE' });
  });

  borderColorInput.addEventListener('input', async (e) => {
    const color = e.target.value;
    updateActivePreset(color);
    chrome.runtime.sendMessage({ type: 'SET_BORDER_COLOR', color });
  });

  colorPresets.forEach(preset => {
    preset.addEventListener('click', async () => {
      const color = preset.dataset.color;
      borderColorInput.value = color;
      updateActivePreset(color);
      chrome.runtime.sendMessage({ type: 'SET_BORDER_COLOR', color });
    });
  });

  syncBtn.addEventListener('click', async () => {
    const workspaceId = parseInt(workspaceSelect.value, 10);
    const title = guideTitleInput.value.trim();

    if (!workspaceId) {
      syncStatus.textContent = 'Please select a workspace';
      syncStatus.classList.add('error');
      return;
    }

    syncBtn.disabled = true;
    syncBtn.textContent = 'Syncing...';
    syncStatus.textContent = '';
    syncStatus.classList.remove('error');

    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'SYNC_TO_BACKEND',
          workspaceId,
          title: title || undefined
        }, resolve);
      });

      if (response.error) {
        throw new Error(response.error);
      }

      const { steps } = await chrome.storage.local.get(['steps']);
      finalStepCount.textContent = response.stepsCreated || 0;
      showPanel(finishedPanel);
    } catch (error) {
      syncStatus.textContent = error.message || 'Sync failed';
      syncStatus.classList.add('error');
      syncBtn.disabled = false;
      syncBtn.textContent = 'Sync to Dashboard';
    }
  });

  skipSyncBtn.addEventListener('click', async () => {
    const { steps } = await chrome.storage.local.get(['steps']);
    finalStepCount.textContent = (steps || []).length;
    showPanel(finishedPanel);
  });

  viewBtn.addEventListener('click', async () => {
    const { guideId } = await chrome.storage.local.get(['guideId']);
    const baseUrl = await getDashboardUrl();
    if (guideId) {
      chrome.tabs.create({ url: `${baseUrl}/guides/${guideId}` });
    } else {
      chrome.tabs.create({ url: baseUrl });
    }
  });

  newBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({ steps: [], guideId: null });
    showPanel(notRecordingPanel);
  });

  openDashboard.addEventListener('click', async (e) => {
    e.preventDefault();
    const url = await getDashboardUrl();
    chrome.tabs.create({ url });
  });

  settingsLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const { apiBaseUrl } = await chrome.storage.local.get(['apiBaseUrl']);
    apiUrlInput.value = apiBaseUrl || 'https://flowcapture.replit.app';
    settingsModal.classList.remove('hidden');
  });

  cancelSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  saveSettingsBtn.addEventListener('click', async () => {
    const url = apiUrlInput.value.trim();
    if (url) {
      await chrome.storage.local.set({ apiBaseUrl: url });
    }
    settingsModal.classList.add('hidden');
  });

  async function getDashboardUrl() {
    const { apiBaseUrl } = await chrome.storage.local.get(['apiBaseUrl']);
    return apiBaseUrl || 'https://flowcapture.replit.app';
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.steps) {
      stepCount.textContent = (changes.steps.newValue || []).length;
    }
  });

  await updateState();
});
