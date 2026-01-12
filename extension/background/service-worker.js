/**
 * FlowCapture Background Service Worker
 * Central orchestrator with finite state machine for capture lifecycle
 */

import { MessageTypes, PortNames, CaptureStates, WebAppMessageTypes } from '../shared/messages.js';
import { saveSession, clearSession, savePendingSteps, getPendingSteps } from '../shared/storage.js';
import { syncManager, SyncStatus } from './sync-manager.js';

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
      panelOpen: true,
      capturedTabs: new Set(),
      pendingTabs: new Map(),
      captureStartedAt: null,
      pausedElapsedMs: 0
    };
    
    this.ports = new Map();
    this.tabContexts = new Map();
    this.pendingScreenshots = new Map();
  }
  
  addPendingTab(tabId, context = {}) {
    if (!this.state.capturedTabs.has(tabId) && !this.state.pendingTabs.has(tabId)) {
      this.state.pendingTabs.set(tabId, { ...context, injectedAt: Date.now() });
      console.log('[FlowCapture] Tab marked as pending:', tabId);
    }
  }
  
  promotePendingTab(tabId) {
    const pendingContext = this.state.pendingTabs.get(tabId);
    if (pendingContext) {
      this.state.pendingTabs.delete(tabId);
      this.state.capturedTabs.add(tabId);
      
      const existingContext = this.tabContexts.get(tabId) || {};
      
      const defaults = {
        url: '',
        title: '',
        stepCount: 0,
        firstCapturedAt: Date.now()
      };
      
      this.tabContexts.set(tabId, { 
        ...defaults, 
        ...existingContext, 
        ...pendingContext 
      });
      console.log('[FlowCapture] Tab promoted from pending to captured:', tabId);
      return true;
    }
    return false;
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
    const recentSteps = this.state.steps.slice(-10).map(step => ({
      order: step.order,
      actionType: step.actionType,
      title: step.title,
      description: step.description,
      selector: step.selector,
      url: step.url,
      timestamp: step.timestamp,
      tabId: step.tabId,
      screenshotUrl: step.screenshotUrl,
      screenshotDataUrl: step.screenshotDataUrl,
      syncStatus: step.syncStatus
    }));

    return {
      status: this.state.status,
      isCapturing: this.state.status === CaptureStates.CAPTURING,
      isPaused: this.state.status === CaptureStates.PAUSED,
      stepCount: this.state.steps.length,
      steps: recentSteps,
      guideId: this.state.guideId,
      workspaceId: this.state.workspaceId,
      panelOpen: this.state.panelOpen,
      activeTabId: this.state.activeTabId,
      capturedTabs: Array.from(this.state.capturedTabs),
      tabContexts: Object.fromEntries(this.tabContexts),
      authExpired: syncManager.authExpired || false,
      captureStartedAt: this.state.captureStartedAt,
      pausedElapsedMs: this.state.pausedElapsedMs
    };
  }

  reset(preserveSession = false) {
    this.state.steps = [];
    this.state.stepCounter = 0;
    this.state.activeTabId = null;
    this.state.capturedTabs.clear();
    this.state.pendingTabs.clear();
    this.tabContexts.clear();
    this.state.captureStartedAt = null;
    this.state.pausedElapsedMs = 0;
    
    if (!preserveSession) {
      this.state.guideId = null;
      this.state.workspaceId = null;
      this.state.captureToken = null;
      this.state.expiresAt = null;
    }
  }
  
  addCapturedTab(tabId, tabInfo = {}) {
    this.state.capturedTabs.add(tabId);
    this.tabContexts.set(tabId, {
      url: tabInfo.url || '',
      title: tabInfo.title || '',
      stepCount: 0,
      firstCapturedAt: Date.now(),
      ...tabInfo
    });
  }
  
  removeCapturedTab(tabId) {
    this.state.capturedTabs.delete(tabId);
    this.tabContexts.delete(tabId);
  }
  
  updateTabContext(tabId, updates) {
    const existing = this.tabContexts.get(tabId) || {};
    this.tabContexts.set(tabId, { ...existing, ...updates });
  }
  
  incrementTabStepCount(tabId) {
    const ctx = this.tabContexts.get(tabId);
    if (ctx) {
      ctx.stepCount = (ctx.stepCount || 0) + 1;
    }
  }

  broadcastStateUpdate() {
    const state = this.getState();
    this.ports.forEach((port) => {
      try {
        port.postMessage({ type: MessageTypes.STATE_UPDATE, data: state });
      } catch {}
    });
    broadcastToAllTabs(MessageTypes.STATE_UPDATE, state);
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

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (machine.state.status !== CaptureStates.CAPTURING && machine.state.status !== CaptureStates.PAUSED) return;
  
  const tabId = activeInfo.tabId;
  const previousActiveTabId = machine.state.activeTabId;
  
  machine.state.activeTabId = tabId;
  
  const isAlreadyActive = machine.state.capturedTabs.has(tabId);
  const isPending = machine.state.pendingTabs.has(tabId);
  
  if (!isAlreadyActive && !isPending) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        const injectResult = await injectContentScripts(tabId);
        if (injectResult.success) {
          machine.addPendingTab(tabId, { url: tab.url, title: tab.title });
          console.log('[FlowCapture] Injected into new tab, waiting for READY_FOR_CAPTURE:', tabId, tab.url);
        } else if (!injectResult.skipped) {
          console.log('[FlowCapture] Tab injection failed:', injectResult.error);
        }
      }
    } catch (e) {
      console.log('[FlowCapture] Tab injection skipped:', e.message);
    }
  } else if (previousActiveTabId !== tabId) {
    console.log('[FlowCapture] Switched to', isPending ? 'pending' : 'captured', 'tab:', tabId);
    machine.broadcastStateUpdate();
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (machine.state.status !== CaptureStates.CAPTURING) return;
  if (changeInfo.status !== 'complete') return;
  
  const isCaptured = machine.state.capturedTabs.has(tabId);
  const isPending = machine.state.pendingTabs.has(tabId);
  
  if (!isCaptured && !isPending) return;
  
  if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
    let existingContext = {};
    
    if (isCaptured) {
      existingContext = machine.tabContexts.get(tabId) || {};
      machine.state.capturedTabs.delete(tabId);
    } else {
      existingContext = machine.state.pendingTabs.get(tabId) || {};
      machine.state.pendingTabs.delete(tabId);
    }
    
    try {
      const injectResult = await injectContentScripts(tabId);
      if (injectResult.success) {
        machine.state.pendingTabs.set(tabId, { 
          ...existingContext, 
          url: tab.url, 
          title: tab.title, 
          injectedAt: Date.now() 
        });
        console.log('[FlowCapture] Reinjected after navigation, waiting for READY_FOR_CAPTURE:', tabId, tab.url);
      } else if (!injectResult.skipped) {
        console.log('[FlowCapture] Reinjection failed:', injectResult.error);
      }
    } catch (e) {
      console.log('[FlowCapture] Reinjection failed:', e.message);
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (machine.state.pendingTabs.has(tabId)) {
    machine.state.pendingTabs.delete(tabId);
    console.log('[FlowCapture] Pending tab removed:', tabId);
  }
  if (machine.state.capturedTabs.has(tabId)) {
    machine.removeCapturedTab(tabId);
    console.log('[FlowCapture] Tab removed from capture:', tabId);
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
        if (machine.state.captureStartedAt) {
          machine.state.pausedElapsedMs = Date.now() - machine.state.captureStartedAt;
        }
        machine.transition(CaptureStates.PAUSED);
        await broadcastToAllTabs(MessageTypes.PAUSE_CAPTURE);
      }
      return { success: true };
    
    case MessageTypes.RESUME_CAPTURE:
      if (machine.canTransition(machine.state.status, CaptureStates.CAPTURING)) {
        machine.state.captureStartedAt = Date.now() - machine.state.pausedElapsedMs;
        machine.state.pausedElapsedMs = 0;
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
    
    case 'STEP_UPDATED':
      return handleStepUpdated(data);
    
    case 'GET_SYNC_STATS':
      return syncManager.getStats();
    
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
    
    case 'GET_AVAILABLE_TABS':
      try {
        const allTabs = await chrome.tabs.query({});
        const validTabs = allTabs.filter(t => 
          t.url && 
          !t.url.startsWith('chrome://') && 
          !t.url.startsWith('chrome-extension://') &&
          !t.url.startsWith('about:') &&
          !t.url.startsWith('edge://') &&
          !t.url.includes('chrome.google.com/webstore')
        );
        
        const tabsWithMeta = await Promise.all(validTabs.map(async (t) => {
          let description = '';
          try {
            const url = new URL(t.url);
            description = url.hostname;
            
            const results = await chrome.scripting.executeScript({
              target: { tabId: t.id },
              func: () => {
                const metaDesc = document.querySelector('meta[name="description"]');
                return metaDesc ? metaDesc.content : null;
              }
            });
            if (results?.[0]?.result) {
              description = results[0].result.substring(0, 100);
            }
          } catch (e) {
            try {
              const url = new URL(t.url);
              description = url.hostname;
            } catch {
              description = 'Unknown site';
            }
          }
          
          return {
            id: t.id,
            title: t.title || 'Untitled',
            url: t.url,
            favIconUrl: t.favIconUrl,
            active: t.active,
            windowId: t.windowId,
            description,
            isCapturing: machine.state.capturedTabs.has(t.id),
            isPending: machine.state.pendingTabs.has(t.id)
          };
        }));
        
        return { tabs: tabsWithMeta };
      } catch (e) {
        return { tabs: [], error: e.message };
      }
    
    case 'SELECT_TAB_AND_START_CAPTURE':
      if (!data?.tabId) {
        return { success: false, error: 'No tabId provided' };
      }
      
      try {
        const targetTab = await chrome.tabs.get(data.tabId);
        
        await chrome.windows.update(targetTab.windowId, { focused: true });
        
        if (!targetTab.active) {
          await chrome.tabs.update(data.tabId, { active: true });
          
          await new Promise((resolve) => {
            const listener = (activeInfo) => {
              if (activeInfo.tabId === data.tabId) {
                chrome.tabs.onActivated.removeListener(listener);
                resolve();
              }
            };
            chrome.tabs.onActivated.addListener(listener);
            setTimeout(() => {
              chrome.tabs.onActivated.removeListener(listener);
              resolve();
            }, 1000);
          });
        }
        
        const captureResult = await startCapture({ 
          tabId: data.tabId, 
          highlightColor: data.highlightColor 
        });
        
        return captureResult;
      } catch (e) {
        return { success: false, error: e.message };
      }
    
    case 'SELECT_TAB_FOR_CAPTURE':
      if (!data?.tabId) {
        return { success: false, error: 'No tabId provided' };
      }
      if (machine.state.status === CaptureStates.CAPTURING) {
        const tabId = data.tabId;
        const isAlreadyCaptured = machine.state.capturedTabs.has(tabId);
        const isPending = machine.state.pendingTabs.has(tabId);
        
        if (!isAlreadyCaptured && !isPending) {
          try {
            const tab = await chrome.tabs.get(tabId);
            const injectResult = await injectContentScripts(tabId);
            if (injectResult.success) {
              machine.addPendingTab(tabId, { url: tab.url, title: tab.title });
              console.log('[FlowCapture] Tab selected for capture, waiting for READY_FOR_CAPTURE:', tabId);
              return { success: true, tabId: tabId, status: 'pending_ready' };
            } else {
              return { success: false, error: injectResult.error || 'Injection failed' };
            }
          } catch (e) {
            return { success: false, error: e.message };
          }
        } else if (isPending) {
          console.log('[FlowCapture] Tab already pending, waiting for READY_FOR_CAPTURE:', tabId);
          return { success: true, tabId: tabId, status: 'already_pending' };
        }
        return { success: true, tabId: data.tabId, alreadyCapturing: true };
      }
      return await startCapture({ tabId: data.tabId });
    
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

  machine.reset(true);
  machine.state.captureStartedAt = Date.now();
  machine.transition(CaptureStates.CAPTURING);

  syncManager.configure(machine.state.apiBaseUrl, machine.state.guideId);
  syncManager.setStatusCallback((stepOrder, status) => {
    const step = machine.state.steps.find(s => s.order === stepOrder);
    if (step) {
      step.syncStatus = status;
      machine.broadcastStateUpdate();
    }
  });
  syncManager.setAuthRequiredCallback(async () => {
    console.log('[FlowCapture] Auth expired, notifying all tabs');
    await broadcastToAllTabs('AUTH_REQUIRED');
  });
  syncManager.setAuthRestoredCallback(async () => {
    console.log('[FlowCapture] Auth restored, notifying all tabs');
    await broadcastToAllTabs('AUTH_RESTORED');
  });
  syncManager.clearAuthExpired();
  await syncManager.loadOfflineQueue();
  syncManager.startPeriodicSync();

  const targetTabId = config.tabId;
  let primaryTab;
  
  if (targetTabId) {
    try {
      primaryTab = await chrome.tabs.get(targetTabId);
    } catch (e) {
      console.log('[FlowCapture] Specified tab not found, using active tab');
    }
  }
  
  if (!primaryTab) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    primaryTab = activeTab;
  }
  
  if (primaryTab && primaryTab.id) {
    machine.state.activeTabId = primaryTab.id;
    
    const injectResult = await injectContentScripts(primaryTab.id);
    if (injectResult.success) {
      machine.addPendingTab(primaryTab.id, { url: primaryTab.url, title: primaryTab.title });
      console.log('[FlowCapture] Injected primary tab, waiting for READY_FOR_CAPTURE:', primaryTab.id, primaryTab.url);
    } else if (injectResult.skipped) {
      console.log('[FlowCapture] Primary tab skipped (restricted URL):', primaryTab.url);
    } else {
      console.warn('[FlowCapture] Primary tab injection failed, will retry via handshake:', injectResult.error);
      machine.addPendingTab(primaryTab.id, { url: primaryTab.url, title: primaryTab.title, injectionFailed: true });
    }
  }

  const injectedCount = await injectIntoAllTabs();
  console.log(`[FlowCapture] Pre-injected into ${injectedCount} additional tabs (waiting for READY_FOR_CAPTURE)`);

  return { 
    success: true, 
    guideId: machine.state.guideId,
    activeTabId: machine.state.activeTabId,
    capturedTabs: Array.from(machine.state.capturedTabs),
    injectedCount
  };
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
      const flushResult = await syncManager.flush();
      console.log('[FlowCapture] Sync flush complete:', flushResult);
    } catch (e) {
      console.error('[FlowCapture] Sync flush failed:', e);
    }
  }

  syncManager.stopPeriodicSync();
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
  
  let tabContext = machine.tabContexts.get(targetTabId);
  if (!tabContext && targetTabId) {
    try {
      const tab = await chrome.tabs.get(targetTabId);
      tabContext = { url: tab.url, title: tab.title };
      if (!machine.state.capturedTabs.has(targetTabId)) {
        machine.addCapturedTab(targetTabId, tabContext);
      }
    } catch (e) {
      tabContext = { url: stepData.url || '', title: '' };
    }
  }
  
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

  machine.incrementTabStepCount(targetTabId);

  const step = machine.addStep({
    actionType: stepData.action || stepData.actionType || 'click',
    selector: stepData.selector,
    tabId: targetTabId,
    tabUrl: tabContext?.url || stepData.url,
    tabTitle: tabContext?.title || '',
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
    step.screenshotDataUrl = screenshotUrl ? null : stepData.screenshotDataUrl;
    syncManager.enqueueStep(step);
  }

  await broadcastToAllTabs('STEP_ADDED', { ...step });
  
  machine.broadcastStateUpdate();

  return { success: true, stepCount: machine.state.steps.length, step };
}

async function handleReadyForCapture(data, tabId) {
  const pendingCapture = machine.pendingScreenshots.get(tabId);
  if (pendingCapture) {
    pendingCapture.resolve(data);
    machine.pendingScreenshots.delete(tabId);
  }
  
  if (machine.state.status !== CaptureStates.CAPTURING) {
    return { success: true, message: 'Not capturing' };
  }
  
  const isAlreadyCaptured = machine.state.capturedTabs.has(tabId);
  
  if (isAlreadyCaptured) {
    console.log('[FlowCapture] Tab already captured, sending START_CAPTURE for reload:', tabId);
    await sendToTab(tabId, MessageTypes.START_CAPTURE);
    return { success: true, message: 'Reactivated' };
  }
  
  const wasPending = machine.state.pendingTabs.has(tabId);
  
  if (!wasPending) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        machine.addPendingTab(tabId, { url: tab.url, title: tab.title });
        console.log('[FlowCapture] New tab ready, adding to pending then promoting:', tabId);
      } else {
        return { success: true, message: 'Invalid tab URL' };
      }
    } catch (e) {
      console.log('[FlowCapture] Tab ready but could not get info:', e.message);
      return { success: false, error: e.message };
    }
  }
  
  machine.promotePendingTab(tabId);
  console.log('[FlowCapture] Tab promoted, sending START_CAPTURE:', tabId);
  await sendToTab(tabId, MessageTypes.START_CAPTURE);
  
  return { success: true };
}

function handleStepUpdated(data) {
  if (!data || !data.order) {
    return { success: false, error: 'Missing step order' };
  }

  const step = machine.state.steps.find(s => s.order === data.order);
  if (!step) {
    return { success: false, error: 'Step not found' };
  }

  if (data.title !== undefined) {
    step.title = data.title;
  }
  if (data.description !== undefined) {
    step.description = data.description;
  }

  console.log('[FlowCapture] Step updated:', step.order, step.title);

  machine.broadcastStateUpdate();

  return { success: true, step };
}

const SCREENSHOT_CONFIG = {
  format: 'png',
  quality: 92,
  maxRetries: 3,
  retryDelayMs: 100,
  timeout: 5000
};

async function captureScreenshot(tabId) {
  const targetTabId = tabId || machine.state.activeTabId;
  const captureTimestamp = Date.now();
  
  let windowId = null;
  if (targetTabId) {
    try {
      const tab = await chrome.tabs.get(targetTabId);
      windowId = tab.windowId;
    } catch (e) {
      console.log('[FlowCapture] Could not get tab window:', e.message);
    }
  }

  let lastError = null;
  
  for (let attempt = 1; attempt <= SCREENSHOT_CONFIG.maxRetries; attempt++) {
    try {
      const dataUrl = await captureWithTimeout(windowId, SCREENSHOT_CONFIG.timeout);
      
      return { 
        dataUrl,
        capturedAt: captureTimestamp,
        tabId: targetTabId,
        attempt
      };
    } catch (e) {
      lastError = e;
      const errorType = classifyScreenshotError(e);
      
      console.log(`[FlowCapture] Screenshot attempt ${attempt} failed:`, errorType, e.message);
      
      if (errorType === 'permanent') {
        break;
      }
      
      if (attempt < SCREENSHOT_CONFIG.maxRetries) {
        const delay = SCREENSHOT_CONFIG.retryDelayMs * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }

  return { 
    error: lastError?.message || 'Screenshot capture failed',
    errorType: classifyScreenshotError(lastError),
    capturedAt: captureTimestamp,
    tabId: targetTabId
  };
}

async function captureWithTimeout(windowId, timeoutMs) {
  return new Promise(async (resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Screenshot capture timed out'));
    }, timeoutMs);

    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { 
        format: SCREENSHOT_CONFIG.format,
        quality: SCREENSHOT_CONFIG.quality
      });
      clearTimeout(timeoutId);
      resolve(dataUrl);
    } catch (e) {
      clearTimeout(timeoutId);
      reject(e);
    }
  });
}

function classifyScreenshotError(error) {
  if (!error) return 'unknown';
  
  const message = error.message?.toLowerCase() || '';
  
  if (message.includes('cannot access') || message.includes('chrome://') || message.includes('chrome-extension://')) {
    return 'permanent';
  }
  
  if (message.includes('no current browser') || message.includes('window not found')) {
    return 'permanent';
  }
  
  if (message.includes('tab') && message.includes('not found')) {
    return 'permanent';
  }
  
  if (message.includes('not ready') || message.includes('loading')) {
    return 'transient';
  }
  
  if (message.includes('minimized') || message.includes('occluded')) {
    return 'transient';
  }
  
  if (message.includes('timeout')) {
    return 'transient';
  }
  
  return 'unknown';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

async function injectContentScripts(tabId, options = {}) {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelay = options.baseDelay ?? 500;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        console.log('[FlowCapture] Skipping injection for:', tab.url);
        return { success: false, error: 'Restricted URL', skipped: true };
      }
      
      if (tab.url.includes('chrome.google.com/webstore')) {
        console.log('[FlowCapture] Cannot inject into Chrome Web Store');
        return { success: false, error: 'Chrome Web Store not supported', skipped: true };
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

      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/side-panel.js']
      });

      console.log('[FlowCapture] Scripts injected into tab:', tabId, '(attempt', attempt, ')');
      
      broadcastInjectionStatus(tabId, 'success');
      return { success: true };
    } catch (e) {
      console.log(`[FlowCapture] Injection attempt ${attempt}/${maxRetries} failed:`, e.message);
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`[FlowCapture] Retrying in ${delay}ms...`);
        broadcastInjectionStatus(tabId, 'retrying', { attempt, maxRetries, error: e.message });
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.error('[FlowCapture] All injection attempts failed for tab:', tabId);
        broadcastInjectionStatus(tabId, 'error', { error: e.message });
        return { success: false, error: e.message };
      }
    }
  }
  
  return { success: false, error: 'Max retries exceeded' };
}

function broadcastInjectionStatus(tabId, status, details = {}) {
  const message = {
    type: 'INJECTION_STATUS',
    data: { tabId, status, ...details, timestamp: Date.now() }
  };
  
  machine.ports.forEach((port) => {
    try {
      port.postMessage(message);
    } catch (e) {}
  });
  
  try {
    chrome.tabs.sendMessage(tabId, message).catch(() => {});
  } catch (e) {}
}

async function injectIntoAllTabs() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const validTabs = tabs.filter(t => 
      t.url && 
      !t.url.startsWith('chrome://') && 
      !t.url.startsWith('chrome-extension://') &&
      !machine.state.capturedTabs.has(t.id) &&
      !machine.state.pendingTabs.has(t.id)
    );
    
    const results = await Promise.allSettled(
      validTabs.map(async (tab) => {
        const result = await injectContentScripts(tab.id);
        if (result.success) {
          machine.addPendingTab(tab.id, { url: tab.url, title: tab.title });
        }
        return { tabId: tab.id, success: result.success, error: result.error };
      })
    );
    
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    console.log(`[FlowCapture] Pre-injected scripts into ${successCount}/${validTabs.length} tabs`);
    return successCount;
  } catch (e) {
    console.error('[FlowCapture] Failed to inject into all tabs:', e);
    return 0;
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

console.log('[FlowCapture] Background service worker ready (v2)');
