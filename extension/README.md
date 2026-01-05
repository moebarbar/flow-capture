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

---

## Building for Chrome Web Store

### Step 1: Run the Build Script

```bash
node extension/scripts/build.cjs
```

This creates a ZIP file at `extension/dist/flowcapture-extension.zip`.

### Step 2: Prepare Store Listing Assets

You'll need:
- **Screenshots**: At least one 1280x800 or 640x400 screenshot
- **Promotional images** (optional): 440x280 small tile, 920x680 large tile
- **Privacy Policy URL**: A public webpage explaining data handling

### Step 3: Create Developer Account

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay the one-time $5 developer registration fee
3. Complete identity verification if required

### Step 4: Submit Extension

1. Click "New Item" in the Developer Dashboard
2. Upload the ZIP file from `extension/dist/`
3. Fill in store listing:
   - **Name**: FlowCapture - Workflow Documentation
   - **Description**: See suggested description below
   - **Category**: Productivity
   - **Language**: English (or your target language)
4. Upload screenshots and promotional images
5. Complete the Privacy Practices section
6. Submit for review (typically 1-3 business days)

### Suggested Store Description

```
FlowCapture automatically captures your browser workflows and creates beautiful step-by-step documentation.

FEATURES:
- One-click recording - Start capturing any workflow instantly
- Automatic screenshots - Every click and action is documented
- Smart descriptions - AI generates clear instructions for each step
- Easy editing - Drag, drop, and refine your guides
- Team sharing - Collaborate on documentation with your team

PERFECT FOR:
- Training new employees
- Creating SOPs and process docs
- Customer support tutorials
- Software documentation
- Personal workflow notes

HOW IT WORKS:
1. Click the extension icon and start recording
2. Perform your workflow as usual
3. Stop recording and your guide is ready
4. Edit, share, or export your documentation

FlowCapture connects to your FlowCapture dashboard where you can organize, edit, and share all your guides.

Privacy: This extension captures screenshots only during active recording sessions. Data is sent securely to your FlowCapture account. No data is collected when recording is off.
```

---

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
│   ├── content.css       # Content script styles
│   └── config.js         # Configuration constants
├── scripts/
│   └── build.cjs         # Build script for Chrome Web Store
├── dist/                  # Build output (gitignored)
│   └── flowcapture-extension.zip
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
- Origin validation prevents unauthorized message handling

## API Endpoints

The extension communicates with these backend endpoints:

- `GET /api/extension/user` - Get current user info
- `GET /api/extension/workspaces` - List user's workspaces
- `POST /api/extension/sync` - Upload captured workflow
- `POST /api/capture/step` - Real-time step capture with Bearer token auth

## Permissions

- `activeTab`: Access current tab for screenshot capture
- `storage`: Store captured steps locally
- `tabs`: Query and message tabs
- `scripting`: Inject content scripts dynamically
- `<all_urls>`: Inject content script on any page (required for workflow capture)

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

**Extension not appearing:**
- Reload the extension from chrome://extensions
- Check for console errors in the extension's service worker
