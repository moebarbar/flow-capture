# Platform Sync Feedback

How the editor communicates sync state so users always know their data is safe.

---

## Core Principle

```
USERS MUST NEVER WONDER:
├── "Did my work save?"
├── "Is this synced to the cloud?"
├── "Will I lose this if I close the tab?"
└── "What happens if my internet drops?"

THE ANSWER IS ALWAYS VISIBLE.
```

---

## Sync Status Overview

### Global Sync Indicator

```
LOCATION: Bottom of side panel, always visible

SYNCED (all good):
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ✓  All changes saved                            Just now      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

SYNCING (active upload):
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ⟳  Saving changes...                            2 pending     │
│     ████████████████░░░░░░░░                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

PENDING (queued):
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ◐  Changes waiting to sync                      5 pending     │
│     Will save when online                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

ERROR (needs attention):
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ⚠  Some changes couldn't save                   3 failed      │
│     [Retry Now]  [View Details]                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step Sync Confirmations

### Individual Step States

```
CAPTURED (not yet synced):
┌────────────────────────────────────────────────────────────────┐
│  12  [thumb]  Click 'Submit' Button                        ◐   │
│               Submits the registration form                    │
│                                                            │   │
│                                               Saving...    │   │
└────────────────────────────────────────────────────────────────┘
                                                             │
                                                             └─ Pending indicator

SYNCED (confirmed saved):
┌────────────────────────────────────────────────────────────────┐
│  12  [thumb]  Click 'Submit' Button                        ✓   │
│               Submits the registration form                    │
│                                                                │
│                                               Saved ✓          │
└────────────────────────────────────────────────────────────────┘
                                                             │
                                                             └─ Synced indicator
                                                                (fades after 3s)

MODIFIED (local changes):
┌────────────────────────────────────────────────────────────────┐
│  12  [thumb]  Click 'Submit' Button                        ●   │
│               Updated description...                           │
│                                                            │   │
│                                               Unsaved      │   │
└────────────────────────────────────────────────────────────────┘
                                                             │
                                                             └─ Modified indicator
                                                                (blue dot)

FAILED (couldn't sync):
┌────────────────────────────────────────────────────────────────┐
│  12  [thumb]  Click 'Submit' Button                        ⚠   │
│               Submits the registration form                    │
│                                                                │
│               ⚠ Couldn't save · [Retry]                        │
└────────────────────────────────────────────────────────────────┘
```

### Sync Indicator Legend

```
INDICATORS:
├── ✓  Synced and confirmed
├── ◐  Syncing in progress
├── ●  Modified, not yet synced
├── ⚠  Failed to sync
└── ○  Not synced (offline)

TIMING:
├── ✓ appears immediately on server confirmation
├── ✓ fades after 3 seconds (clean UI)
├── ◐ shows during active upload
├── ● appears instantly on user edit
└── ⚠ appears after retry exhaustion
```

---

## Pending Uploads Queue

### Queue Visibility

```
WHEN ITEMS PENDING:
┌─────────────────────────────────────────────────────────────────┐
│  SYNC QUEUE                                         [Collapse] │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ⟳  Uploading                                             │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │  Step 12 screenshot                    1.2 MB  ████░░ 67% │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ◐  Waiting                                               │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │  Step 13 data                                    Queued   │  │
│  │  Step 13 screenshot                   0.8 MB     Queued   │  │
│  │  Step 14 data                                    Queued   │  │
│  │  Step 14 screenshot                   1.1 MB     Queued   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Total pending: 5 items (3.1 MB)                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Queue States

```
EMPTY QUEUE (ideal state):
No queue UI shown. Global indicator says "All changes saved."

SMALL QUEUE (1-3 items):
Compact indicator, no expanded view unless clicked.
┌─────────────────────────────────────────────────────────────────┐
│  ⟳  Saving 2 items...                                          │
└─────────────────────────────────────────────────────────────────┘

MEDIUM QUEUE (4-10 items):
Shows count, optional expand to see details.
┌─────────────────────────────────────────────────────────────────┐
│  ⟳  Saving changes...                            7 pending  ▸  │
└─────────────────────────────────────────────────────────────────┘

LARGE QUEUE (10+ items):
Suggests pausing capture to let sync catch up.
┌─────────────────────────────────────────────────────────────────┐
│  ⚠  Sync is falling behind                       15 pending    │
│     Consider pausing to let uploads finish                      │
│     [Pause Capture]  [Continue Anyway]                          │
└─────────────────────────────────────────────────────────────────┘
```

### Upload Progress Details

```
EXPANDED QUEUE ITEM:
┌───────────────────────────────────────────────────────────────┐
│  Step 12: Click 'Submit' Button                               │
│  ─────────────────────────────────────────────────────────    │
│                                                               │
│  Screenshot uploading...                                      │
│  ████████████████████████████░░░░░░░░░░░░  67%                │
│                                                               │
│  Size: 1.2 MB                                                 │
│  Speed: 340 KB/s                                              │
│  Remaining: ~2 seconds                                        │
│                                                               │
│  [Cancel Upload]                                              │
└───────────────────────────────────────────────────────────────┘
```

---

## Failed Retries

### Retry Behavior

```
RETRY STRATEGY:
├── Attempt 1: Immediate
├── Attempt 2: After 1 second
├── Attempt 3: After 2 seconds
├── Attempt 4: After 4 seconds
├── Attempt 5: After 8 seconds (max)
└── After 5 failures: Show error, require manual retry

DURING RETRIES:
┌───────────────────────────────────────────────────────────────┐
│  Step 12 screenshot                                           │
│  ─────────────────────────────────────────────────────────    │
│  ⟳  Retrying... (attempt 3 of 5)                              │
│     Last error: Server timeout                                │
│     Next retry in 4 seconds                                   │
└───────────────────────────────────────────────────────────────┘
```

### Failed Upload UI

```
INDIVIDUAL FAILED ITEM:
┌───────────────────────────────────────────────────────────────┐
│  ⚠  FAILED UPLOADS                               3 items      │
│  ═══════════════════════════════════════════════════════════  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  ✗  Step 8 screenshot                                   │  │
│  │     Server couldn't process image                       │  │
│  │     [Retry]  [Re-capture Screenshot]  [Skip]            │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  ✗  Step 12 data                                        │  │
│  │     Connection timed out                                │  │
│  │     [Retry]  [Skip]                                     │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  ✗  Step 12 screenshot                                  │  │
│  │     Connection timed out                                │  │
│  │     [Retry]  [Skip]                                     │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  [Retry All]  [Skip All]  [Export Locally]                    │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Failure Reasons (Plain Language)

```
TECHNICAL ERROR          PLAIN LANGUAGE MESSAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ETIMEDOUT                "Connection timed out"
                         "The upload took too long. Try again."

ECONNRESET               "Connection was interrupted"
                         "The upload was cut off. Try again."

413 Payload Too Large    "File too large"
                         "This screenshot is larger than we 
                          can handle. Try re-capturing."

500 Internal Error       "Server had a problem"
                         "Our server couldn't save this. 
                          We're looking into it."

401 Unauthorized         "Session expired"
                         "You've been logged out. Sign in to 
                          continue syncing."

429 Too Many Requests    "Slow down"
                         "You're uploading faster than we can 
                          handle. Wait a moment."

CORS Error               "Page blocked upload"
                         "This page's security settings 
                          prevented the upload."
```

### Retry Actions

```
MANUAL RETRY OPTIONS:
├── [Retry]           Retry this one item
├── [Retry All]       Retry all failed items
├── [Skip]            Skip this item, continue others
├── [Skip All]        Skip all failed, finish what worked
├── [Re-capture]      For screenshots: take new screenshot
└── [Export Locally]  Download everything as backup

AUTOMATIC RETRY:
├── Runs on network reconnection
├── Runs when tab regains focus
├── Runs every 30 seconds while failures exist
└── User always notified of retry attempts
```

---

## Conflict Resolution

### When Conflicts Happen

```
CONFLICT SCENARIOS:
├── User A and User B edit same step simultaneously
├── User edits on two devices without syncing
├── Offline edits conflict with server state
└── Extension and web app edit same guide
```

### Conflict Detection

```
CONFLICT DETECTED NOTIFICATION:
┌─────────────────────────────────────────────────────────────────┐
│  ⚠  SYNC CONFLICT                                               │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  Step 12 was edited in two places:                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  YOUR VERSION                               (This device)  ││
│  │  ───────────────────────────────────────────────────────   ││
│  │  Title: "Click 'Submit' Button"                            ││
│  │  Description: "Submits the registration form to create..." ││
│  │  Modified: Just now                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  SERVER VERSION                             (Jamie's edit) ││
│  │  ───────────────────────────────────────────────────────   ││
│  │  Title: "Submit the Form"                                  ││
│  │  Description: "Click the submit button to complete..."    ││
│  │  Modified: 2 minutes ago                                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  [Keep Mine]  [Use Theirs]  [Merge Both]                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Resolution Options

```
KEEP MINE:
├── Your local version overwrites server
├── Other user's changes are lost
├── You see confirmation toast
└── Logged in activity history

USE THEIRS:
├── Server version replaces your local
├── Your local changes are discarded
├── You see confirmation toast
└── Logged in activity history

MERGE BOTH:
├── Opens merge editor
├── Shows side-by-side diff
├── User picks what to keep
└── Creates new combined version
```

### Merge Editor

```
┌─────────────────────────────────────────────────────────────────┐
│  MERGE CHANGES                                             [×] │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  TITLE                                                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ○ Your version:   "Click 'Submit' Button"                 ││
│  │  ● Their version:  "Submit the Form"                       ││
│  │  ○ Custom:         [                              ]        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  DESCRIPTION                                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  ● Your version:   "Submits the registration form to..."  ││
│  │  ○ Their version:  "Click the submit button to complete..."││
│  │  ○ Custom:         [                              ]        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  SCREENSHOT                                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  [Your Screenshot]     [Their Screenshot]                  ││
│  │  ○ Keep yours          ● Keep theirs                       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│                                        [Cancel]  [Save Merge]   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Conflict Prevention

```
REAL-TIME PRESENCE:
┌────────────────────────────────────────────────────────────────┐
│  12  [thumb]  Click 'Submit' Button            👤 Jamie       │
│               Submits the registration form    is editing     │
└────────────────────────────────────────────────────────────────┘
                                                      │
                                                      └─ Shows who else
                                                         is editing

EDITING LOCK (optional team setting):
├── First user to select step gets edit lock
├── Others see "Jamie is editing this step"
├── Lock expires after 30 seconds of inactivity
└── Can be overridden with warning
```

---

## Offline Mode

### Entering Offline Mode

```
OFFLINE DETECTED:
┌─────────────────────────────────────────────────────────────────┐
│  ○  You're offline                                              │
│  ───────────────────────────────────────────────────────────    │
│                                                                 │
│  Your work is being saved on this device.                       │
│  Everything will sync when you're back online.                  │
│                                                                 │
│  ✓  Capture continues working                                   │
│  ✓  Edits are saved locally                                     │
│  ○  Sync is paused                                              │
│                                                                 │
│  Steps waiting to sync: 0                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Offline Indicators

```
GLOBAL INDICATOR:
┌─────────────────────────────────────────────────────────────────┐
│  ○  Offline · Saved locally                      5 pending     │
└─────────────────────────────────────────────────────────────────┘

STEP INDICATORS:
┌────────────────────────────────────────────────────────────────┐
│  12  [thumb]  Click 'Submit' Button                        ○   │
│               Submits the registration form     Saved locally  │
└────────────────────────────────────────────────────────────────┘
                                                             │
                                                             └─ Offline indicator
                                                                (hollow circle)
```

### Coming Back Online

```
RECONNECTION FLOW:
┌─────────────────────────────────────────────────────────────────┐
│  ⟳  Back online · Syncing...                                   │
│     ████████████░░░░░░░░  5 of 12 items                         │
└─────────────────────────────────────────────────────────────────┘

                              ↓ After completion

┌─────────────────────────────────────────────────────────────────┐
│  ✓  All changes synced                          Just now       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Safety Assurances

### How Users Know Data Is Safe

```
LAYER 1: IMMEDIATE FEEDBACK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Every action shows a result:
├── Capture → Step appears → "Saving..." → "Saved ✓"
├── Edit → Blue dot → "Saving..." → "Saved ✓"
├── Screenshot → Thumbnail appears → Upload progress → "✓"
└── User sees their work acknowledged at every step

LAYER 2: PERSISTENT STATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Global indicator always visible:
├── "All changes saved" = Everything is on server
├── "Saving..." = In progress, almost done
├── "X pending" = Queued, will save soon
├── "Saved locally" = Safe on device, will sync later
└── User never has to guess the state

LAYER 3: EXPLICIT CONFIRMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before risky actions:
├── Close tab with pending: "You have unsaved changes"
├── Navigate away: "Your changes are still uploading"
├── Stop recording: "Let uploads finish first?"
└── User explicitly confirms before any data risk

LAYER 4: RECOVERY OPTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If something goes wrong:
├── Failed uploads show [Retry]
├── Failed syncs offer [Export Locally]
├── Conflicts show both versions
├── "Contact Support" always available
└── User always has a path forward
```

### Safety Messaging

```
DURING CAPTURE:
"Your steps are being saved as you go."

DURING SYNC:
"Uploading your work to the cloud..."

WHILE OFFLINE:
"Saved on this device. Will sync when online."

AFTER SYNC:
"All your work is safely stored."

ON ERROR:
"We couldn't save this yet, but it's safe locally."
```

### Close Tab Warning

```
BROWSER PROMPT (when pending changes):
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ⚠  Leave site?                                                 │
│                                                                 │
│  You have 3 changes that haven't finished saving.               │
│  If you leave now, some work might be lost.                     │
│                                                                 │
│                              [Stay]  [Leave Anyway]             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Sync Status Lifecycle

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  USER ACTION                                                         │
│       │                                                              │
│       ▼                                                              │
│  ┌─────────────┐                                                     │
│  │  CAPTURED   │  ● Blue dot                                         │
│  │  (local)    │  "Unsaved"                                          │
│  └──────┬──────┘                                                     │
│         │ Add to sync queue                                          │
│         ▼                                                            │
│  ┌─────────────┐                                                     │
│  │  PENDING    │  ◐ Half circle                                      │
│  │  (queued)   │  "Saving..."                                        │
│  └──────┬──────┘                                                     │
│         │ Start upload                                               │
│         ▼                                                            │
│  ┌─────────────┐                                                     │
│  │  SYNCING    │  ⟳ Spinning                                         │
│  │  (upload)   │  "Uploading X%"                                     │
│  └──────┬──────┘                                                     │
│         │                                                            │
│    ┌────┴────┐                                                       │
│    │         │                                                       │
│    ▼         ▼                                                       │
│  Success   Failure                                                   │
│    │         │                                                       │
│    ▼         ▼                                                       │
│  ┌─────────────┐  ┌─────────────┐                                    │
│  │  SYNCED     │  │  FAILED     │                                    │
│  │  (server)   │  │  (error)    │                                    │
│  │             │  │             │                                    │
│  │  ✓ Check    │  │  ⚠ Warning  │                                    │
│  │  "Saved"    │  │  [Retry]    │                                    │
│  └─────────────┘  └──────┬──────┘                                    │
│                          │ Retry                                     │
│                          │ (manual or auto)                          │
│                          └───────────────┐                           │
│                                          │                           │
│                                          ▼                           │
│                                    Back to PENDING                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Summary

| User Concern | How We Address It |
|--------------|-------------------|
| "Did it save?" | Immediate ✓ confirmation per step |
| "What's uploading?" | Visible sync queue with progress |
| "Why did it fail?" | Plain-language error + [Retry] button |
| "Two people edited this" | Side-by-side conflict resolution UI |
| "I'm offline" | "Saved locally, will sync when online" |
| "Is my data safe?" | Always-visible global sync status |
| "What if I close the tab?" | Warning before closing with pending |

### Trust-Building Summary

```
1. SHOW EVERY STATE
   └── Nothing is hidden. User sees exactly what's happening.

2. CONFIRM EVERY SAVE  
   └── Each step gets a checkmark when safe on server.

3. EXPLAIN EVERY FAILURE
   └── Plain language, not error codes. Always has [Retry].

4. RESOLVE EVERY CONFLICT
   └── Show both versions, let user choose.

5. ASSURE ALWAYS
   └── "Your work is safe" messaging in every state.
```

---

*Sync status isn't about showing off our infrastructure—it's about giving users the confidence to focus on their work, knowing we're handling the rest.*
