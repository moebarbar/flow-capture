document.addEventListener('DOMContentLoaded', async () => {
  const notRecordingPanel = document.getElementById('not-recording');
  const capturingPanel = document.getElementById('capturing');
  const finishedPanel = document.getElementById('finished');
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
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
  const captureElementDuringRecording = document.getElementById('capture-element-during-recording');
  const borderColorInput = document.getElementById('border-color');
  const colorPresets = document.querySelectorAll('.color-preset');
  const tabSelectorModal = document.getElementById('tab-selector-modal');
  const tabList = document.getElementById('tab-list');
  const cancelTabSelectBtn = document.getElementById('cancel-tab-select');

  function showPanel(panel) {
    notRecordingPanel.classList.add('hidden');
    capturingPanel.classList.add('hidden');
    finishedPanel.classList.add('hidden');
    panel.classList.remove('hidden');
  }

  async function updateState() {
    const { isCapturing, capturedSteps, flowId, borderColor } = await chrome.storage.local.get(['isCapturing', 'capturedSteps', 'flowId', 'borderColor']);
    
    if (borderColor) {
      borderColorInput.value = borderColor;
      updateActivePreset(borderColor);
    }
    
    if (isCapturing) {
      showPanel(capturingPanel);
      stepCount.textContent = (capturedSteps || []).length;
    } else if (flowId) {
      showPanel(finishedPanel);
      finalStepCount.textContent = (capturedSteps || []).length;
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

  async function showTabSelector() {
    const tabs = await chrome.tabs.query({});
    tabList.innerHTML = '';
    
    tabs.forEach(tab => {
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        return;
      }
      
      const tabCard = document.createElement('div');
      tabCard.className = 'tab-card';
      tabCard.dataset.testid = `tab-card-${tab.id}`;
      
      let hostname = '';
      try {
        hostname = new URL(tab.url).hostname;
      } catch (e) {
        hostname = tab.url;
      }
      
      tabCard.innerHTML = `
        <img src="${tab.favIconUrl || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23999%22><rect width=%2224%22 height=%2224%22 rx=%224%22/></svg>'}" class="tab-favicon" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23999%22><rect width=%2224%22 height=%2224%22 rx=%224%22/></svg>'">
        <div class="tab-info">
          <div class="tab-title">${escapeHtml(tab.title || 'Untitled')}</div>
          <div class="tab-url">${escapeHtml(hostname)}</div>
        </div>
      `;
      tabCard.onclick = () => selectTab(tab.id);
      tabList.appendChild(tabCard);
    });
    
    tabSelectorModal.classList.remove('hidden');
  }

  async function selectTab(tabId) {
    tabSelectorModal.classList.add('hidden');
    
    await chrome.tabs.update(tabId, { active: true });
    
    await chrome.storage.local.set({
      isCapturing: true,
      capturedSteps: [],
      flowId: null,
      currentTabId: tabId
    });
    
    try {
      await chrome.sidePanel.open({ tabId: tabId });
    } catch (e) {
      console.log('Side panel open error:', e);
    }
    
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'startCapture' });
    } catch (e) {
      console.log('Could not send start message, injecting content script');
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['src/content.js']
      });
      await new Promise(resolve => setTimeout(resolve, 100));
      await chrome.tabs.sendMessage(tabId, { action: 'startCapture' });
    }
    
    chrome.runtime.sendMessage({ type: 'START_CAPTURE', tabId });
    
    window.close();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  startBtn.addEventListener('click', async () => {
    await showTabSelector();
  });

  cancelTabSelectBtn.addEventListener('click', () => {
    tabSelectorModal.classList.add('hidden');
  });

  stopBtn.addEventListener('click', async () => {
    const { currentTabId } = await chrome.storage.local.get(['currentTabId']);
    
    if (currentTabId) {
      try {
        await chrome.tabs.sendMessage(currentTabId, { action: 'stopCapture' });
      } catch (e) {
        console.log('Could not send stop message');
      }
    }
    
    await chrome.storage.local.set({ isCapturing: false });
    chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });
    
    const { capturedSteps } = await chrome.storage.local.get(['capturedSteps']);
    finalStepCount.textContent = (capturedSteps || []).length;
    showPanel(finishedPanel);
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

  viewBtn.addEventListener('click', async () => {
    const { flowId } = await chrome.storage.local.get(['flowId']);
    const baseUrl = await getDashboardUrl();
    if (flowId) {
      chrome.tabs.create({ url: `${baseUrl}/flows/${flowId}/edit` });
    } else {
      chrome.tabs.create({ url: `${baseUrl}/dashboard` });
    }
  });

  newBtn.addEventListener('click', async () => {
    await chrome.storage.local.set({ capturedSteps: [], flowId: null, isCapturing: false });
    showPanel(notRecordingPanel);
  });

  openDashboard.addEventListener('click', async (e) => {
    e.preventDefault();
    const url = await getDashboardUrl();
    chrome.tabs.create({ url: `${url}/dashboard` });
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
    if (changes.capturedSteps) {
      stepCount.textContent = (changes.capturedSteps.newValue || []).length;
    }
  });

  await updateState();
});
