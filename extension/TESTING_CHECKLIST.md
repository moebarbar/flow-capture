# FlowCapture Extension Testing Checklist

A complete guide for testing the FlowCapture Chrome extension. This checklist is designed for testers without development experience.

---

## Prerequisites

Before testing, ensure you have:
- [ ] Chrome browser (version 88 or higher)
- [ ] The extension loaded in Developer Mode
- [ ] Access to the FlowCapture web app
- [ ] A test workspace and guide created

### Loading the Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `extension` folder
5. Note the Extension ID (you'll need this for debugging)

---

## Manual Test Cases

### TC-01: Extension Installation

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Load extension in Chrome | Extension icon appears in toolbar |
| 2 | Click extension icon | Popup opens showing "Not Recording" state |
| 3 | Check permissions | Extension requests necessary permissions |

### TC-02: Start Recording from Web App

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Log into FlowCapture web app | Dashboard loads |
| 2 | Create or open a guide | Guide editor opens |
| 3 | Click "Start Recording" button | Side panel appears on right side of browser |
| 4 | Check popup | Shows "Recording" state with step count |

### TC-03: Capture Click Actions

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start a recording session | Side panel shows "Recording" |
| 2 | Click any button on a webpage | Step captured with title like "Click 'Button Text' Button" |
| 3 | Check side panel | New step appears with screenshot thumbnail |
| 4 | Click on links | Steps show "Click 'Link Text' Link" |

### TC-04: Capture Input Actions

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | During recording, click on a text input | Step shows "Click 'Field Name' Text Field" |
| 2 | Type text into the field | Input captured (if input capture enabled) |
| 3 | Click a checkbox | Step shows "Check 'Label' Checkbox" or "Uncheck..." |
| 4 | Select from dropdown | Step captured with selection action |

### TC-05: Screenshot Capture

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Capture any step | Screenshot thumbnail appears in side panel |
| 2 | Click the thumbnail | Full-size screenshot modal opens |
| 3 | Click outside modal | Modal closes |
| 4 | Check screenshot quality | Image is clear, shows full viewport |

### TC-06: Step Editing

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Hover over a step in side panel | Edit button becomes visible |
| 2 | Click edit button | Title becomes editable input |
| 3 | Change title and press Enter | Title saved, input closes |
| 4 | Change title and press Escape | Original title restored |

### TC-07: Pause and Resume

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | During recording, click Pause | Status shows "Paused", button changes to "Resume" |
| 2 | Click on webpage elements | No new steps captured |
| 3 | Click Resume | Status shows "Recording" |
| 4 | Click on elements | Steps captured again |

### TC-08: Multi-Tab Recording

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start recording on Tab A | Recording active on Tab A |
| 2 | Open new Tab B and navigate | Extension injects into Tab B |
| 3 | Click elements on Tab B | Steps captured from Tab B |
| 4 | Switch back to Tab A | Recording continues on Tab A |

### TC-09: Panel Toggle

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the purple tab on right edge | Panel collapses (slides right) |
| 2 | Click the tab again | Panel expands (slides left) |
| 3 | Refresh the page | Panel state preserved |
| 4 | Navigate to new page | Panel state preserved |

### TC-10: Stop Recording

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Finish" button | Recording stops |
| 2 | Check side panel | Panel may close or show summary |
| 3 | Return to web app | Guide shows all captured steps |
| 4 | Check step sync status | All steps show "Saved" status |

### TC-11: Sync Status Indicators

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Capture a step | Status shows "Queued" then "Syncing" |
| 2 | Wait for sync | Status changes to "Saved" (green) |
| 3 | Check web app | Step appears in guide |

---

## Common Failure Scenarios

### FS-01: Extension Not Injecting

**Symptoms**: Side panel doesn't appear, clicks not captured

**Possible Causes**:
- Page loaded before extension
- Extension lacking permissions
- Page is a Chrome internal page (chrome://, chrome-extension://)

**Test Steps**:
1. Refresh the page
2. Check extension permissions in chrome://extensions
3. Try on a different website

### FS-02: Screenshots Failing

**Symptoms**: Steps appear but no screenshot thumbnail, placeholder icon shown

**Possible Causes**:
- Tab not focused when capture triggered
- Page still loading during capture
- Protected content (DRM videos, certain iframes)

**Test Steps**:
1. Ensure tab is visible and focused
2. Wait for page to fully load
3. Try on a simpler page

### FS-03: Steps Not Syncing

**Symptoms**: Steps show "Pending" or "Failed" status indefinitely

**Possible Causes**:
- Network connectivity issues
- Session expired
- API server unavailable

**Test Steps**:
1. Check internet connection
2. Refresh the web app and check login status
3. Look for "Failed" status and retry

### FS-04: Duplicate Steps

**Symptoms**: Same action appears multiple times

**Possible Causes**:
- Double-click detected as two clicks
- Event bubbling capturing parent and child

**Test Steps**:
1. Note if duplicates have same or different timestamps
2. Check if same selector is captured twice
3. Report with reproduction steps

### FS-05: Wrong Element Captured

**Symptoms**: Step title doesn't match clicked element

**Possible Causes**:
- Click event bubbled to parent element
- Overlay or invisible element intercepted click

**Test Steps**:
1. Check the selector in step details
2. Compare expected vs actual element description
3. Try clicking directly on text/icon of button

### FS-06: Panel Disappears on Navigation

**Symptoms**: Side panel gone after page changes

**Possible Causes**:
- Traditional navigation (not SPA)
- Content script re-injection failed

**Test Steps**:
1. Wait 1-2 seconds after navigation
2. Check if recording is still active (via popup)
3. Panel should auto-reinject

---

## How to Debug Content Scripts

Content scripts run on web pages (side panel, capture agent).

### Accessing Content Script Console

1. Navigate to the webpage being captured
2. Right-click anywhere on the page
3. Select "Inspect" to open DevTools
4. Go to the "Console" tab
5. Look for messages starting with `[FlowCapture]`

### Filtering Logs

In the Console, use the filter box to search:
- `[FlowCapture]` - All extension logs
- `[FlowCapture] Step` - Step capture events
- `[FlowCapture] Panel` - Side panel events
- `error` - Error messages only

### Common Content Script Issues

| Log Message | Meaning |
|-------------|---------|
| "Content script injected" | Extension loaded on page |
| "Step captured: X" | Click/action was detected |
| "Port disconnected" | Lost connection to background |
| "Screenshot capture failed" | Screenshot API error |

### Checking Side Panel State

1. In DevTools, go to Elements tab
2. Search for `flowcapture-side-panel-host`
3. Expand to see shadow DOM content
4. Verify panel structure is intact

---

## How to Debug Background Service Worker

The service worker manages state and communication.

### Accessing Service Worker Console

1. Go to `chrome://extensions`
2. Find FlowCapture extension
3. Click "Service Worker" link (under "Inspect views")
4. DevTools opens for the service worker
5. Check Console tab for logs

### Key Log Messages

| Log Message | Meaning |
|-------------|---------|
| "State: IDLE -> CAPTURING" | Recording started |
| "State: CAPTURING -> PAUSED" | Recording paused |
| "Step captured: N, selector" | Step received from content |
| "[SyncManager] Step synced" | Step saved to server |
| "[SyncManager] Back online" | Network recovered |

### Checking Current State

In the service worker console, type:
```javascript
machine.getState()
```

This shows:
- `status`: Current state (IDLE, CAPTURING, PAUSED, SYNCING)
- `stepCount`: Number of steps captured
- `steps`: Recent steps array
- `isOnline`: Network connectivity status

### Forcing a Sync

In the service worker console:
```javascript
syncManager.flush()
```

### Viewing Sync Queue

```javascript
syncManager.getStats()
```

Shows pending items, synced count, online status.

---

## How to Prevent Regressions

### Before Each Test Session

1. [ ] Clear extension storage: chrome://extensions > FlowCapture > Details > "Clear data"
2. [ ] Reload extension: Click the refresh icon
3. [ ] Close all tabs except one test tab
4. [ ] Log out and log back into web app

### Test Coverage Checklist

Run these tests after any update:

**Core Functionality**
- [ ] TC-02: Start from web app
- [ ] TC-03: Click capture
- [ ] TC-05: Screenshot capture
- [ ] TC-10: Stop recording
- [ ] TC-11: Sync status

**Edge Cases**
- [ ] TC-08: Multi-tab
- [ ] TC-07: Pause/Resume
- [ ] FS-03: Offline sync

### Regression Test Matrix

| Test Area | Chrome 120+ | Chrome 100-119 | Incognito |
|-----------|-------------|----------------|-----------|
| Start Recording | | | |
| Click Capture | | | |
| Screenshots | | | |
| Sync to Server | | | |
| Panel Toggle | | | |

### Reporting Issues

When reporting a bug, include:

1. **Chrome Version**: Help > About Google Chrome
2. **Extension Version**: chrome://extensions > FlowCapture
3. **Steps to Reproduce**: Numbered list of actions
4. **Expected Result**: What should happen
5. **Actual Result**: What actually happened
6. **Console Logs**: From content script AND service worker
7. **Screenshots**: Of the issue if visual

### Test Data Cleanup

After testing:
1. Delete test guides from web app
2. Clear extension data if needed
3. Disable/remove extension if not needed

---

## Quick Reference

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Alt+Shift+R | Toggle recording (if enabled) |
| Escape | Cancel title edit |
| Enter | Save title edit |

### Status Colors

| Color | Status | Meaning |
|-------|--------|---------|
| Yellow | Pending | Waiting to sync |
| Blue | Queued | In sync queue |
| Light Blue | Syncing | Currently uploading |
| Green | Saved | Successfully synced |
| Red | Failed | Sync failed |

### Extension Pages

| URL | Purpose |
|-----|---------|
| chrome://extensions | Manage extension |
| chrome://extensions/?id=XXX | Extension details |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | - | Initial release |

---

*Last updated: January 2025*
