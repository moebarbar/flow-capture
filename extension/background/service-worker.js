/**
 * FlowCapture Background Service Worker
 * Central orchestrator with finite state machine for capture lifecycle
 */

import { MessageTypes, PortNames, CaptureStates, WebAppMessageTypes } from '../shared/messages.js';
import { saveSession, clearSession, savePendingSteps, getPendingSteps } from '../shared/storage.js';

class CaptureStateMachine {
  constructor() {
    this.state = {
      status: CaptureStates.IDLE,
      guideId: null,
      workspaceId: null,
      apiBaseUrl: '',
      activeTabId: null,
      steps: [],
      stepCounter: 0,
      captureToken: null,
      expiresAt: null,
      panelOpen: true
    };
    
    this.ports = new Map();
    this.tabContexts = new Map();
    this.pendingScreenshots = new Map();
  }

  transition(newStatus) {
    const oldStatus = this.state.status;
    this.state.status = newStatus;
    console.log(`[FlowCapture] State: ${oldStatus} -> ${newStatus}`);
    this.broadcastStateUpdate();
  }

  canTransition(from, to) {
    const transitions = {
      [CaptureStates.IDLE]: [CaptureStates.CAPTURING],
      [CaptureStates.CAPTURING]: [CaptureStates.PAUSED, CaptureStates.SYNCING, CaptureStates.IDLE],
      [CaptureStates.PAUSED]: [CaptureStates.CAPTURING, CaptureStates.IDLE],
      [CaptureStates.SYNCING]: [CaptureStates.IDLE]
    };
    return transitions[from]?.includes(to) ?? false;
  }

  getState() {
    return {
      status: this.state.status,
      isCapturing: this.state.status === CaptureStates.CAPTURING,
      isPaused: this.state.status === CaptureStates.PAUSED,
      stepCount: this.state.steps.length,
      guideId: this.state.guideId,
      workspaceId: this.state.workspaceId,
      panelOpen: this.state.panelOpen
    };
  }

  reset() {
    this.state.steps = [];
    this.state.stepCounter = 0;
    this.state.guideId = null;
    this.state.workspaceId = null;
    this.state.activeTabId = null;
    this.tabContexts.clear();
  }

  broadcastStateUpdate() {
    const state = this.getState();
    this.ports.forEach((port) => {
      try {
        port.postMessage({ type: MessageTypes.STATE_UPDATE, data: state });
      } catch {}
    });
  }

  addStep(step) {
    this.state.stepCounter++;
    step.id = this.state.stepCounter;
    step.order = this.state.stepCounter;
    step.syncStatus = 'pending';
    this.state.steps.push(step);
    return step;
  }
}

const machine = new CaptureStateMachine();

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[FlowCapture] Installed:', details.reason);
});

chrome.commands.onCommand.addListener(async (command) => {
  console.log('[FlowCapture] Command received:', command);
  
  if (command === 'toggle-capture') {
    const state = machine.getState();
    
    if (state.isCapturing) {
      await handleStopCapture();
    } else {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id) {
        await handleStartCapture({ tabId: activeTab.id });
      }
    }
  }
});

chrome.runtime.onConnect.addListener((port) => {
  console.log('[FlowCapture] Port connected:', port.name);
  machine.ports.set(port.name + '_' + (port.sender?.tab?.id || 'popup'), port);
  
  port.onMessage.addListener((message) => handlePortMessage(port, message));
  port.onDisconnect.addListener(() => {
    const key = port.name + '_' + (port.sender?.tab?.id || 'popup');
    machine.ports.delete(key);
    console.log('[FlowCapture] Port disconnected:', port.name);
  });
  
  port.postMessage({ type: MessageTypes.STATE_UPDATE, data: machine.getState() });
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

async function handlePortMessage(port, message) {
  const { type, data, requestId } = message;
  let response;
  
  try {
    switch (type) {
      case MessageTypes.STEP_CAPTURED:
        response = await handleStepCaptured(data, port.sender?.tab?.id);
        break;
      case MessageTypes.READY_FOR_CAPTURE:
        response = await handleReadyForCapture(data, port.sender?.tab?.id);
        break;
      case MessageTypes.GET_STATE:
        response = machine.getState();
        break;
      default:
        response = await handleMessage({ type, data }, port.sender);
    }
  } catch (err) {
    response = { error: err.message };
  }
  
  if (requestId) {
    port.postMessage({ type: `${type}_RESPONSE`, data: response, requestId });
  }
}

async function handleMessage(message, sender) {
  const { type, data } = message;

  switch (type) {
    case MessageTypes.START_CAPTURE:
      return await startCapture(data);
    
    case MessageTypes.STOP_CAPTURE:
      return await stopCapture();
    
    case MessageTypes.PAUSE_CAPTURE:
      if (machine.canTransition(machine.state.status, CaptureStates.PAUSED)) {
        machine.transition(CaptureStates.PAUSED);
        await broadcastToAllTabs(MessageTypes.PAUSE_CAPTURE);
      }
      return { success: true };
    
    case MessageTypes.RESUME_CAPTURE:
      if (machine.canTransition(machine.state.status, CaptureStates.CAPTURING)) {
        machine.transition(CaptureStates.CAPTURING);
        await broadcastToAllTabs(MessageTypes.RESUME_CAPTURE);
      }
      return { success: true };
    
    case MessageTypes.STEP_CAPTURED:
      return await handleStepCaptured(data, sender?.tab?.id);
    
    case MessageTypes.SCREENSHOT_REQUEST:
      return await captureScreenshot(sender?.tab?.id);
    
    case MessageTypes.GET_STATE:
      return machine.getState();
    
    case MessageTypes.NAVIGATION:
      console.log('[FlowCapture] Navigation:', data?.url);
      return { success: true };
    
    case MessageTypes.SYNC_STEPS:
      return await syncStepsToServer();
    
    case MessageTypes.PING:
      return { pong: true };
    
    case 'PANEL_STATE_CHANGED':
      machine.state.panelOpen = data?.isOpen ?? true;
      return { success: true };
    
    case 'TOGGLE_PANEL':
      machine.state.panelOpen = !machine.state.panelOpen;
      await broadcastToAllTabs('TOGGLE_PANEL');
      return { success: true, isOpen: machine.state.panelOpen };
    
    case MessageTypes.REQUEST_PERMISSIONS:
      try {
        const granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
        return { granted };
      } catch (e) {
        return { granted: false, error: e.message };
      }
    
    case MessageTypes.CHECK_PERMISSIONS:
      try {
        const hasPermission = await chrome.permissions.contains({ origins: ['<all_urls>'] });
        return { hasPermission };
      } catch {
        return { hasPermission: false };
      }
    
    case MessageTypes.SET_SESSION:
      if (message.session) {
        machine.state.captureToken = message.session.token;
        machine.state.guideId = message.session.guideId;
        machine.state.expiresAt = message.session.expiresAt;
        machine.state.apiBaseUrl = message.session.apiBaseUrl || machine.state.apiBaseUrl;
        await saveSession(message.session);
        console.log('[FlowCapture] Session set:', { guideId: machine.state.guideId });
        return { success: true };
      }
      return { success: false, error: 'No session provided' };
    
    case MessageTypes.CLEAR_SESSION:
      machine.state.captureToken = null;
      machine.state.guideId = null;
      machine.state.expiresAt = null;
      await clearSession();
      console.log('[FlowCapture] Session cleared');
      return { success: true };
    
    default:
      return { error: 'Unknown message type' };
  }
}

async function handleExternalMessage(message, sender) {
  const { type, data } = message;
  const origin = sender.origin || sender.url || '';

  switch (type) {
    case 'START_CAPTURE_SESSION':
      machine.state.apiBaseUrl = data?.apiBaseUrl || origin;
      machine.state.guideId = data?.guideId || null;
      machine.state.workspaceId = data?.workspaceId || null;
      
      if (!machine.state.guideId && machine.state.workspaceId && machine.state.apiBaseUrl) {
        try {
          machine.state.guideId = await createGuideOnServer();
        } catch (e) {
          console.error('[FlowCapture] Failed to create guide:', e);
        }
      }
      
      return await startCapture();
    
    case 'STOP_CAPTURE_SESSION':
      return await stopCapture();
    
    case 'GET_CAPTURE_STATUS':
      return machine.getState();
    
    case 'PING':
      return { 
        pong: true, 
        version: chrome.runtime.getManifest().version,
        ...machine.getState()
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

  if (!machine.canTransition(machine.state.status, CaptureStates.CAPTURING) && 
      machine.state.status !== CaptureStates.IDLE) {
    return { success: false, error: 'Invalid state transition' };
  }

  machine.state.steps = [];
  machine.state.stepCounter = 0;
  machine.transition(CaptureStates.CAPTURING);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    machine.state.activeTabId = tab.id;
    await injectContentScripts(tab.id);
    await sendToTab(tab.id, MessageTypes.START_CAPTURE);
  }

  return { success: true, guideId: machine.state.guideId };
}

async function stopCapture() {
  const steps = [...machine.state.steps];
  const guideId = machine.state.guideId;

  if (machine.canTransition(machine.state.status, CaptureStates.SYNCING)) {
    machine.transition(CaptureStates.SYNCING);
  }

  await broadcastToAllTabs(MessageTypes.STOP_CAPTURE);

  if (steps.length > 0 && machine.state.apiBaseUrl && guideId) {
    try {
      await syncStepsToServer();
    } catch (e) {
      console.error('[FlowCapture] Sync failed:', e);
    }
  }

  machine.transition(CaptureStates.IDLE);

  return { 
    success: true, 
    stepCount: steps.length,
    guideId,
    steps: steps.map((s, i) => ({
      stepNumber: i + 1,
      action: s.actionType,
      selector: s.selector,
      url: s.url,
      screenshot: s.screenshotUrl,
      timestamp: s.timestamp
    }))
  };
}

async function handleStepCaptured(stepData, tabId) {
  if (machine.state.status !== CaptureStates.CAPTURING) {
    return { success: false, error: 'Not capturing' };
  }

  let screenshotUrl = null;
  const targetTabId = tabId || machine.state.activeTabId;
  
  if (stepData.screenshotDataUrl) {
    try {
      screenshotUrl = await uploadScreenshot(stepData.screenshotDataUrl);
    } catch (e) {
      console.error('[FlowCapture] Screenshot upload failed:', e);
    }
  } else if (targetTabId) {
    try {
      await prepareScreenshotAndCapture(targetTabId, stepData.selector);
      
      const screenshot = await captureScreenshot(targetTabId);
      if (screenshot.dataUrl) {
        screenshotUrl = await uploadScreenshot(screenshot.dataUrl);
      }
    } catch (e) {
      console.error('[FlowCapture] Screenshot capture failed:', e);
    }
  }

  const step = machine.addStep({
    actionType: stepData.action || stepData.actionType || 'click',
    selector: stepData.selector,
    url: stepData.url,
    screenshotUrl,
    screenshotDataUrl: null,
    elementMetadata: stepData.elementMetadata || {},
    timestamp: stepData.timestamp || Date.now(),
    tabId: tabId || machine.state.activeTabId,
    title: stepData.title || `Step ${machine.state.stepCounter}`,
    description: stepData.description || ''
  });

  console.log('[FlowCapture] Step captured:', step.order, step.selector);

  if (machine.state.apiBaseUrl && machine.state.guideId) {
    try {
      await saveStepToServer(step);
      step.syncStatus = 'saved';
    } catch (e) {
      step.syncStatus = 'failed';
      console.error('[FlowCapture] Step save failed:', e);
    }
  }

  machine.broadcastStateUpdate();

  return { success: true, stepCount: machine.state.steps.length, step };
}

async function handleReadyForCapture(data, tabId) {
  const pendingCapture = machine.pendingScreenshots.get(tabId);
  if (pendingCapture) {
    pendingCapture.resolve(data);
    machine.pendingScreenshots.delete(tabId);
  }
  return { success: true };
}

async function captureScreenshot(tabId) {
  try {
    const targetTabId = tabId || machine.state.activeTabId;
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
  const response = await fetch(`${machine.state.apiBaseUrl}/api/workspaces/${machine.state.workspaceId}/guides`, {
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

async function saveStepToServer(step) {
  const response = await fetch(`${machine.state.apiBaseUrl}/api/guides/${machine.state.guideId}/steps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      title: step.title,
      description: step.description,
      actionType: step.actionType,
      selector: step.selector,
      url: step.url,
      imageUrl: step.screenshotUrl,
      order: step.order
    })
  });

  if (!response.ok) {
    throw new Error(`Step save failed: ${response.status}`);
  }

  return await response.json();
}

async function syncStepsToServer() {
  if (!machine.state.apiBaseUrl || !machine.state.guideId) {
    return { success: false };
  }

  const pendingSteps = machine.state.steps.filter(s => s.syncStatus === 'pending' || s.syncStatus === 'failed');
  
  for (const step of pendingSteps) {
    try {
      await saveStepToServer(step);
      step.syncStatus = 'saved';
    } catch (e) {
      step.syncStatus = 'failed';
      console.error('[FlowCapture] Step sync failed:', e);
    }
  }

  return { success: true, stepCount: machine.state.steps.length };
}

async function uploadScreenshot(dataUrl) {
  const presignedResponse = await fetch(`${machine.state.apiBaseUrl}/api/uploads/request-url`, {
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
  } catch {
    return false;
  }
}

async function injectContentScripts(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      console.log('[FlowCapture] Skipping injection for:', tab.url);
      return false;
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/capture-agent.js']
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/screenshot-agent.js']
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/tab-bridge.js']
    });

    console.log('[FlowCapture] Scripts injected into tab:', tabId);
    return true;
  } catch (e) {
    console.log('[FlowCapture] Injection failed:', e.message);
    return false;
  }
}

async function prepareScreenshotAndCapture(tabId, selector) {
  return new Promise(async (resolve) => {
    const timeoutId = setTimeout(() => {
      machine.pendingScreenshots.delete(tabId);
      resolve({ error: 'Screenshot preparation timeout' });
    }, 3000);

    machine.pendingScreenshots.set(tabId, {
      resolve: (result) => {
        clearTimeout(timeoutId);
        resolve(result);
      }
    });

    try {
      await sendToTab(tabId, MessageTypes.PREPARE_SCREENSHOT, { selector });
    } catch (e) {
      clearTimeout(timeoutId);
      machine.pendingScreenshots.delete(tabId);
      resolve({ error: e.message });
    }
  });
}

async function sendToTab(tabId, type, data = {}) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type, data });
  } catch {
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
  if (machine.state.status === CaptureStates.CAPTURING || machine.state.status === CaptureStates.PAUSED) {
    machine.state.activeTabId = activeInfo.tabId;
    await injectContentScripts(activeInfo.tabId);
    if (machine.state.status === CaptureStates.CAPTURING) {
      await sendToTab(activeInfo.tabId, MessageTypes.START_CAPTURE);
    }
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if ((machine.state.status === CaptureStates.CAPTURING || machine.state.status === CaptureStates.PAUSED) && 
      changeInfo.status === 'complete') {
    if (!tab.url?.startsWith('chrome://')) {
      await injectContentScripts(tabId);
      if (machine.state.status === CaptureStates.CAPTURING) {
        await sendToTab(tabId, MessageTypes.START_CAPTURE);
      }
    }
  }
});

console.log('[FlowCapture] Background service worker ready (v2)');
