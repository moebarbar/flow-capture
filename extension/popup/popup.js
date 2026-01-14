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
      // First check if we already have the permission for all URLs
      let hasAllUrlsPermission = await chrome.permissions.contains({ origins: ['<all_urls>'] });
      
      if (hasAllUrlsPermission) {
        console.log('[FlowCapture] Already has <all_urls> permission');
        return true;
      }
      
      // Ask user for confirmation before requesting permissions
      const userConfirmed = confirm(
        'FlowCapture needs permission to capture on websites.\n\n' +
        'Click OK to grant permission, or Cancel to skip.'
      );
      
      if (!userConfirmed) {
        console.log('[FlowCapture] User declined permission prompt');
        return false;
      }
      
      // Try to request permission - this must be called from a user gesture context
      console.log('[FlowCapture] Requesting <all_urls> permission...');
      try {
        const granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
        console.log('[FlowCapture] Permission request result:', granted);
        
        if (granted) {
          // Verify the permission was actually granted with a small delay
          await new Promise(resolve => setTimeout(resolve, 200));
          hasAllUrlsPermission = await chrome.permissions.contains({ origins: ['<all_urls>'] });
          console.log('[FlowCapture] Permission verification after delay:', hasAllUrlsPermission);
          return hasAllUrlsPermission;
        }
      } catch (requestError) {
        console.error('[FlowCapture] Permission request failed:', requestError);
      }
      
      // Permission not granted
      console.log('[FlowCapture] Permission not granted');
      return false;
    } catch (e) {
      console.error('[FlowCapture] Permission check failed:', e);
      return false;
    }
  }

  async function showTabSelector() {
    const hasPermission = await checkAndRequestPermissions();
    if (!hasPermission) {
      alert(
        'FlowCapture needs permission to capture on all websites.\n\n' +
        'To grant permission manually:\n' +
        '1. Right-click the FlowCapture extension icon\n' +
        '2. Click "Manage extension"\n' +
        '3. Go to "Site access"\n' +
        '4. Select "On all sites"\n\n' +
        'Then try again.'
      );
      return;
    }

    tabList.innerHTML = '<div class="tab-loading">Loading tabs...</div>';
    tabSelectorModal.classList.remove('hidden');
    
    try {
      const result = await chrome.runtime.sendMessage({ type: 'GET_AVAILABLE_TABS' });
      
      if (result?.error) {
        tabList.innerHTML = `<div class="tab-error">Error: ${escapeHtml(result.error)}</div>`;
        return;
      }
      
      if (!result?.tabs || result.tabs.length === 0) {
        tabList.innerHTML = '<div class="tab-empty">No available tabs found. Open a website first.</div>';
        return;
      }
      
      tabList.innerHTML = '';
      
      result.tabs.forEach(tab => {
        const tabItem = document.createElement('div');
        tabItem.className = 'tab-item';
        tabItem.dataset.tabId = tab.id;
        tabItem.dataset.testid = `tab-item-${tab.id}`;
        
        const favicon = tab.favIconUrl 
          ? `<img src="${escapeHtml(tab.favIconUrl)}" class="tab-favicon" onerror="this.style.display='none'"/>`
          : '<div class="tab-favicon-placeholder"></div>';
        
        tabItem.innerHTML = `
          ${favicon}
          <div class="tab-info">
            <div class="tab-title">${escapeHtml(tab.title)}</div>
            <div class="tab-description">${escapeHtml(tab.description || new URL(tab.url).hostname)}</div>
          </div>
          ${tab.active ? '<span class="tab-active-badge">Active</span>' : ''}
        `;
        
        tabItem.addEventListener('click', () => selectTabAndStartCapture(tab.id));
        tabList.appendChild(tabItem);
      });
    } catch (e) {
      tabList.innerHTML = `<div class="tab-error">Failed to load tabs: ${escapeHtml(e.message)}</div>`;
    }
  }
  
  async function selectTabAndStartCapture(tabId) {
    const highlightColor = borderColorInput.value;
    await chrome.storage.local.set({ highlightColor });
    
    tabList.innerHTML = '<div class="tab-loading">Starting capture...</div>';
    
    try {
      const result = await chrome.runtime.sendMessage({ 
        type: 'SELECT_TAB_AND_START_CAPTURE',
        data: { tabId, highlightColor }
      });

      if (result?.success) {
        tabSelectorModal.classList.add('hidden');
        showPanel(capturingPanel);
        stepCount.textContent = '0';
        updatePauseResumeUI(false);
        window.close();
      } else {
        tabList.innerHTML = `<div class="tab-error">Failed to start capture: ${escapeHtml(result?.error || 'Unknown error')}</div>`;
      }
    } catch (e) {
      tabList.innerHTML = `<div class="tab-error">Error: ${escapeHtml(e.message)}</div>`;
    }
  }

  async function startCapture() {
    await showTabSelector();
  }

  async function stopCapture() {
    const result = await chrome.runtime.sendMessage({ 
      type: 'STOP_CAPTURE'
    });

    if (result?.success) {
      lastCaptureResult = result;
      
      // Background service-worker handles the redirect automatically
      // Just close the popup for a clean experience
      if (result.guideId) {
        // Background already redirected user to editor - just close popup
        window.close();
        return;
      }
      
      // Fallback: show finished panel if no guideId (should be rare)
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
    // Try machine state first (most reliable source after capture)
    const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    let apiBaseUrl = state?.apiBaseUrl || '';
    
    // Fallback to settings
    if (!apiBaseUrl) {
      const settings = await chrome.storage.local.get(['apiBaseUrl', 'flowcapture_session']);
      apiBaseUrl = settings.apiBaseUrl || '';
      
      // Fallback to session apiBaseUrl (stored as object, not string)
      if (!apiBaseUrl && settings.flowcapture_session) {
        const session = settings.flowcapture_session;
        if (typeof session === 'object' && session.apiBaseUrl) {
          apiBaseUrl = session.apiBaseUrl;
        }
      }
    }
    
    if (apiBaseUrl && lastCaptureResult?.guideId) {
      // Open the editor directly
      chrome.tabs.create({ url: `${apiBaseUrl}/guides/${lastCaptureResult.guideId}/edit` });
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
    // Try machine state first (most reliable source)
    const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
    let apiBaseUrl = state?.apiBaseUrl || '';
    
    // Fallback to settings
    if (!apiBaseUrl) {
      const settings = await chrome.storage.local.get(['apiBaseUrl', 'flowcapture_session']);
      apiBaseUrl = settings.apiBaseUrl || '';
      
      // Fallback to session apiBaseUrl (stored as object, not string)
      if (!apiBaseUrl && settings.flowcapture_session) {
        const session = settings.flowcapture_session;
        if (typeof session === 'object' && session.apiBaseUrl) {
          apiBaseUrl = session.apiBaseUrl;
        }
      }
    }
    
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
