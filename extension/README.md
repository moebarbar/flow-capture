# FlowCapture Chrome Extension

A Chrome extension that captures user interactions and automatically generates step-by-step workflow documentation.

## Features

- **Click Capture**: Records all button, link, and element clicks
- **Input Capture**: Tracks form inputs (with sensitive data masking)
- **Screenshot Capture**: Takes screenshots after each action
- **CSS Selector Generation**: Creates stable selectors for each element
- **Auto-descriptions**: Generates human-readable step descriptions
- **Backend Sync**: Uploads captured workflows to your FlowCapture dashboard

## Installation (Developer Mode)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked"
4. Select the `extension` folder from this project

## Usage

1. Click the FlowCapture extension icon in your browser toolbar
2. **First time only**: Click "Settings" in the footer and enter your dashboard URL
3. Click "Start Recording" to begin capturing
4. Perform the workflow you want to document
5. Click "Stop Recording" when finished
6. Select a workspace and optionally add a title
7. Click "Sync to Dashboard" to save your guide

## Configuration

The extension needs to know which FlowCapture dashboard to sync with:

1. Click the extension icon
2. Click "Settings" link in the footer
3. Enter your dashboard URL (e.g., `https://your-repl.replit.app`)
4. Click "Save"

For local development, use your Replit development URL.

## File Structure

```
extension/
├── manifest.json          # Extension manifest (Manifest V3)
├── popup/
│   ├── popup.html        # Extension popup UI
│   ├── popup.css         # Popup styles
│   └── popup.js          # Popup logic
├── src/
│   ├── background.js     # Service worker (screenshot capture, API sync)
│   ├── content.js        # Content script (event listeners, capture)
│   └── content.css       # Content script styles
└── icons/
    ├── icon16.png        # Toolbar icon
    ├── icon48.png        # Extension management icon
    └── icon128.png       # Chrome Web Store icon
```

## How It Works

### Recording Flow

1. **Start Recording**: User clicks start → popup sends message to background → background notifies all tabs
2. **Capture Events**: Content script listens for clicks, inputs, changes, and form submissions
3. **Generate Step**: For each event, content script generates selector and description
4. **Take Screenshot**: Background service worker captures visible tab
5. **Store Locally**: Steps are stored in `chrome.storage.local`
6. **Stop Recording**: User clicks stop → popup shows sync options
7. **Sync**: Background uploads steps to backend API

### Security

- Sensitive inputs (passwords, SSN, etc.) are automatically masked
- Screenshots are captured via Chrome's built-in API
- All API communication uses HTTPS with credentials

## API Endpoints

The extension communicates with these backend endpoints:

- `GET /api/extension/user` - Get current user info
- `GET /api/extension/workspaces` - List user's workspaces
- `POST /api/extension/sync` - Upload captured workflow

## Permissions

- `activeTab`: Access current tab for screenshot capture
- `storage`: Store captured steps locally
- `tabs`: Query and message tabs
- `<all_urls>`: Inject content script on any page

## Troubleshooting

**"Please log in to sync" error:**
- Make sure you're logged into the FlowCapture web app in your browser
- Verify the Dashboard URL in Settings matches your running app URL

**Steps not capturing:**
- Check that you're not on a chrome:// or extension page (these are restricted)
- Try refreshing the page and starting a new recording

**Sync failing:**
- Ensure your FlowCapture web app is running
- Check the Dashboard URL in Settings is correct (include https://)
- Make sure you have at least one workspace created in the dashboard
