const State = {
  isCapturing: false,
  isPaused: false,
  steps: [],
  guideId: null,
  workspaceId: null,
  apiBaseUrl: '',
  activeTabId: null
};

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[FlowCapture] Installed:', details.reason);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch(err => {
    console.error('[FlowCapture] Error:', err);
    sendResponse({ error: err.message });
  });
  return true;
});

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  handleExternalMessage(message, sender).then(sendResponse).catch(err => {
    console.error('[FlowCapture] External error:', err);
    sendResponse({ error: err.message });
  });
  return true;
});

async function handleMessage(message, sender) {
  const { type, data } = message;

  switch (type) {
    case 'START_CAPTURE':
      return await startCapture(data);
    
    case 'STOP_CAPTURE':
      return await stopCapture();
    
    case 'PAUSE_CAPTURE':
      State.isPaused = true;
      return { success: true };
    
    case 'RESUME_CAPTURE':
      State.isPaused = false;
      return { success: true };
    
    case 'STEP_CAPTURED':
      return await handleStepCaptured(data);
    
    case 'SCREENSHOT_REQUEST':
      return await captureScreenshot();
    
    case 'GET_STATE':
      return {
        isCapturing: State.isCapturing,
        isPaused: State.isPaused,
        stepCount: State.steps.length,
        guideId: State.guideId
      };
    
    case 'NAVIGATION':
      console.log('[FlowCapture] Navigation:', data.url);
      return { success: true };
    
    case 'SYNC_STEPS':
      return await syncStepsToServer();
    
    case 'PING':
      return { pong: true };
    
    default:
      return { error: 'Unknown message type' };
  }
}

async function handleExternalMessage(message, sender) {
  const { type, data } = message;
  const origin = sender.origin || sender.url || '';

  switch (type) {
    case 'START_CAPTURE_SESSION':
      State.apiBaseUrl = data?.apiBaseUrl || origin;
      State.guideId = data?.guideId || null;
      State.workspaceId = data?.workspaceId || null;
      
      if (!State.guideId && State.workspaceId && State.apiBaseUrl) {
        try {
          State.guideId = await createGuideOnServer();
        } catch (e) {
          console.error('[FlowCapture] Failed to create guide:', e);
        }
      }
      
      return await startCapture();
    
    case 'STOP_CAPTURE_SESSION':
      return await stopCapture();
    
    case 'GET_CAPTURE_STATUS':
      return {
        isCapturing: State.isCapturing,
        isPaused: State.isPaused,
        stepCount: State.steps.length,
        guideId: State.guideId
      };
    
    case 'PING':
      return { 
        pong: true, 
        version: chrome.runtime.getManifest().version,
        isCapturing: State.isCapturing
      };
    
    default:
      return { error: 'Unknown external message' };
  }
}

async function startCapture(config = {}) {
  const hasPermission = await checkPermissions();
  if (!hasPermission) {
    return { success: false, error: 'Host permissions required' };
  }

  State.isCapturing = true;
  State.isPaused = false;
  State.steps = [];

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    State.activeTabId = tab.id;
    await injectContentScript(tab.id);
    await sendToTab(tab.id, 'START_CAPTURE');
  }

  return { success: true, guideId: State.guideId };
}

async function stopCapture() {
  const steps = [...State.steps];
  const guideId = State.guideId;

  State.isCapturing = false;
  State.isPaused = false;

  await broadcastToAllTabs('STOP_CAPTURE');

  if (steps.length > 0 && State.apiBaseUrl && guideId) {
    try {
      await syncStepsToServer();
    } catch (e) {
      console.error('[FlowCapture] Sync failed:', e);
    }
  }

  return { 
    success: true, 
    stepCount: steps.length,
    guideId,
    steps: steps.map((s, i) => ({
      stepNumber: i + 1,
      action: s.action,
      selector: s.selector,
      url: s.url,
      screenshot: s.screenshot,
      timestamp: s.timestamp
    }))
  };
}

async function handleStepCaptured(stepData) {
  const stepNumber = State.steps.length + 1;
  
  const step = {
    stepNumber,
    action: stepData.action || 'click',
    selector: stepData.selector,
    url: stepData.url,
    screenshot: stepData.screenshot,
    timestamp: stepData.timestamp || Date.now()
  };

  State.steps.push(step);
  console.log('[FlowCapture] Step captured:', stepNumber, step.selector);

  return { success: true, stepCount: State.steps.length };
}

async function captureScreenshot() {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { 
      format: 'png',
      quality: 90
    });
    return { dataUrl };
  } catch (e) {
    console.error('[FlowCapture] Screenshot failed:', e);
    return { error: e.message };
  }
}

async function createGuideOnServer() {
  const response = await fetch(`${State.apiBaseUrl}/api/workspaces/${State.workspaceId}/guides`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      title: 'Untitled Flow',
      description: ''
    })
  });

  if (!response.ok) {
    throw new Error('Failed to create guide');
  }

  const guide = await response.json();
  return guide.id;
}

async function syncStepsToServer() {
  if (!State.apiBaseUrl || !State.guideId || State.steps.length === 0) {
    return { success: false };
  }

  for (let i = 0; i < State.steps.length; i++) {
    const step = State.steps[i];
    
    let imageUrl = null;
    if (step.screenshot) {
      try {
        imageUrl = await uploadScreenshot(step.screenshot);
      } catch (e) {
        console.error('[FlowCapture] Screenshot upload failed:', e);
      }
    }

    const response = await fetch(`${State.apiBaseUrl}/api/guides/${State.guideId}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: `Step ${step.stepNumber}`,
        description: '',
        actionType: step.action,
        selector: step.selector,
        url: step.url,
        imageUrl: imageUrl,
        order: step.stepNumber
      })
    });

    if (!response.ok) {
      console.error('[FlowCapture] Step sync failed:', response.status);
    }
  }

  return { success: true, stepCount: State.steps.length };
}

async function uploadScreenshot(dataUrl) {
  const presignedResponse = await fetch(`${State.apiBaseUrl}/api/uploads/request-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name: `step_${Date.now()}.png`, contentType: 'image/png' })
  });

  if (!presignedResponse.ok) {
    throw new Error('Failed to get upload URL');
  }

  const { uploadURL, objectPath } = await presignedResponse.json();

  const blob = dataUrlToBlob(dataUrl);
  const uploadResponse = await fetch(uploadURL, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': 'image/png' }
  });

  if (!uploadResponse.ok) {
    throw new Error('Upload failed');
  }

  return `/objects/${objectPath}`;
}

function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/:(.*?);/)[1];
  const binary = atob(parts[1]);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

async function checkPermissions() {
  try {
    return await chrome.permissions.contains({ origins: ['<all_urls>'] });
  } catch (e) {
    return false;
  }
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  } catch (e) {
    console.log('[FlowCapture] Injection skipped:', e.message);
  }
}

async function sendToTab(tabId, type, data = {}) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type, data });
  } catch (e) {
    return null;
  }
}

async function broadcastToAllTabs(type, data = {}) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.url?.startsWith('chrome://')) continue;
    sendToTab(tab.id, type, data);
  }
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (State.isCapturing) {
    State.activeTabId = activeInfo.tabId;
    await injectContentScript(activeInfo.tabId);
    await sendToTab(activeInfo.tabId, 'START_CAPTURE');
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (State.isCapturing && changeInfo.status === 'complete') {
    if (!tab.url?.startsWith('chrome://')) {
      await injectContentScript(tabId);
      await sendToTab(tabId, 'START_CAPTURE');
    }
  }
});

console.log('[FlowCapture] Background service worker ready');
