const CaptureState = {
  isCapturing: false,
  isPaused: false,
  guideId: null,
  workspaceId: null,
  steps: [],
  config: {
    highlightColor: '#ef4444',
    apiBaseUrl: ''
  },
  sessionToken: null,
  activeTabId: null
};

const API_ENDPOINTS = {
  presignedUrl: '/api/uploads/request-url',
  createGuide: (workspaceId) => `/api/workspaces/${workspaceId}/guides`,
  addStep: (guideId) => `/api/guides/${guideId}/steps`,
  workspaces: '/api/workspaces'
};

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[FlowCapture] Extension ${details.reason}: v${chrome.runtime.getManifest().version}`);
  
  if (details.reason === 'install') {
    await chrome.storage.local.set({
      apiBaseUrl: '',
      highlightColor: '#ef4444',
      captureState: null
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse).catch(err => {
    console.error('[FlowCapture] Message handler error:', err);
    sendResponse({ error: err.message });
  });
  return true;
});

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  handleExternalMessage(message, sender).then(sendResponse).catch(err => {
    console.error('[FlowCapture] External message error:', err);
    sendResponse({ error: err.message });
  });
  return true;
});

async function handleMessage(message, sender) {
  const { type, data } = message;

  switch (type) {
    case 'GET_CAPTURE_STATE':
      return {
        isCapturing: CaptureState.isCapturing,
        isPaused: CaptureState.isPaused,
        config: CaptureState.config,
        stepCount: CaptureState.steps.length
      };

    case 'START_CAPTURE':
      return await startCapture(data);

    case 'STOP_CAPTURE':
      return await stopCapture(data?.cancelled);

    case 'PAUSE_CAPTURE':
      CaptureState.isPaused = true;
      await broadcastState();
      return { success: true };

    case 'RESUME_CAPTURE':
      CaptureState.isPaused = false;
      await broadcastState();
      return { success: true };

    case 'STEP_CAPTURED':
      return await handleStepCaptured(data);

    case 'DELETE_STEP':
      CaptureState.steps.splice(data.index, 1);
      return { success: true };

    case 'SCREENSHOT_REQUEST':
      return await captureScreenshot(sender.tab?.id);

    case 'GET_SETTINGS':
      const settings = await chrome.storage.local.get(['apiBaseUrl', 'highlightColor']);
      return settings;

    case 'SAVE_SETTINGS':
      await chrome.storage.local.set(data);
      CaptureState.config = { ...CaptureState.config, ...data };
      return { success: true };

    case 'CHECK_PERMISSIONS':
      return await checkHostPermissions();

    case 'REQUEST_PERMISSIONS':
      return await requestHostPermissions();

    case 'SYNC_TO_SERVER':
      return await syncToServer(data);

    case 'GET_WORKSPACES':
      return await fetchWorkspaces();

    case 'PING':
      return { pong: true };

    default:
      console.warn('[FlowCapture] Unknown message type:', type);
      return { error: 'Unknown message type' };
  }
}

async function handleExternalMessage(message, sender) {
  const { type, data } = message;
  
  const origin = sender.origin || sender.url;
  console.log('[FlowCapture] External message from:', origin, type);

  switch (type) {
    case 'START_CAPTURE_SESSION':
      CaptureState.config.apiBaseUrl = data.apiBaseUrl || origin;
      CaptureState.guideId = data.guideId;
      CaptureState.workspaceId = data.workspaceId;
      CaptureState.sessionToken = data.sessionToken;
      
      return await startCapture({
        guideId: data.guideId,
        workspaceId: data.workspaceId,
        highlightColor: data.highlightColor
      });

    case 'STOP_CAPTURE_SESSION':
      return await stopCapture(false);

    case 'GET_CAPTURE_STATUS':
      return {
        isCapturing: CaptureState.isCapturing,
        isPaused: CaptureState.isPaused,
        stepCount: CaptureState.steps.length,
        guideId: CaptureState.guideId
      };

    case 'PING':
      return { 
        pong: true, 
        version: chrome.runtime.getManifest().version,
        isCapturing: CaptureState.isCapturing
      };

    default:
      return { error: 'Unknown external message type' };
  }
}

async function startCapture(data = {}) {
  const hasPermission = await checkHostPermissions();
  if (!hasPermission) {
    return { 
      success: false, 
      error: 'permissions_required',
      message: 'Host permissions required. Please grant access to capture on all sites.'
    };
  }

  CaptureState.isCapturing = true;
  CaptureState.isPaused = false;
  CaptureState.steps = [];
  
  if (data.guideId) CaptureState.guideId = data.guideId;
  if (data.workspaceId) CaptureState.workspaceId = data.workspaceId;
  if (data.highlightColor) CaptureState.config.highlightColor = data.highlightColor;

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab) {
    CaptureState.activeTabId = activeTab.id;
    await injectContentScript(activeTab.id);
    await chrome.tabs.sendMessage(activeTab.id, { 
      type: 'START_CAPTURE', 
      data: CaptureState.config 
    }).catch(() => {});
  }

  await broadcastState();
  
  return { success: true, guideId: CaptureState.guideId };
}

async function stopCapture(cancelled = false) {
  const steps = [...CaptureState.steps];
  const guideId = CaptureState.guideId;

  CaptureState.isCapturing = false;
  CaptureState.isPaused = false;

  await broadcastToAllTabs({ type: 'STOP_CAPTURE' });

  if (!cancelled && steps.length > 0 && CaptureState.config.apiBaseUrl) {
    try {
      await syncStepsToServer(steps, guideId);
    } catch (e) {
      console.error('[FlowCapture] Failed to sync steps:', e);
    }
  }

  const result = {
    success: true,
    cancelled,
    stepCount: steps.length,
    guideId,
    steps: cancelled ? [] : steps
  };

  CaptureState.steps = [];
  CaptureState.guideId = null;

  return result;
}

async function handleStepCaptured(stepData) {
  let screenshotUrl = null;

  if (stepData.screenshot && CaptureState.config.apiBaseUrl) {
    try {
      screenshotUrl = await uploadScreenshot(stepData.screenshot);
    } catch (e) {
      console.error('[FlowCapture] Screenshot upload failed:', e);
    }
  }

  const step = {
    ...stepData,
    screenshot: screenshotUrl || stepData.screenshot,
    order: CaptureState.steps.length + 1
  };

  CaptureState.steps.push(step);

  if (CaptureState.guideId && CaptureState.config.apiBaseUrl) {
    try {
      await sendStepToServer(step);
    } catch (e) {
      console.error('[FlowCapture] Failed to send step to server:', e);
    }
  }

  return { success: true, stepCount: CaptureState.steps.length };
}

async function captureScreenshot(tabId) {
  try {
    const targetTabId = tabId || CaptureState.activeTabId;
    if (!targetTabId) {
      throw new Error('No active tab');
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(null, { 
      format: 'png',
      quality: 90
    });

    return { dataUrl };
  } catch (e) {
    console.error('[FlowCapture] Screenshot capture failed:', e);
    return { error: e.message };
  }
}

async function uploadScreenshot(dataUrl) {
  const apiBaseUrl = CaptureState.config.apiBaseUrl;
  if (!apiBaseUrl) return null;

  try {
    const presignedResponse = await fetch(`${apiBaseUrl}/api/uploads/request-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ 
        name: `step_${Date.now()}.png`,
        contentType: 'image/png'
      })
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
      throw new Error('Failed to upload screenshot');
    }

    return `/objects/${objectPath}`;
  } catch (e) {
    console.error('[FlowCapture] Upload failed:', e);
    return null;
  }
}

async function sendStepToServer(step) {
  const apiBaseUrl = CaptureState.config.apiBaseUrl;
  const guideId = CaptureState.guideId;
  
  if (!apiBaseUrl || !guideId) return;

  const response = await fetch(`${apiBaseUrl}/api/guides/${guideId}/steps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      title: step.title,
      description: step.description,
      actionType: step.actionType,
      selector: step.selector,
      url: step.url,
      imageUrl: step.screenshot,
      order: step.order,
      metadata: {
        xpath: step.xpath,
        pageTitle: step.pageTitle,
        bounds: step.bounds
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to save step: ${response.status}`);
  }

  return await response.json();
}

async function syncStepsToServer(steps, guideId) {
  for (const step of steps) {
    if (!step.synced) {
      await sendStepToServer(step);
      step.synced = true;
    }
  }
}

async function syncToServer(data) {
  const { guideId, workspaceId } = data;
  CaptureState.guideId = guideId;
  CaptureState.workspaceId = workspaceId;

  try {
    await syncStepsToServer(CaptureState.steps, guideId);
    return { success: true, stepCount: CaptureState.steps.length };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function fetchWorkspaces() {
  const apiBaseUrl = CaptureState.config.apiBaseUrl;
  if (!apiBaseUrl) {
    return { error: 'API URL not configured' };
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/workspaces`, {
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error('Failed to fetch workspaces');
    }

    const workspaces = await response.json();
    return { workspaces };
  } catch (e) {
    return { error: e.message };
  }
}

async function checkHostPermissions() {
  try {
    const result = await chrome.permissions.contains({
      origins: ['<all_urls>']
    });
    return result;
  } catch (e) {
    console.error('[FlowCapture] Permission check failed:', e);
    return false;
  }
}

async function requestHostPermissions() {
  try {
    const granted = await chrome.permissions.request({
      origins: ['<all_urls>']
    });
    return { granted };
  } catch (e) {
    console.error('[FlowCapture] Permission request failed:', e);
    return { granted: false, error: e.message };
  }
}

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/contentScript.js']
    });
    
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['src/styles.css']
    });
  } catch (e) {
    console.log('[FlowCapture] Script injection skipped:', e.message);
  }
}

async function broadcastState() {
  const state = {
    isCapturing: CaptureState.isCapturing,
    isPaused: CaptureState.isPaused,
    stepCount: CaptureState.steps.length,
    config: CaptureState.config
  };

  await broadcastToAllTabs({ type: 'CAPTURE_STATE_CHANGED', data: state });
}

async function broadcastToAllTabs(message) {
  const tabs = await chrome.tabs.query({});
  
  for (const tab of tabs) {
    if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
      continue;
    }
    
    try {
      await chrome.tabs.sendMessage(tab.id, message);
    } catch (e) {
    }
  }
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

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (CaptureState.isCapturing) {
    CaptureState.activeTabId = activeInfo.tabId;
    
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && !tab.url.startsWith('chrome://')) {
      await injectContentScript(activeInfo.tabId);
      await chrome.tabs.sendMessage(activeInfo.tabId, {
        type: 'START_CAPTURE',
        data: CaptureState.config
      }).catch(() => {});
    }
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (CaptureState.isCapturing && changeInfo.status === 'complete') {
    if (tab.url && !tab.url.startsWith('chrome://')) {
      await injectContentScript(tabId);
      await chrome.tabs.sendMessage(tabId, {
        type: 'START_CAPTURE',
        data: CaptureState.config
      }).catch(() => {});
    }
  }
});

console.log('[FlowCapture] Background service worker initialized');
