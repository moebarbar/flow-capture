/**
 * Chrome storage utilities for FlowCapture
 */

const STORAGE_KEYS = {
  SESSION: 'flowcapture_session',
  PENDING_STEPS: 'flowcapture_pending_steps',
  SETTINGS: 'flowcapture_settings'
};

export async function getSession() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SESSION);
    return result[STORAGE_KEYS.SESSION] || null;
  } catch {
    return null;
  }
}

export async function saveSession(session) {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.SESSION]: session });
    return true;
  } catch {
    return false;
  }
}

export async function clearSession() {
  try {
    await chrome.storage.local.remove(STORAGE_KEYS.SESSION);
    return true;
  } catch {
    return false;
  }
}

export async function getPendingSteps() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.PENDING_STEPS);
    return result[STORAGE_KEYS.PENDING_STEPS] || [];
  } catch {
    return [];
  }
}

export async function savePendingSteps(steps) {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.PENDING_STEPS]: steps });
    return true;
  } catch {
    return false;
  }
}

export async function clearPendingSteps() {
  try {
    await chrome.storage.local.remove(STORAGE_KEYS.PENDING_STEPS);
    return true;
  } catch {
    return false;
  }
}

export async function getSettings() {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
    return result[STORAGE_KEYS.SETTINGS] || {
      captureScreenshots: true,
      captureInputValues: false,
      autoSync: true,
      highlightColor: '#ef4444'
    };
  } catch {
    return {};
  }
}

export async function saveSettings(settings) {
  try {
    await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: settings });
    return true;
  } catch {
    return false;
  }
}
