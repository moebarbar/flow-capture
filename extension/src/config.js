const CONFIG = {
  VERSION: '1.0.1',
  
  API_URLS: {
    production: 'https://flowcapture.replit.app',
    development: 'http://localhost:5000'
  },
  
  // Get the current environment's API URL based on where extension is loaded
  getApiUrl: function() {
    // Check if we have a custom URL stored
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['apiBaseUrl'], (result) => {
          resolve(result.apiBaseUrl || this.API_URLS.production);
        });
      });
    }
    return Promise.resolve(this.API_URLS.production);
  },
  
  ALLOWED_ORIGINS: [
    'https://flowcapture.replit.app',
    'http://localhost:5000',
    'https://localhost:5000'
  ],
  
  ALLOWED_ORIGIN_SUFFIXES: [
    '.replit.dev',
    '.repl.co', 
    '.replit.app',
    '.janeway.replit.dev'
  ],
  
  // Helper to check if an origin is allowed
  isOriginAllowed: function(origin) {
    if (!origin) return false;
    if (this.ALLOWED_ORIGINS.includes(origin)) return true;
    return this.ALLOWED_ORIGIN_SUFFIXES.some(suffix => origin.endsWith(suffix));
  },
  
  DEFAULTS: {
    borderColor: '#ef4444',
    debounceMs: 300
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
