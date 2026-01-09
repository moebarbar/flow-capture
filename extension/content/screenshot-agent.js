/**
 * FlowCapture Screenshot Agent
 * Handles scroll-to-view, render stabilization, and idle detection
 */

(function() {
  if (window.__flowCaptureScreenshotAgent) return;
  window.__flowCaptureScreenshotAgent = true;

  const DEFAULT_OPTIONS = {
    scrollToElement: true,
    waitForIdle: true,
    delay: 100,
    maxWaitTime: 2000
  };

  function scrollElementIntoView(element) {
    if (!element) return Promise.resolve();
    
    return new Promise((resolve) => {
      element.scrollIntoView({ 
        block: 'center', 
        inline: 'center',
        behavior: 'instant' 
      });
      
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
  }

  function waitForNetworkIdle(timeout = 1000) {
    return new Promise((resolve) => {
      let pendingRequests = 0;
      let idleTimer = null;
      
      const checkIdle = () => {
        if (pendingRequests === 0) {
          resolve();
        }
      };
      
      const timeoutId = setTimeout(resolve, timeout);
      
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') {
            pendingRequests++;
            clearTimeout(idleTimer);
            
            idleTimer = setTimeout(() => {
              pendingRequests = Math.max(0, pendingRequests - 1);
              checkIdle();
            }, 100);
          }
        }
      });
      
      try {
        observer.observe({ entryTypes: ['resource'] });
        setTimeout(() => {
          observer.disconnect();
          clearTimeout(timeoutId);
          resolve();
        }, timeout);
      } catch {
        resolve();
      }
    });
  }

  function waitForAnimations(timeout = 500) {
    return new Promise((resolve) => {
      const animations = document.getAnimations?.() || [];
      
      if (animations.length === 0) {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
        return;
      }
      
      const timeoutId = setTimeout(resolve, timeout);
      
      Promise.all(animations.map(a => a.finished?.catch(() => {})))
        .then(() => {
          clearTimeout(timeoutId);
          requestAnimationFrame(resolve);
        })
        .catch(resolve);
    });
  }

  function waitForMutationsIdle(timeout = 300) {
    return new Promise((resolve) => {
      let timeoutId = null;
      let resolved = false;
      
      const done = () => {
        if (resolved) return;
        resolved = true;
        observer.disconnect();
        clearTimeout(timeoutId);
        resolve();
      };
      
      const observer = new MutationObserver(() => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(done, 100);
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true
      });
      
      timeoutId = setTimeout(done, timeout);
    });
  }

  async function prepareForCapture(selector, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const element = selector ? document.querySelector(selector) : null;
    
    if (opts.scrollToElement && element) {
      await scrollElementIntoView(element);
    }
    
    if (opts.waitForIdle) {
      await Promise.race([
        Promise.all([
          waitForAnimations(500),
          waitForMutationsIdle(300)
        ]),
        new Promise(resolve => setTimeout(resolve, opts.maxWaitTime))
      ]);
    }
    
    if (opts.delay > 0) {
      await new Promise(resolve => setTimeout(resolve, opts.delay));
    }
    
    return {
      ready: true,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      },
      elementRect: element ? element.getBoundingClientRect() : null
    };
  }

  async function captureWithHighlight(element) {
    if (!element) return null;
    
    await scrollElementIntoView(element);
    
    const highlightBox = document.createElement('div');
    highlightBox.style.cssText = `
      position: fixed;
      border: 3px solid #ef4444;
      background: rgba(239, 68, 68, 0.1);
      border-radius: 4px;
      pointer-events: none;
      z-index: 2147483646;
      transition: none;
    `;
    
    const rect = element.getBoundingClientRect();
    highlightBox.style.left = `${rect.left - 3}px`;
    highlightBox.style.top = `${rect.top - 3}px`;
    highlightBox.style.width = `${rect.width + 6}px`;
    highlightBox.style.height = `${rect.height + 6}px`;
    
    document.body.appendChild(highlightBox);
    
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    
    try {
      const response = await chrome.runtime.sendMessage({ type: 'SCREENSHOT_REQUEST' });
      return response?.dataUrl || null;
    } finally {
      highlightBox.remove();
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PREPARE_SCREENSHOT') {
      prepareForCapture(message.data?.selector, message.data?.options)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ ready: false, error: err.message }));
      return true;
    }
  });

  window.FlowCaptureScreenshot = {
    prepareForCapture,
    captureWithHighlight,
    scrollElementIntoView,
    waitForNetworkIdle,
    waitForAnimations,
    waitForMutationsIdle
  };
})();
