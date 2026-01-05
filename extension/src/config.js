const CONFIG = {
  VERSION: '1.0.0',
  
  API_URLS: {
    production: 'https://flowcapture.replit.app',
    development: 'http://localhost:5000'
  },
  
  ALLOWED_ORIGINS: [
    'https://flowcapture.replit.app',
    'http://localhost:5000',
    'https://localhost:5000'
  ],
  
  ALLOWED_ORIGIN_SUFFIXES: [
    '.replit.dev',
    '.repl.co', 
    '.replit.app'
  ],
  
  DEFAULTS: {
    borderColor: '#ef4444',
    debounceMs: 300
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
