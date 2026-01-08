let isRecording = false;
let activeSessionToken = null;
let activeGuideId = null;

async function getConfiguredApiUrl() {
  try {
    const { apiBaseUrl } = await chrome.storage.local.get(['apiBaseUrl']);
    let url = apiBaseUrl || 'https://flowcapture.replit.app';
    
    // Enforce HTTPS for security (except localhost)
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol === 'http:' && parsedUrl.hostname !== 'localhost' && parsedUrl.hostname !== '127.0.0.1') {
        parsedUrl.protocol = 'https:';
        url = parsedUrl.toString().replace(/\/$/, '');
      }
    } catch (e) {
      return 'https://flowcapture.replit.app';
    }
    
    return url;
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
    borderColor: '#ef4444',
    captureSession: null
  });
});

// Restore session on startup (browser launch)
chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension started, checking for active session');
  await restoreSessionState();
});

// Also restore when service worker wakes up
async function restoreSessionState() {
  try {
    const hasSession = await checkForWebAppSession();
    if (hasSession) {
      console.log('Restored capture session from storage');
      const { isRecording: wasRecording } = await chrome.storage.local.get(['isRecording']);
      if (wasRecording) {
        isRecording = true;
        // Delay to ensure tabs are ready
        setTimeout(() => startRecordingOnAllTabs(), 1000);
      }
    }
  } catch (e) {
    console.error('Failed to restore session:', e);
  }
}

// Run restore on every service worker wake-up
restoreSessionState();

// Check if there's an active session from the web app
async function checkForWebAppSession() {
  try {
    const { captureSession } = await chrome.storage.local.get(['captureSession']);
    if (captureSession && captureSession.token) {
      const now = Date.now();
      const expiresAt = new Date(captureSession.expiresAt).getTime();
      if (now < expiresAt) {
        activeSessionToken = captureSession.token;
        activeGuideId = captureSession.guideId;
        return true;
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

// Send a captured step to the backend in real-time
async function sendStepToBackend(stepData) {
  if (!activeSessionToken) return null;
  
  try {
    const apiUrl = await getConfiguredApiUrl();
    const response = await fetch(`${apiUrl}/api/capture/step`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeSessionToken}`
      },
      body: JSON.stringify({
        title: stepData.description || stepData.type,
        description: stepData.description,
        actionType: stepData.type,
        selector: stepData.selector,
        url: stepData.url || stepData.tabUrl,
        imageData: stepData.screenshot, // Include the screenshot
        metadata: {
          element: stepData.element,
          elementBounds: stepData.elementBounds,
          borderColor: stepData.borderColor,
          isElementCapture: stepData.isElementCapture,
          pageTitle: stepData.pageTitle || stepData.tabTitle
        }
      })
    });
    
    if (!response.ok) {
      console.error('Failed to send step to backend:', response.status);
      // Session might be expired
      if (response.status === 401) {
        console.log('Session expired, stopping recording');
        activeSessionToken = null;
        activeGuideId = null;
        isRecording = false;
        await chrome.storage.local.set({ captureSession: null, isRecording: false });
        notifyAllTabs('STOP_RECORDING');
        // Notify all tabs about session expiry so webapp can update UI
        notifyAllTabsSessionExpired();
      }
      return null;
    }
    
    return response.json();
  } catch (e) {
    console.error('Error sending step to backend:', e);
    return null;
  }
}

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
  } else if (message.type === 'PAUSE_CAPTURE') {
    chrome.storage.local.set({ isPaused: true }).then(() => {
      notifyAllTabs('PAUSE_CAPTURE');
      sendResponse({ success: true });
    });
    return true;
  } else if (message.type === 'RESUME_CAPTURE') {
    chrome.storage.local.set({ isPaused: false }).then(() => {
      notifyAllTabs('RESUME_CAPTURE');
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
  } else if (message.type === 'SET_CAPTURE_SESSION') {
    // Set capture session from web app
    const session = message.session;
    if (session && session.token) {
      activeSessionToken = session.token;
      activeGuideId = session.guideId;
      chrome.storage.local.set({ captureSession: session });
      // Auto-start recording when session is set
      isRecording = true;
      chrome.storage.local.set({ isRecording: true, steps: [] }).then(() => {
        startRecordingOnAllTabs();
      });
    } else {
      activeSessionToken = null;
      activeGuideId = null;
      chrome.storage.local.set({ captureSession: null });
    }
    sendResponse({ success: true });
  } else if (message.type === 'CLEAR_CAPTURE_SESSION') {
    // Clear capture session (stop recording triggered from web app)
    activeSessionToken = null;
    activeGuideId = null;
    isRecording = false;
    chrome.storage.local.set({ captureSession: null, isRecording: false });
    notifyAllTabs('STOP_RECORDING');
    sendResponse({ success: true });
  } else if (message.type === 'GET_CAPTURE_SESSION') {
    sendResponse({
      hasSession: !!activeSessionToken,
      guideId: activeGuideId
    });
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

// Notify webapp tabs about session expiry via postMessage relay
async function notifyAllTabsSessionExpired() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
        await chrome.tabs.sendMessage(tab.id, { type: 'SESSION_EXPIRED' });
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

  // Store locally
  const { steps = [] } = await chrome.storage.local.get(['steps']);
  steps.push(stepWithScreenshot);
  await chrome.storage.local.set({ steps });
  
  console.log('Step captured. Total steps:', steps.length);
  
  // Ensure session is hydrated before sending
  if (!activeSessionToken) {
    await checkForWebAppSession();
  }
  
  // Send to backend if session is active
  if (activeSessionToken) {
    try {
      await sendStepToBackend(stepWithScreenshot);
      console.log('Step sent to backend');
    } catch (e) {
      console.error('Failed to send step to backend:', e);
    }
  }
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

  // Store locally
  const { steps = [] } = await chrome.storage.local.get(['steps']);
  steps.push(stepWithScreenshot);
  await chrome.storage.local.set({ steps });
  
  console.log('Element captured. Total steps:', steps.length);
  
  // Ensure session is hydrated before sending
  if (!activeSessionToken) {
    await checkForWebAppSession();
  }
  
  // Send to backend if session is active
  if (activeSessionToken) {
    try {
      await sendStepToBackend(stepWithScreenshot);
      console.log('Element sent to backend');
    } catch (e) {
      console.error('Failed to send element to backend:', e);
    }
  }
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
