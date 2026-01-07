let capturedSteps = [];
let currentFlowTitle = 'Untitled Flow';
let isPaused = false;
let currentTabId = null;
let apiToken = null;

const API_URL = 'https://flowcapture.replit.app/api';

document.addEventListener('DOMContentLoaded', () => {
  initializeSidePanel();
  setupEventListeners();
  loadStoredData();
});

async function initializeSidePanel() {
  const stepsList = document.getElementById('steps-list');
  stepsList.innerHTML = `
    <div class="steps-empty">
      <svg class="steps-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
      </svg>
      <div class="steps-empty-text">Click anywhere on the page to start capturing steps</div>
    </div>
  `;
  
  updateCapturingIndicator(true);
}

function setupEventListeners() {
  document.getElementById('flow-title').addEventListener('input', (e) => {
    currentFlowTitle = e.target.value || 'Untitled Flow';
  });
  
  document.getElementById('complete-btn').addEventListener('click', handleComplete);
  document.getElementById('pause-btn').addEventListener('click', handlePause);
  document.getElementById('restart-btn').addEventListener('click', handleRestart);
  document.getElementById('more-btn').addEventListener('click', handleMoreOptions);
  document.getElementById('delete-btn').addEventListener('click', handleDelete);
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'newStep') {
      addStep(message.step);
      sendResponse({ success: true });
    } else if (message.action === 'updateScreenshot') {
      updateStepScreenshot(message.stepNumber, message.screenshot);
      sendResponse({ success: true });
    }
    return true;
  });
}

async function loadStoredData() {
  const stored = await chrome.storage.local.get(['capturedSteps', 'flowTitle', 'currentTabId', 'apiToken', 'workspaceName']);
  
  if (stored.capturedSteps && stored.capturedSteps.length > 0) {
    capturedSteps = stored.capturedSteps;
    renderSteps();
  }
  
  if (stored.flowTitle) {
    currentFlowTitle = stored.flowTitle;
    document.getElementById('flow-title').value = currentFlowTitle;
  }
  
  if (stored.currentTabId) {
    currentTabId = stored.currentTabId;
  }
  
  if (stored.apiToken) {
    apiToken = stored.apiToken;
  }
  
  if (stored.workspaceName) {
    document.getElementById('workspace-badge').textContent = stored.workspaceName;
  }
}

function addStep(step) {
  if (isPaused) return;
  
  const stepNumber = capturedSteps.length + 1;
  const newStep = {
    ...step,
    number: stepNumber,
    timestamp: Date.now()
  };
  
  capturedSteps.push(newStep);
  renderSteps();
  saveToStorage();
  scrollToBottom();
}

function updateStepScreenshot(stepNumber, screenshot) {
  const step = capturedSteps.find(s => s.number === stepNumber);
  if (step) {
    step.screenshot = screenshot;
    renderSteps();
    saveToStorage();
  }
}

function renderSteps() {
  const stepsList = document.getElementById('steps-list');
  
  if (capturedSteps.length === 0) {
    stepsList.innerHTML = `
      <div class="steps-empty">
        <svg class="steps-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
        <div class="steps-empty-text">Click anywhere on the page to start capturing steps</div>
      </div>
    `;
    return;
  }
  
  stepsList.innerHTML = capturedSteps.map(step => `
    <div class="step-card" data-step="${step.number}" data-testid="card-step-${step.number}">
      <div class="step-number">${step.number}</div>
      ${step.screenshot ? `<img class="step-thumbnail" src="${step.screenshot}" alt="Step ${step.number}" />` : '<div class="step-thumbnail"></div>'}
      <div class="step-info">
        <div class="step-description">${escapeHtml(step.description || 'No description')}</div>
        ${step.pageUrl ? `<div class="step-url">${new URL(step.pageUrl).hostname}</div>` : ''}
      </div>
      <div class="step-actions">
        <button class="step-action-btn" data-action="edit" title="Edit step">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="step-action-btn" data-action="delete" title="Delete step">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `).join('');
  
  stepsList.querySelectorAll('.step-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.step-action-btn')) {
        const action = e.target.closest('.step-action-btn').dataset.action;
        const stepNumber = parseInt(card.dataset.step);
        if (action === 'delete') {
          deleteStep(stepNumber);
        } else if (action === 'edit') {
          editStep(stepNumber);
        }
      }
    });
  });
}

function deleteStep(stepNumber) {
  if (confirm('Delete this step?')) {
    capturedSteps = capturedSteps.filter(s => s.number !== stepNumber);
    capturedSteps.forEach((s, i) => s.number = i + 1);
    renderSteps();
    saveToStorage();
  }
}

function editStep(stepNumber) {
  const step = capturedSteps.find(s => s.number === stepNumber);
  if (!step) return;
  
  const newDescription = prompt('Edit step description:', step.description);
  if (newDescription !== null) {
    step.description = newDescription;
    renderSteps();
    saveToStorage();
  }
}

function scrollToBottom() {
  const stepsList = document.getElementById('steps-list');
  stepsList.scrollTop = stepsList.scrollHeight;
}

function saveToStorage() {
  chrome.storage.local.set({
    capturedSteps,
    flowTitle: currentFlowTitle
  });
}

function updateCapturingIndicator(isCapturing) {
  const existingIndicator = document.querySelector('.capturing-indicator');
  if (existingIndicator) {
    existingIndicator.remove();
  }
  
  if (isCapturing && !isPaused) {
    const header = document.querySelector('.header');
    const indicator = document.createElement('div');
    indicator.className = 'capturing-indicator';
    indicator.innerHTML = `
      <div class="capturing-dot"></div>
      <span>Capturing interactions...</span>
    `;
    header.parentNode.insertBefore(indicator, header);
  } else if (isPaused) {
    const header = document.querySelector('.header');
    const indicator = document.createElement('div');
    indicator.className = 'capturing-indicator paused-indicator';
    indicator.innerHTML = `
      <div class="capturing-dot"></div>
      <span>Capture paused</span>
    `;
    header.parentNode.insertBefore(indicator, header);
  }
}

async function handleComplete() {
  if (capturedSteps.length === 0) {
    alert('No steps captured yet. Click on the page to capture interactions.');
    return;
  }
  
  showLoadingOverlay('Saving flow...');
  
  try {
    const flowData = {
      title: currentFlowTitle,
      steps: capturedSteps.map(step => ({
        order: step.number,
        type: step.type || 'click',
        description: step.description,
        screenshotData: step.screenshot,
        selector: step.element?.selector,
        url: step.pageUrl,
        metadata: {
          xpath: step.element?.xpath,
          tagName: step.element?.tagName,
          timestamp: step.timestamp
        }
      }))
    };
    
    updateLoadingText('Uploading screenshots...');
    
    const uploadedSteps = await Promise.all(
      flowData.steps.map(async (step, index) => {
        updateLoadingText(`Uploading screenshot ${index + 1}/${flowData.steps.length}...`);
        
        if (step.screenshotData && step.screenshotData.startsWith('data:')) {
          try {
            // Convert base64 to blob
            const response = await fetch(step.screenshotData);
            const blob = await response.blob();
            
            // Get presigned upload URL from backend
            const urlResponse = await fetch(`${API_URL}/upload/screenshot`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(apiToken ? { 'Authorization': `Bearer ${apiToken}` } : {})
              },
              credentials: 'include'
            });
            
            if (urlResponse.ok) {
              const { uploadURL, url } = await urlResponse.json();
              
              // Upload directly to presigned URL
              const uploadResult = await fetch(uploadURL, {
                method: 'PUT',
                body: blob,
                headers: { 'Content-Type': 'image/png' }
              });
              
              if (uploadResult.ok) {
                return { ...step, imageUrl: url, screenshotData: undefined };
              }
            }
          } catch (err) {
            console.error('Screenshot upload failed:', err);
          }
        }
        return { ...step, screenshotData: undefined };
      })
    );
    
    updateLoadingText('Creating flow...');
    
    const createResponse = await fetch(`${API_URL}/flows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiToken ? { 'Authorization': `Bearer ${apiToken}` } : {})
      },
      credentials: 'include',
      body: JSON.stringify({
        ...flowData,
        steps: uploadedSteps
      })
    });
    
    if (!createResponse.ok) {
      throw new Error('Failed to create flow');
    }
    
    const { id: flowId } = await createResponse.json();
    
    await chrome.storage.local.remove(['capturedSteps', 'flowTitle', 'currentTabId']);
    
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '../icons/icon128.png',
      title: 'Flow Captured!',
      message: 'Opening editor...'
    });
    
    chrome.tabs.create({
      url: `${API_URL.replace('/api', '')}/flows/${flowId}/edit`
    });
    
    hideLoadingOverlay();
    window.close();
    
  } catch (error) {
    console.error('Error saving flow:', error);
    hideLoadingOverlay();
    alert('Failed to save flow. Please try again.');
  }
}

function handlePause() {
  isPaused = !isPaused;
  const pauseBtn = document.getElementById('pause-btn');
  
  if (isPaused) {
    pauseBtn.classList.add('paused');
    pauseBtn.title = 'Resume Capture';
    pauseBtn.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
    `;
  } else {
    pauseBtn.classList.remove('paused');
    pauseBtn.title = 'Pause Capture';
    pauseBtn.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="6" y="4" width="4" height="16"></rect>
        <rect x="14" y="4" width="4" height="16"></rect>
      </svg>
    `;
  }
  
  updateCapturingIndicator(!isPaused);
  
  if (currentTabId) {
    chrome.tabs.sendMessage(currentTabId, {
      action: isPaused ? 'pauseCapture' : 'resumeCapture'
    });
  }
}

function handleRestart() {
  if (capturedSteps.length === 0) return;
  
  if (confirm('Clear all captured steps and start over?')) {
    capturedSteps = [];
    renderSteps();
    saveToStorage();
    isPaused = false;
    updateCapturingIndicator(true);
    
    const pauseBtn = document.getElementById('pause-btn');
    pauseBtn.classList.remove('paused');
    pauseBtn.title = 'Pause Capture';
    pauseBtn.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="6" y="4" width="4" height="16"></rect>
        <rect x="14" y="4" width="4" height="16"></rect>
      </svg>
    `;
  }
}

function handleMoreOptions() {
  alert('More options coming soon: Export, Settings, Help');
}

function handleDelete() {
  if (capturedSteps.length === 0) {
    window.close();
    return;
  }
  
  if (confirm('Delete this flow and all captured steps?')) {
    chrome.storage.local.remove(['capturedSteps', 'flowTitle', 'currentTabId']);
    window.close();
  }
}

function showLoadingOverlay(text) {
  const overlay = document.createElement('div');
  overlay.id = 'loading-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.95);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `;
  overlay.innerHTML = `
    <div style="width: 40px; height: 40px; border: 3px solid #e5e7eb; border-top-color: #7C3AED; border-radius: 50%; animation: spin 1s linear infinite;"></div>
    <div id="loading-text" style="margin-top: 16px; font-size: 14px; color: #374151;">${text}</div>
    <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
  `;
  document.body.appendChild(overlay);
  
  document.querySelectorAll('.controls-toolbar button').forEach(btn => btn.disabled = true);
}

function updateLoadingText(text) {
  const loadingText = document.getElementById('loading-text');
  if (loadingText) {
    loadingText.textContent = text;
  }
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.remove();
  }
  document.querySelectorAll('.controls-toolbar button').forEach(btn => btn.disabled = false);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
