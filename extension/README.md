# FlowCapture Chrome Extension

Records browser workflows (clicks, inputs, navigation) and turns them into
step-by-step guides in the FlowCapture web app. Manifest V3.

## Architecture

```
manifest.json              Manifest V3 config
background/
  service-worker.js        Orchestrator: capture state machine, screenshot
                           capture + element-crop, tab injection, batch upload
  sync-manager.js          Auth (Bearer/cookie), persistent offline upload queue
content/
  capture-agent.js         DOM event capture, selector generation, step metadata,
                           overlay injection, web-app postMessage bridge
  screenshot-agent.js      Scroll-into-view + stabilization helpers
  side-panel.js            Sticky in-page Shadow-DOM progress panel (SPA-safe)
  tab-bridge.js            Reconnecting port helper
overlay/overlay.js         In-page control panel + step preview (page context)
popup/                     Toolbar popup UI (start/stop capture)
tab-selector/              Standalone tab-picker page
shared/                    messages.js (message/port/state enums), storage.js,
                           types.js (trusted origins)
icons/
```

## Capture flow

1. User clicks the toolbar icon then Start in the popup.
2. Popup calls `POST /api/extension/start-capture`, receiving
   `{ guideId, workspaceId, extensionToken }`, then shows a tab picker.
3. The service worker injects content scripts into the chosen tab and moves to
   the CAPTURING state.
4. Each click/input is captured with a cropped, click-indicator-annotated
   screenshot. Steps are held locally (local-first) during capture.
5. On Complete, screenshots + steps are batch-uploaded through the SyncManager
   queue (retry with backoff), then the tab is redirected to the guide editor.

## Backend & auth

- Default API origin: `https://flow-capture-production.up.railway.app` (see
  `DEFAULT_API_ORIGIN` in `background/service-worker.js`; localhost allowed for
  dev). Only these pinned origins are trusted: a page-supplied `apiBaseUrl` is
  validated against the allowlist before the bearer token is ever attached.
- Auth: a Bearer `extensionToken` (preferred) or session cookie. The token is
  revocable server-side (bumped on logout / password reset).

## Permissions

`activeTab`, `scripting`, `storage`, `tabs`, plus optional `<all_urls>` host
permission requested from a user gesture at capture start.

## Build

```
node scripts/build.cjs
```

Produces `dist/flowcapture-extension.zip` for the Chrome Web Store. The build
fails if any packaged path is missing (guards against shipping a broken zip).

## Local development

1. `chrome://extensions` then enable Developer mode, Load unpacked, and select
   this `extension/` directory.
2. Run the web app locally on `http://localhost:5000`.
3. Reload the extension after edits (content-script changes also need the target
   tab reloaded).

See `TESTING_CHECKLIST.md` for the manual QA matrix.
