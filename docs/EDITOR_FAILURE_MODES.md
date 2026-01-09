# Editor Failure Modes

Complete catalog of what can go wrong, what users see, and what they can do about it.

---

## Failure Response Philosophy

```
EVERY FAILURE MUST:
├── Be visible (never silent)
├── Be explained (in plain language)
├── Have an action (never a dead end)
├── Preserve data (never lose work)
└── Allow continuation (never block completely)
```

---

## 1. Capture Stops Unexpectedly

### 1.1 Page Navigation Away

```
TRIGGER:
├── User navigates to a new domain
├── Page redirects unexpectedly
├── User closes the captured tab
└── Page crashes or becomes unresponsive

WHAT USER SEES:
┌─────────────────────────────────────────────────────────────────┐
│  ⚠  CAPTURE INTERRUPTED                                        │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  You left the page you were recording.                          │
│                                                                 │
│  Your 12 captured steps are safe.                               │
│                                                                 │
│  What would you like to do?                                     │
│                                                                 │
│  [Continue on New Page]  [Finish Recording]  [Go Back]          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

ACTIONS AVAILABLE:
├── Continue on New Page: Resume capture on current page
├── Finish Recording: Stop and save what was captured
├── Go Back: Return to original page (if possible)
└── Automatic: Steps already captured are preserved

WHAT IS PREVENTED:
├── Silent loss of captured steps
├── Automatic stop without user consent
├── Confusion about capture state
└── Data loss from navigation
```

### 1.2 Content Script Disconnected

```
TRIGGER:
├── Page does full refresh
├── SPA navigation clears script context
├── Browser garbage collects inactive script
└── Extension update while capturing

WHAT USER SEES:
┌─────────────────────────────────────────────────────────────────┐
│  ⚠  CONNECTION LOST                                            │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  We lost connection to the page.                                │
│  This usually happens after a page refresh.                     │
│                                                                 │
│  Your 12 captured steps are safe.                               │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ⟳  Attempting to reconnect...                            │  │
│  │     Retry 2 of 5                                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [Reconnect Now]  [Finish Recording]                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

ACTIONS AVAILABLE:
├── Reconnect Now: Force immediate reconnection attempt
├── Finish Recording: Save what was captured
├── Wait: Auto-reconnect runs every 3 seconds
└── Refresh Page: User can manually refresh and reconnect

WHAT IS PREVENTED:
├── Capture continuing without connection (false recording)
├── Steps captured but not saved
├── User thinking capture is working when it's not
└── Permanent connection loss without recovery option
```

### 1.3 Extension Disabled Mid-Capture

```
TRIGGER:
├── User disables extension in chrome://extensions
├── Chrome disables extension (policy)
├── Extension crashes
└── Browser update requires extension restart

WHAT USER SEES:
┌─────────────────────────────────────────────────────────────────┐
│  ✗  EXTENSION STOPPED                                          │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  The FlowCapture extension was disabled or stopped.             │
│                                                                 │
│  Your 8 captured steps are saved locally.                       │
│  Screenshots may be incomplete for recent steps.                │
│                                                                 │
│  To continue:                                                   │
│  1. Re-enable the extension in Chrome settings                  │
│  2. Refresh this page                                           │
│  3. Resume your recording                                       │
│                                                                 │
│  [Open Extension Settings]  [Download Steps Locally]            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

ACTIONS AVAILABLE:
├── Open Extension Settings: Direct link to chrome://extensions
├── Download Steps Locally: Export captured data as JSON
├── After re-enable: Can resume or start fresh
└── Web app access: Can edit saved steps in platform

WHAT IS PREVENTED:
├── Complete data loss (local backup exists)
├── User stuck without recovery path
├── Silent failure with no explanation
└── Orphaned capture session
```

### 1.4 Browser Tab Crashes

```
TRIGGER:
├── Tab runs out of memory
├── Page JavaScript crashes
├── Browser kills unresponsive tab
└── System-level crash affects Chrome

WHAT USER SEES (on extension popup or platform):
┌─────────────────────────────────────────────────────────────────┐
│  ✗  TAB CRASHED                                                 │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  The page you were recording crashed unexpectedly.              │
│                                                                 │
│  Good news: We saved 10 of your 12 steps.                       │
│  The last 2 steps may not have screenshots.                     │
│                                                                 │
│  [View Saved Steps]  [Start New Recording]                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

ACTIONS AVAILABLE:
├── View Saved Steps: Open captured guide in editor
├── Start New Recording: Begin fresh capture
├── Platform shows: Incomplete guide with note
└── Can manually add missing steps

WHAT IS PREVENTED:
├── Total loss (periodic saves to IndexedDB)
├── Confusion about what was captured
├── Orphaned session without cleanup
└── User wondering if data was saved
```

---

## 2. Screenshot Fails

### 2.1 Screenshot Permission Denied

```
TRIGGER:
├── First capture on sensitive page
├── Chrome blocks screenshot API
├── User denied permission previously
└── Enterprise policy restricts screenshots

WHAT USER SEES:
┌─────────────────────────────────────────────────────────────────┐
│  ⚠  SCREENSHOT BLOCKED                                         │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  Chrome prevented us from capturing a screenshot.               │
│  This happens on sensitive pages (like Chrome settings          │
│  or banking sites) for your security.                           │
│                                                                 │
│  Your step was captured:                                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  5  [No image]  Click 'Account Settings'                  │  │
│  │                 Opens account settings page               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [Continue Without Screenshots]  [Add Image Manually Later]     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

ACTIONS AVAILABLE:
├── Continue Without Screenshots: Capture proceeds, no images
├── Add Image Manually Later: Upload screenshot in editor
├── Step data still captured: Title, description, selector saved
└── Navigate away: Try again on different page

WHAT IS PREVENTED:
├── Capture stopping entirely
├── User forced to grant risky permissions
├── Loss of step metadata (only image missing)
└── Blocking workflow for cosmetic issue
```

### 2.2 Screenshot Capture Timeout

```
TRIGGER:
├── Page is extremely large/complex
├── Many images still loading
├── Browser under heavy load
└── Network issues affecting page render

WHAT USER SEES:
┌─────────────────────────────────────────────────────────────────┐
│  ⚠  SCREENSHOT SLOW                                            │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  Step 8 screenshot is taking longer than usual.                 │
│  The page may still be loading.                                 │
│                                                                 │
│  ⟳  Waiting... (12 seconds)                                    │
│                                                                 │
│  [Wait Longer]  [Skip This Screenshot]  [Retry]                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

ACTIONS AVAILABLE:
├── Wait Longer: Extend timeout to 30 seconds
├── Skip This Screenshot: Continue capture, no image for this step
├── Retry: Attempt screenshot again immediately
└── Automatic: Retry 2x before showing this dialog

WHAT IS PREVENTED:
├── Infinite waiting without user control
├── Capture blocked by one slow screenshot
├── False success (step saved without image)
└── User uncertainty about what's happening
```

### 2.3 Screenshot Corrupted/Empty

```
TRIGGER:
├── Capture API returns invalid data
├── Page in weird render state
├── GPU acceleration issue
└── Browser memory pressure

WHAT USER SEES:
┌────────────────────────────────────────────────────────────────┐
│  6  ┌────────┐  Click 'Dashboard' Link                         │
│     │   ⚠    │  Navigate to the main dashboard                 │
│     │ Image  │                                                  │
│     │ Error  │  ⚠ Screenshot didn't capture correctly          │
│     └────────┘    [Retry]  [Skip]                              │
└────────────────────────────────────────────────────────────────┘

ACTIONS AVAILABLE:
├── Retry: Attempt screenshot again
├── Skip: Continue without image
├── Later: Add image manually in editor
└── Continue: Capture proceeds regardless

WHAT IS PREVENTED:
├── Displaying broken/empty image
├── Uploading corrupted data
├── Silent failure (user thinks it worked)
└── Step being skipped entirely
```

### 2.4 Screenshot Upload Failed

```
TRIGGER:
├── Network error during upload
├── Server rejected file (too large, wrong format)
├── Authentication expired
└── Storage quota exceeded

WHAT USER SEES:
┌─────────────────────────────────────────────────────────────────┐
│  ⚠  SCREENSHOT COULDN'T UPLOAD                                 │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  Step 8 screenshot is saved locally but couldn't                │
│  upload to the cloud.                                           │
│                                                                 │
│  Reason: Connection timed out                                   │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ⟳  Retrying... (attempt 3 of 5)                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [Retry Now]  [Skip Upload]  [Continue Capturing]               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

ACTIONS AVAILABLE:
├── Retry Now: Force immediate retry
├── Skip Upload: Mark as local-only for now
├── Continue Capturing: Capture proceeds, upload queued
└── Background: Auto-retry with exponential backoff

WHAT IS PREVENTED:
├── Screenshot data loss (saved locally)
├── Blocking capture for upload issues
├── Silent failure (visible queue status)
└── Permanent loss if network returns
```

---

## 3. Platform Disconnects

### 3.1 Network Connection Lost

```
TRIGGER:
├── WiFi disconnected
├── Airplane mode enabled
├── ISP outage
└── VPN disconnected

WHAT USER SEES:
┌─────────────────────────────────────────────────────────────────┐
│  ○  YOU'RE OFFLINE                                              │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  Your internet connection was lost.                             │
│                                                                 │
│  Don't worry:                                                   │
│  ✓  Capture continues working                                   │
│  ✓  Steps are saved on this device                              │
│  ✓  Everything syncs when you're back online                    │
│                                                                 │
│  Steps waiting to sync: 3                                       │
│                                                                 │
│  [Continue Offline]  [Check Connection]                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

ACTIONS AVAILABLE:
├── Continue Offline: Keep capturing, sync later
├── Check Connection: Test network and retry
├── Automatic: Resync when online detected
└── All features: Capture, edit, annotate work offline

WHAT IS PREVENTED:
├── Capture stopping due to network
├── Data loss (IndexedDB backup)
├── Sync conflicts (queued properly)
└── User panic about lost work
```

### 3.2 Platform Server Unreachable

```
TRIGGER:
├── FlowCapture server down
├── CDN issues
├── DNS problems
├── Firewall blocking

WHAT USER SEES:
┌─────────────────────────────────────────────────────────────────┐
│  ⚠  SERVER UNAVAILABLE                                         │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  We can't reach the FlowCapture server right now.               │
│  Our team has been notified.                                    │
│                                                                 │
│  Your work is safe:                                             │
│  ✓  Steps saved locally (12 steps)                              │
│  ✓  Screenshots saved locally (10 images)                       │
│  ✓  Will sync automatically when server is back                 │
│                                                                 │
│  [Check Status Page]  [Continue Working]  [Export Backup]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

ACTIONS AVAILABLE:
├── Check Status Page: View status.flowcapture.io
├── Continue Working: Keep using editor offline
├── Export Backup: Download all data as JSON/ZIP
└── Automatic: Retry every 30 seconds

WHAT IS PREVENTED:
├── Work loss during outage
├── User blocked from continuing
├── No explanation of what's wrong
└── No recovery options
```

### 3.3 Authentication Expired

```
TRIGGER:
├── Session timeout
├── User logged in elsewhere
├── Token revoked (password change)
├── Account status changed

WHAT USER SEES:
┌─────────────────────────────────────────────────────────────────┐
│  🔒  SESSION EXPIRED                                            │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  You've been signed out.                                        │
│  This can happen if you signed in on another device.            │
│                                                                 │
│  Your unsaved work:                                             │
│  ✓  5 steps saved locally                                       │
│  ✓  Will sync after you sign back in                            │
│                                                                 │
│  [Sign In Again]  [Save Work Locally First]                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

ACTIONS AVAILABLE:
├── Sign In Again: Re-authenticate and resume
├── Save Work Locally First: Export before signing in
├── After sign in: Pending work syncs automatically
└── Capture: Can continue offline until sign in

WHAT IS PREVENTED:
├── Automatic sign out losing work
├── No way to save before re-auth
├── Confusion about account state
└── Data stuck in limbo
```

### 3.4 WebSocket Connection Dropped

```
TRIGGER:
├── Load balancer timeout
├── Proxy disconnection
├── Network instability
├── Server restart

WHAT USER SEES:
┌─────────────────────────────────────────────────────────────────┐
│  ⟳  RECONNECTING...                                            │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  Lost connection to sync server.                                │
│  Attempting to reconnect...                                     │
│                                                                 │
│  ████████░░░░░░░░░░░░  Retry 2 of 5                             │
│                                                                 │
│  Your work is saved locally and will sync when connected.       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

IF RECONNECTION FAILS:
┌─────────────────────────────────────────────────────────────────┐
│  ⚠  CONNECTION FAILED                                          │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  Couldn't reconnect to sync server after 5 attempts.            │
│                                                                 │
│  Real-time sync is paused. Your work will sync                  │
│  when connection is restored.                                   │
│                                                                 │
│  [Try Again]  [Continue Offline]                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

ACTIONS AVAILABLE:
├── Try Again: Force reconnection attempt
├── Continue Offline: Work with local saves
├── Automatic: Background reconnect every 30s
└── Page refresh: Often resolves connection issues

WHAT IS PREVENTED:
├── Silent sync failures
├── Conflicting edits going unnoticed
├── Real-time collaboration breaking silently
└── User thinking they're synced when not
```

---

## 4. Extension Reloads

### 4.1 Extension Updated by Chrome

```
TRIGGER:
├── Chrome auto-updates extension
├── Developer reloads extension
├── Extension re-enabled after disable
└── Chrome restarts with extension running

WHAT USER SEES:
┌─────────────────────────────────────────────────────────────────┐
│  ⟳  EXTENSION UPDATED                                          │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  FlowCapture was updated to a new version.                      │
│                                                                 │
│  Your recording session was preserved:                          │
│  ✓  8 steps captured                                            │
│  ✓  All screenshots saved                                       │
│                                                                 │
│  Refresh the page to continue capturing.                        │
│                                                                 │
│  [Refresh Page]  [Finish Recording]  [View Steps]               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

ACTIONS AVAILABLE:
├── Refresh Page: Reload page and resume capture
├── Finish Recording: Save current session as-is
├── View Steps: Open editor to see captured steps
└── Automatic: Session state preserved in storage

WHAT IS PREVENTED:
├── Lost recording session
├── Steps captured but not accessible
├── Need to start completely over
└── Confusion about extension state
```

### 4.2 Service Worker Terminated

```
TRIGGER:
├── Chrome kills idle service worker (30s timeout)
├── Memory pressure causes eviction
├── Too many extensions running
└── Browser crash recovery

WHAT USER SEES (when trying to capture):
┌─────────────────────────────────────────────────────────────────┐
│  ⟳  WAKING UP...                                                │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  The extension was sleeping to save memory.                     │
│  Starting it back up...                                         │
│                                                                 │
│  ████████████████████  Ready!                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

This is usually transparent (< 1 second).

IF WAKE FAILS:
┌─────────────────────────────────────────────────────────────────┐
│  ⚠  EXTENSION NOT RESPONDING                                   │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  The extension isn't responding. This can happen after          │
│  Chrome updates or if too many extensions are running.          │
│                                                                 │
│  Try these steps:                                               │
│  1. Click the FlowCapture extension icon                        │
│  2. If that doesn't work, restart Chrome                        │
│                                                                 │
│  Your previous work is saved in the cloud.                      │
│                                                                 │
│  [Open Extension]  [Restart Chrome]                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

ACTIONS AVAILABLE:
├── Open Extension: Click extension icon to wake it
├── Restart Chrome: Nuclear option, always works
├── Previous work: Accessible from platform
└── After restart: Can resume or start fresh

WHAT IS PREVENTED:
├── Permanent extension breakage
├── Lost access to saved work
├── No explanation of the issue
└── User stuck without next steps
```

### 4.3 Content Script Injection Failed

```
TRIGGER:
├── Page loaded before extension ready
├── Page security policy blocks injection
├── Chrome internal pages (chrome://)
├── PDF or special file types

WHAT USER SEES:
┌─────────────────────────────────────────────────────────────────┐
│  ✗  CAN'T CAPTURE THIS PAGE                                    │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  FlowCapture can't run on this type of page.                    │
│                                                                 │
│  Pages we can't capture:                                        │
│  • Chrome settings and internal pages                           │
│  • Other extensions' pages                                      │
│  • PDF files opened in browser                                  │
│  • Pages with strict security policies                          │
│                                                                 │
│  Navigate to a regular website to start capturing.              │
│                                                                 │
│  [Try Different Page]  [Why Can't I Capture Here?]              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

ACTIONS AVAILABLE:
├── Try Different Page: Navigate to capturable page
├── Learn More: Explanation of browser restrictions
├── Note: Most regular websites work fine
└── Workaround: Some pages work after refresh

WHAT IS PREVENTED:
├── User trying repeatedly on blocked page
├── Confusion about why it doesn't work
├── False expectation that all pages work
└── Silent failure with no feedback
```

---

## 5. Data Integrity Failures

### 5.1 Local Storage Full

```
TRIGGER:
├── IndexedDB quota exceeded
├── Too many cached screenshots
├── Browser storage limit reached
└── Other extensions consuming storage

WHAT USER SEES:
┌─────────────────────────────────────────────────────────────────┐
│  ⚠  STORAGE FULL                                               │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  Your browser's storage is full.                                │
│  FlowCapture can't save new captures locally.                   │
│                                                                 │
│  You can:                                                       │
│  1. Clear old FlowCapture data (we'll keep recent work)         │
│  2. Make sure you're online so captures sync immediately        │
│                                                                 │
│  Your current session (12 steps) is safe.                       │
│                                                                 │
│  [Clear Old Data]  [Continue (Online Only)]                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

ACTIONS AVAILABLE:
├── Clear Old Data: Remove old cached data (keeps recent)
├── Continue Online: Capture with immediate sync (no local cache)
├── Current session: Already in memory, will sync
└── Settings: Manage storage in extension options

WHAT IS PREVENTED:
├── Capture failing silently
├── New captures overwriting important data
├── User unaware of storage issue
└── Complete capture breakdown
```

### 5.2 Data Corruption Detected

```
TRIGGER:
├── IndexedDB read error
├── JSON parse failure
├── Incomplete write (crash during save)
├── Browser storage bug

WHAT USER SEES:
┌─────────────────────────────────────────────────────────────────┐
│  ⚠  DATA ISSUE DETECTED                                        │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  Some local data couldn't be read correctly.                    │
│                                                                 │
│  Affected: Guide "User Registration" - 2 steps may be           │
│  incomplete locally.                                            │
│                                                                 │
│  ✓  Your cloud data is unaffected                               │
│  ✓  We'll use the cloud version instead                         │
│                                                                 │
│  [Use Cloud Version]  [Try to Recover Local]                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

ACTIONS AVAILABLE:
├── Use Cloud Version: Discard corrupt local, use synced data
├── Try to Recover: Attempt to salvage local data
├── Automatic: Cloud sync provides backup
└── Report: Option to send diagnostic data

WHAT IS PREVENTED:
├── Displaying corrupted data
├── Syncing corruption to cloud
├── User unaware of data issues
└── Permanent data loss (cloud backup)
```

---

## Quick Reference Table

| Failure | User Sees | Primary Action | Data Status |
|---------|-----------|----------------|-------------|
| Page navigation | "Capture interrupted" | Continue / Finish | ✓ Preserved |
| Script disconnect | "Connection lost" | Reconnect | ✓ Preserved |
| Extension disabled | "Extension stopped" | Re-enable | ✓ Local backup |
| Tab crash | "Tab crashed" | View saved | ⚠ Partial (last 2 steps may be lost) |
| Screenshot blocked | "Screenshot blocked" | Continue without | ✓ Step data saved |
| Screenshot timeout | "Screenshot slow" | Wait / Skip | ✓ Step data saved |
| Screenshot corrupt | "Image error" | Retry / Skip | ✓ Step data saved |
| Upload failed | "Couldn't upload" | Retry | ✓ Local backup |
| Offline | "You're offline" | Continue offline | ✓ Local queue |
| Server down | "Server unavailable" | Continue working | ✓ Local backup |
| Session expired | "Session expired" | Sign in again | ✓ Local preserved |
| WebSocket dropped | "Reconnecting" | Wait / Try again | ✓ Syncs on reconnect |
| Extension updated | "Extension updated" | Refresh page | ✓ Session preserved |
| Service worker killed | "Waking up" | (automatic) | ✓ No impact |
| Injection failed | "Can't capture this page" | Try different page | N/A |
| Storage full | "Storage full" | Clear old data | ⚠ New saves blocked |
| Data corruption | "Data issue" | Use cloud version | ✓ Cloud backup |

---

## Design Principles Summary

```
1. NEVER SILENT
   └── Every failure has visible feedback

2. NEVER BLOCKING  
   └── User can always continue somehow

3. NEVER LOSING
   └── Data preserved at multiple levels

4. ALWAYS ACTIONABLE
   └── Every error has a next step

5. ALWAYS HONEST
   └── Plain language, no jargon

6. ALWAYS RECOVERABLE
   └── Multiple paths back to success
```

---

*The measure of a good error handling system isn't how rarely errors occur—it's how confident users feel when they do.*
