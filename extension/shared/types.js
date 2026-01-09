/**
 * Type definitions for FlowCapture Chrome Extension
 * Uses JSDoc for TypeScript-style documentation
 */

/**
 * @typedef {Object} CaptureSession
 * @property {string} guideId - The ID of the guide being captured
 * @property {string} workspaceId - The workspace ID
 * @property {string} apiBaseUrl - Base URL for API calls
 * @property {string|null} captureToken - Authentication token for capture
 * @property {number|null} expiresAt - Token expiration timestamp
 */

/**
 * @typedef {Object} CaptureState
 * @property {'idle'|'capturing'|'paused'|'syncing'} status - Current capture status
 * @property {string|null} guideId - Active guide ID
 * @property {string|null} workspaceId - Active workspace ID
 * @property {string} apiBaseUrl - API base URL
 * @property {number|null} activeTabId - Currently active tab ID
 * @property {Step[]} steps - Captured steps
 * @property {string|null} captureToken - Auth token
 * @property {number|null} expiresAt - Token expiration
 * @property {Map<number, TabContext>} tabContexts - Per-tab capture contexts
 */

/**
 * @typedef {Object} TabContext
 * @property {number} tabId - The tab ID
 * @property {string} url - Current URL of the tab
 * @property {string} title - Page title
 * @property {boolean} isActive - Whether this is the active capture tab
 * @property {Port|null} port - Long-lived port connection
 * @property {Step[]} bufferedSteps - Steps waiting to be processed
 */

/**
 * @typedef {Object} Step
 * @property {number} id - Local step ID
 * @property {number} order - Step order in the guide
 * @property {string} actionType - Type of action (click, input, navigation, etc.)
 * @property {string} selector - CSS selector for the element
 * @property {string} url - Page URL when step was captured
 * @property {string|null} title - Generated step title
 * @property {string|null} description - Generated step description
 * @property {string|null} screenshotUrl - URL of uploaded screenshot
 * @property {string|null} screenshotDataUrl - Base64 screenshot data (temporary)
 * @property {ElementMetadata} elementMetadata - Additional element info
 * @property {number} timestamp - Capture timestamp
 * @property {number} tabId - Tab where step was captured
 * @property {'pending'|'uploading'|'saved'|'failed'} syncStatus - Sync status
 */

/**
 * @typedef {Object} ElementMetadata
 * @property {string} tagName - Element tag name
 * @property {string|null} id - Element ID attribute
 * @property {string[]} classList - Element classes
 * @property {string|null} textContent - Visible text content
 * @property {string|null} placeholder - Input placeholder
 * @property {string|null} name - Input name attribute
 * @property {string|null} type - Input type attribute
 * @property {string|null} href - Link href
 * @property {string|null} ariaLabel - ARIA label
 * @property {DOMRect} rect - Element bounding rect
 */

/**
 * @typedef {Object} ScreenshotOptions
 * @property {boolean} scrollToElement - Whether to scroll element into view
 * @property {boolean} waitForIdle - Wait for network/animation idle
 * @property {number} delay - Additional delay before capture (ms)
 * @property {boolean} fullPage - Capture full page instead of viewport
 * @property {boolean} highlightElement - Show highlight box on element
 */

/**
 * @typedef {Object} PortMessage
 * @property {string} type - Message type from MessageTypes
 * @property {Object} [data] - Message payload
 * @property {string} [requestId] - Request ID for response matching
 */

/**
 * @typedef {Object} TrustedOrigin
 * @property {string} pattern - Origin pattern (suffix or exact)
 * @property {boolean} isPrefix - Whether pattern is a suffix match
 */

export const DEFAULT_SCREENSHOT_OPTIONS = {
  scrollToElement: true,
  waitForIdle: true,
  delay: 100,
  fullPage: false,
  highlightElement: true
};

export const TRUSTED_ORIGIN_SUFFIXES = [
  '.repl.co',
  '.replit.dev',
  '.replit.app',
  '.flowcapture.com',
  '.flowcapture.app'
];

export const TRUSTED_EXACT_ORIGINS = [
  'http://localhost:5000',
  'http://0.0.0.0:5000',
  'https://repl.co',
  'https://replit.dev',
  'https://replit.app',
  'https://flowcapture.com',
  'https://flowcapture.app'
];

export function isOriginTrusted(origin) {
  if (!origin || typeof origin !== 'string') return false;
  
  if (TRUSTED_EXACT_ORIGINS.includes(origin)) return true;
  
  try {
    const url = new URL(origin);
    if (url.protocol === 'https:') {
      return TRUSTED_ORIGIN_SUFFIXES.some(suffix => url.hostname.endsWith(suffix));
    }
    if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '0.0.0.0')) {
      return true;
    }
  } catch {
    return false;
  }
  
  return false;
}
