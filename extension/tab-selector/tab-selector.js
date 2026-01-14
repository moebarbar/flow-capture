document.addEventListener('DOMContentLoaded', async () => {
  const tabList = document.getElementById('tab-list');
  const cancelBtn = document.getElementById('cancel-btn');
  const permissionWarning = document.getElementById('permission-warning');
  const grantPermissionBtn = document.getElementById('grant-permission-btn');

  const params = new URLSearchParams(window.location.search);
  const guideId = params.get('guideId');
  const workspaceId = params.get('workspaceId');
  const apiBaseUrl = params.get('apiBaseUrl');
  const returnTabId = params.get('returnTabId');

  async function checkPermissions() {
    try {
      const hasPermission = await chrome.permissions.contains({ origins: ['<all_urls>'] });
      return hasPermission;
    } catch (e) {
      console.error('[TabSelector] Permission check failed:', e);
      return false;
    }
  }

  async function requestPermissions() {
    try {
      const granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
      if (granted) {
        permissionWarning.style.display = 'none';
        await loadTabs();
      }
      return granted;
    } catch (e) {
      console.error('[TabSelector] Permission request failed:', e);
      return false;
    }
  }

  async function loadTabs() {
    tabList.innerHTML = '<div class="tab-loading loading-spinner">Loading available tabs...</div>';

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
        if (tab.id === parseInt(returnTabId)) return;

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
            <div class="tab-title">${escapeHtml(tab.title || 'Untitled')}</div>
            <div class="tab-description">${escapeHtml(getHostname(tab.url))}</div>
          </div>
          ${tab.active ? '<span class="tab-active-badge">Active</span>' : ''}
        `;

        tabItem.addEventListener('click', () => selectTabAndStartCapture(tab.id));
        tabList.appendChild(tabItem);
      });

      if (tabList.children.length === 0) {
        tabList.innerHTML = '<div class="tab-empty">No available tabs to capture. Open a website in another tab first.</div>';
      }
    } catch (e) {
      console.error('[TabSelector] Failed to load tabs:', e);
      tabList.innerHTML = `<div class="tab-error">Failed to load tabs: ${escapeHtml(e.message)}</div>`;
    }
  }

  async function selectTabAndStartCapture(tabId) {
    tabList.innerHTML = '<div class="tab-loading loading-spinner">Starting capture...</div>';

    try {
      const settings = await chrome.storage.local.get(['highlightColor']);
      const highlightColor = settings.highlightColor || '#6366f1';

      const result = await chrome.runtime.sendMessage({
        type: 'SELECT_TAB_AND_START_CAPTURE',
        data: {
          tabId,
          highlightColor,
          guideId: guideId ? parseInt(guideId) : null,
          workspaceId: workspaceId ? parseInt(workspaceId) : null,
          apiBaseUrl: apiBaseUrl || undefined,
          requestingAppTabId: returnTabId ? parseInt(returnTabId) : null
        }
      });

      if (result?.success) {
        window.close();
      } else {
        tabList.innerHTML = `<div class="tab-error">Failed to start capture: ${escapeHtml(result?.error || 'Unknown error')}</div>`;
      }
    } catch (e) {
      console.error('[TabSelector] Failed to start capture:', e);
      tabList.innerHTML = `<div class="tab-error">Error: ${escapeHtml(e.message)}</div>`;
    }
  }

  cancelBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'CANCEL_TAB_SELECTOR' });
    window.close();
  });

  grantPermissionBtn.addEventListener('click', requestPermissions);

  const hasPermission = await checkPermissions();
  if (!hasPermission) {
    permissionWarning.style.display = 'block';
    tabList.innerHTML = '<div class="tab-empty">Permission required to view tabs.</div>';
  } else {
    await loadTabs();
  }
});

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url || '';
  }
}
