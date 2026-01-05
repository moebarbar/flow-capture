let isRecording = false;

async function getConfiguredApiUrl() {
  try {
    const { apiBaseUrl } = await chrome.storage.local.get(['apiBaseUrl']);
    return apiBaseUrl || 'https://flowcapture.replit.app';
  } catch (e) {
    return 'https://flowcapture.replit.app';
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ 
    isRecording: false, 
    steps: [],
    guideId: null,
    selectedWorkspaceId: null,
    apiBaseUrl: 'https://flowcapture.replit.app',
    borderColor: '#ef4444'
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.type);
  
  if (message.type === 'START_RECORDING') {
    isRecording = true;
    chrome.storage.local.set({ isRecording: true }).then(() => {
      startRecordingOnAllTabs()
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ error: err.message }));
    });
    return true;
  } else if (message.type === 'STOP_RECORDING') {
    isRecording = false;
    chrome.storage.local.set({ isRecording: false }).then(() => {
      notifyAllTabs('STOP_RECORDING');
      sendResponse({ success: true });
    });
    return true;
  } else if (message.type === 'CAPTURE_STEP') {
    handleCaptureStep(message.step, sender.tab)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  } else if (message.type === 'CAPTURE_ELEMENT') {
    handleCaptureElement(message.captureData, sender.tab)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  } else if (message.type === 'START_ELEMENT_CAPTURE') {
    startElementCaptureOnActiveTab()
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  } else if (message.type === 'SET_BORDER_COLOR') {
    chrome.storage.local.set({ borderColor: message.color }).then(() => {
      notifyAllTabsWithColor(message.color);
      sendResponse({ success: true });
    });
    return true;
  } else if (message.type === 'GET_RECORDING_STATE') {
    sendResponse({ isRecording });
  } else if (message.type === 'SYNC_TO_BACKEND') {
    syncStepsToBackend(message.workspaceId, message.title)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  } else if (message.type === 'GET_WORKSPACES') {
    fetchWorkspaces()
      .then(workspaces => sendResponse({ workspaces }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  } else if (message.type === 'GET_USER') {
    fetchUser()
      .then(user => sendResponse({ user }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  } else if (message.type === 'SET_API_URL') {
    chrome.storage.local.set({ apiBaseUrl: message.url });
    sendResponse({ success: true });
  } else if (message.type === 'ELEMENT_CAPTURE_CANCELLED') {
    sendResponse({ success: true });
  } else if (message.type === 'CAPTURE_PAGE_SCREENSHOT') {
    // Capture screenshot for Screenshot Studio
    capturePageScreenshot(sender.tab)
      .then(screenshot => sendResponse({ screenshot }))
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
  return true;
});

async function capturePageScreenshot(tab) {
  try {
    const screenshot = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    return screenshot;
  } catch (e) {
    console.error('Failed to capture screenshot:', e);
    throw e;
  }
}

async function startElementCaptureOnActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'START_ELEMENT_CAPTURE' });
    } catch (e) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['src/content.js']
      });
      await chrome.tabs.sendMessage(tab.id, { type: 'START_ELEMENT_CAPTURE' });
    }
  }
}

async function notifyAllTabsWithColor(color) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
        await chrome.tabs.sendMessage(tab.id, { type: 'SET_BORDER_COLOR', color });
      }
    } catch (e) {
    }
  }
}

async function startRecordingOnAllTabs() {
  const tabs = await chrome.tabs.query({});
  
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:')) continue;
    
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'START_RECORDING' });
    } catch (e) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/content.js']
        });
        await chrome.tabs.sendMessage(tab.id, { type: 'START_RECORDING' });
      } catch (injectError) {
        console.log('Could not inject into tab:', tab.url, injectError.message);
      }
    }
  }
}

async function notifyAllTabs(type) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
        await chrome.tabs.sendMessage(tab.id, { type });
      }
    } catch (e) {
    }
  }
}

async function handleCaptureStep(step, tab) {
  console.log('Capturing step:', step.type, step.description);
  
  let screenshot = null;
  
  if (tab && tab.windowId) {
    try {
      screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    } catch (e) {
      console.error('Screenshot capture failed:', e);
    }
  }

  const stepWithScreenshot = {
    ...step,
    screenshot,
    timestamp: Date.now(),
    tabId: tab?.id,
    tabUrl: tab?.url,
    tabTitle: tab?.title
  };

  const { steps = [] } = await chrome.storage.local.get(['steps']);
  steps.push(stepWithScreenshot);
  await chrome.storage.local.set({ steps });
  
  console.log('Step captured. Total steps:', steps.length);
}

async function handleCaptureElement(captureData, tab) {
  console.log('Capturing element:', captureData.description);
  
  let screenshot = null;
  
  if (tab && tab.windowId) {
    try {
      screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    } catch (e) {
      console.error('Screenshot capture failed:', e);
    }
  }

  const stepWithScreenshot = {
    ...captureData,
    screenshot,
    timestamp: Date.now(),
    tabId: tab?.id,
    tabUrl: tab?.url,
    tabTitle: tab?.title,
    isElementCapture: true
  };

  const { steps = [] } = await chrome.storage.local.get(['steps']);
  steps.push(stepWithScreenshot);
  await chrome.storage.local.set({ steps });
  
  console.log('Element captured. Total steps:', steps.length);
}

async function fetchUser() {
  const apiUrl = await getConfiguredApiUrl();
  const response = await fetch(`${apiUrl}/api/extension/user`, {
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error('Not authenticated');
  }
  
  return response.json();
}

async function fetchWorkspaces() {
  const apiUrl = await getConfiguredApiUrl();
  const response = await fetch(`${apiUrl}/api/extension/workspaces`, {
    credentials: 'include'
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch workspaces');
  }
  
  return response.json();
}

async function syncStepsToBackend(workspaceId, title) {
  const { steps = [] } = await chrome.storage.local.get(['steps']);
  
  if (steps.length === 0) {
    return { error: 'No steps to sync' };
  }

  const formattedSteps = steps.map(step => ({
    type: step.type,
    description: step.description,
    selector: step.selector,
    url: step.url || step.tabUrl,
    pageTitle: step.pageTitle || step.tabTitle,
    screenshot: step.screenshot,
    timestamp: step.timestamp,
    element: step.element,
    elementBounds: step.elementBounds || null,
    borderColor: step.borderColor || null,
    isElementCapture: step.isElementCapture || false
  }));

  const apiUrl = await getConfiguredApiUrl();
  const response = await fetch(`${apiUrl}/api/extension/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      workspaceId,
      title,
      steps: formattedSteps
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to sync');
  }

  const result = await response.json();
  
  await chrome.storage.local.set({ 
    guideId: result.guideId,
    steps: []
  });

  return result;
}

chrome.action.onClicked.addListener(async (tab) => {
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && isRecording && tab.url && !tab.url.startsWith('chrome://')) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING' });
    } catch (e) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['src/content.js']
        });
        await chrome.tabs.sendMessage(tabId, { type: 'START_RECORDING' });
      } catch (injectError) {
        console.log('Could not inject into new tab:', tab.url);
      }
    }
  }
});
