# Error Handling & System Health Feedback

Clear, actionable, non-technical feedback that builds trust through transparency.

---

## Design Principles

```
1. USERS SEE WHAT WE SEE
   └── No hidden failures, no silent errors

2. EVERY ERROR HAS A NEXT STEP
   └── Never just "something went wrong"

3. PLAIN LANGUAGE ONLY
   └── No error codes, no technical jargon

4. TRUST THROUGH TRANSPARENCY
   └── Show the work, explain the state
```

---

## System Health Dashboard

### Compact Health Indicator (Default)

```
DURING CAPTURE - Floating with recording indicator:
┌───────────────────────────────────────────────────┐
│  ●  Recording   00:03:42   12 steps   ●           │
└───────────────────────────────────────────────────┘
                                        │
                                        └── Health dot
                                            Green = healthy
                                            Yellow = warning
                                            Red = error
                                            (click to expand)
```

### Expanded Health Panel

```
┌─────────────────────────────────────────────────────────────────────┐
│  SYSTEM HEALTH                                                  [×] │
│  ═══════════════════════════════════════════════════════════════    │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  CAPTURE                                          ● Connected │  │
│  │  ─────────────────────────────────────────────────────────    │  │
│  │                                                               │  │
│  │  ✓  Extension active                                          │  │
│  │  ✓  Page connection working                                   │  │
│  │  ✓  Tracking user actions                                     │  │
│  │                                                               │  │
│  │  Last action captured: 3 seconds ago                          │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  SCREENSHOTS                                       ● Working  │  │
│  │  ─────────────────────────────────────────────────────────    │  │
│  │                                                               │  │
│  │  ✓  Permission granted                                        │  │
│  │  ✓  Capture available                                         │  │
│  │  ✓  12 of 12 captured successfully                            │  │
│  │                                                               │  │
│  │  Average capture time: 340ms                                  │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  NETWORK                                           ● Online   │  │
│  │  ─────────────────────────────────────────────────────────    │  │
│  │                                                               │  │
│  │  ✓  Internet connected                                        │  │
│  │  ✓  FlowCapture server reachable                              │  │
│  │  ✓  Authentication valid                                      │  │
│  │                                                               │  │
│  │  Response time: 89ms                                          │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  SYNC                                              ● Current  │  │
│  │  ─────────────────────────────────────────────────────────    │  │
│  │                                                               │  │
│  │  ✓  All steps saved                                           │  │
│  │  ✓  All screenshots uploaded                                  │  │
│  │  ✓  No pending changes                                        │  │
│  │                                                               │  │
│  │  Last sync: Just now                                          │  │
│  │                                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Everything is working correctly.                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Individual Health Indicators

### 1. Capture Health

```
HEALTHY:
┌───────────────────────────────────────────────────────────────┐
│  CAPTURE                                         ● Connected  │
│  ─────────────────────────────────────────────────────────    │
│  ✓  Extension active                                          │
│  ✓  Page connection working                                   │
│  ✓  Tracking user actions                                     │
│                                                               │
│  Last action captured: 3 seconds ago                          │
└───────────────────────────────────────────────────────────────┘

WARNING - Page restrictions:
┌───────────────────────────────────────────────────────────────┐
│  CAPTURE                                         ● Limited    │
│  ─────────────────────────────────────────────────────────    │
│  ✓  Extension active                                          │
│  ⚠  Some page elements restricted                             │
│  ✓  Tracking most actions                                     │
│                                                               │
│  This page limits what we can capture. Some elements          │
│  inside iframes won't be tracked.                             │
│                                                               │
│  [Continue Anyway]  [Learn More]                              │
└───────────────────────────────────────────────────────────────┘

ERROR - Connection lost:
┌───────────────────────────────────────────────────────────────┐
│  CAPTURE                                      ● Disconnected  │
│  ─────────────────────────────────────────────────────────    │
│  ✓  Extension active                                          │
│  ✗  Page connection lost                                      │
│  ✗  Cannot track actions                                      │
│                                                               │
│  The page connection was interrupted. This usually            │
│  happens after the page reloads.                              │
│                                                               │
│  [Reconnect Now]  [What Happened?]                            │
└───────────────────────────────────────────────────────────────┘

ERROR - Extension issue:
┌───────────────────────────────────────────────────────────────┐
│  CAPTURE                                         ● Inactive   │
│  ─────────────────────────────────────────────────────────    │
│  ✗  Extension not responding                                  │
│  ✗  Cannot connect to page                                    │
│  ✗  Cannot track actions                                      │
│                                                               │
│  The extension stopped responding. This can happen if         │
│  Chrome updated in the background.                            │
│                                                               │
│  [Restart Extension]  [Need Help?]                            │
└───────────────────────────────────────────────────────────────┘
```

### 2. Screenshot Health

```
HEALTHY:
┌───────────────────────────────────────────────────────────────┐
│  SCREENSHOTS                                      ● Working   │
│  ─────────────────────────────────────────────────────────    │
│  ✓  Permission granted                                        │
│  ✓  Capture available                                         │
│  ✓  12 of 12 captured successfully                            │
│                                                               │
│  Average capture time: 340ms                                  │
└───────────────────────────────────────────────────────────────┘

WARNING - Slow captures:
┌───────────────────────────────────────────────────────────────┐
│  SCREENSHOTS                                        ● Slow    │
│  ─────────────────────────────────────────────────────────    │
│  ✓  Permission granted                                        │
│  ⚠  Captures taking longer than usual                         │
│  ✓  10 of 12 captured (2 pending)                             │
│                                                               │
│  Screenshots are taking longer because this page has          │
│  a lot of content. They'll still save correctly.              │
│                                                               │
│  Average capture time: 2.1s                                   │
│                                                               │
│  [Wait for Pending]  [Skip Slow Screenshots]                  │
└───────────────────────────────────────────────────────────────┘

ERROR - Permission denied:
┌───────────────────────────────────────────────────────────────┐
│  SCREENSHOTS                                     ● Blocked    │
│  ─────────────────────────────────────────────────────────    │
│  ✗  Permission not granted                                    │
│  ✗  Cannot capture screenshots                                │
│  ○  0 of 12 captured                                          │
│                                                               │
│  We need permission to take screenshots. Chrome may have      │
│  blocked this for privacy reasons.                            │
│                                                               │
│  [Grant Permission]  [Continue Without Screenshots]           │
└───────────────────────────────────────────────────────────────┘

ERROR - Restricted page:
┌───────────────────────────────────────────────────────────────┐
│  SCREENSHOTS                                   ● Unavailable  │
│  ─────────────────────────────────────────────────────────    │
│  ✓  Permission granted                                        │
│  ✗  Page does not allow screenshots                           │
│  ○  Cannot capture on this page                               │
│                                                               │
│  This page (like Chrome settings or bank pages) blocks        │
│  screenshots for security. Your steps will save but           │
│  won't have images.                                           │
│                                                               │
│  [Continue Without Screenshots]  [Why Is This?]               │
└───────────────────────────────────────────────────────────────┘
```

### 3. Network Health

```
HEALTHY:
┌───────────────────────────────────────────────────────────────┐
│  NETWORK                                          ● Online    │
│  ─────────────────────────────────────────────────────────    │
│  ✓  Internet connected                                        │
│  ✓  FlowCapture server reachable                              │
│  ✓  Authentication valid                                      │
│                                                               │
│  Response time: 89ms                                          │
└───────────────────────────────────────────────────────────────┘

WARNING - Slow connection:
┌───────────────────────────────────────────────────────────────┐
│  NETWORK                                          ● Slow      │
│  ─────────────────────────────────────────────────────────    │
│  ✓  Internet connected                                        │
│  ⚠  Server responding slowly                                  │
│  ✓  Authentication valid                                      │
│                                                               │
│  Your connection is slower than usual. Captures will          │
│  continue, but syncing may take longer.                       │
│                                                               │
│  Response time: 2,340ms                                       │
│                                                               │
│  [Continue Anyway]                                            │
└───────────────────────────────────────────────────────────────┘

ERROR - Offline:
┌───────────────────────────────────────────────────────────────┐
│  NETWORK                                         ● Offline    │
│  ─────────────────────────────────────────────────────────    │
│  ✗  Internet not connected                                    │
│  ✗  Cannot reach FlowCapture                                  │
│  ○  Sync paused                                               │
│                                                               │
│  You appear to be offline. Your work is being saved           │
│  locally and will sync when you're back online.               │
│                                                               │
│  Steps waiting to sync: 5                                     │
│                                                               │
│  [Try Again]  [Continue Offline]                              │
└───────────────────────────────────────────────────────────────┘

ERROR - Server unreachable:
┌───────────────────────────────────────────────────────────────┐
│  NETWORK                                      ● Server Down   │
│  ─────────────────────────────────────────────────────────    │
│  ✓  Internet connected                                        │
│  ✗  FlowCapture server not responding                         │
│  ○  Sync paused                                               │
│                                                               │
│  Our servers are temporarily unavailable. Your work is        │
│  being saved locally. We're working to fix this.              │
│                                                               │
│  Steps waiting to sync: 8                                     │
│                                                               │
│  [Retry Now]  [Check Status Page]                             │
└───────────────────────────────────────────────────────────────┘

ERROR - Session expired:
┌───────────────────────────────────────────────────────────────┐
│  NETWORK                                    ● Login Required  │
│  ─────────────────────────────────────────────────────────    │
│  ✓  Internet connected                                        │
│  ✓  Server reachable                                          │
│  ✗  Your session expired                                      │
│                                                               │
│  You've been logged out, probably because you signed in       │
│  somewhere else. Your work is saved locally.                  │
│                                                               │
│  [Sign In Again]  [Save Work Locally]                         │
└───────────────────────────────────────────────────────────────┘
```

### 4. Sync Health

```
HEALTHY:
┌───────────────────────────────────────────────────────────────┐
│  SYNC                                             ● Current   │
│  ─────────────────────────────────────────────────────────    │
│  ✓  All steps saved                                           │
│  ✓  All screenshots uploaded                                  │
│  ✓  No pending changes                                        │
│                                                               │
│  Last sync: Just now                                          │
└───────────────────────────────────────────────────────────────┘

SYNCING (normal operation):
┌───────────────────────────────────────────────────────────────┐
│  SYNC                                            ● Syncing    │
│  ─────────────────────────────────────────────────────────    │
│  ✓  Steps saved (12)                                          │
│  ⟳  Uploading screenshots (2 remaining)                       │
│  ○  Changes pending                                           │
│                                                               │
│  ████████████████████░░░░░░░░  67%                            │
│                                                               │
│  Uploading: step_10.png (1.2 MB)                              │
└───────────────────────────────────────────────────────────────┘

WARNING - Behind:
┌───────────────────────────────────────────────────────────────┐
│  SYNC                                             ● Behind    │
│  ─────────────────────────────────────────────────────────    │
│  ✓  Steps saved (10 of 15)                                    │
│  ⚠  Screenshots backed up (8 waiting)                         │
│  ⚠  Some changes pending                                      │
│                                                               │
│  Sync is running slower than capture. Your work is safe       │
│  but may take a moment to appear in the web app.              │
│                                                               │
│  [Pause Capture to Catch Up]  [Continue]                      │
└───────────────────────────────────────────────────────────────┘

ERROR - Sync failed:
┌───────────────────────────────────────────────────────────────┐
│  SYNC                                             ● Failed    │
│  ─────────────────────────────────────────────────────────    │
│  ✗  Some steps couldn't save                                  │
│  ✗  Screenshots stuck                                         │
│  ✗  Changes not synced                                        │
│                                                               │
│  We tried 3 times but couldn't save your work to the          │
│  server. Your work is safe locally.                           │
│                                                               │
│  Waiting to sync: 12 steps, 8 screenshots                     │
│                                                               │
│  [Retry Now]  [Save to File]  [Contact Support]               │
└───────────────────────────────────────────────────────────────┘
```

---

## Error Message Patterns

### The Formula: What + Why + Action

```
STRUCTURE:
┌───────────────────────────────────────────────────────────────┐
│  [Icon]  [Short Title]                                        │
│                                                               │
│  [What happened - one sentence]                               │
│  [Why it happened - one sentence, optional]                   │
│                                                               │
│  [Primary Action]  [Secondary Action]                         │
└───────────────────────────────────────────────────────────────┘

EXAMPLE:
┌───────────────────────────────────────────────────────────────┐
│  ⚠  Screenshot Failed                                         │
│                                                               │
│  We couldn't capture a screenshot of this step.               │
│  The page may have blocked it for privacy reasons.            │
│                                                               │
│  [Try Again]  [Continue Without Image]                        │
└───────────────────────────────────────────────────────────────┘
```

### Good vs Bad Error Messages

```
BAD (Technical):
"Error: CORS policy blocked screenshot capture. 
 SecurityError: Cannot read from cross-origin frame."

GOOD (Human):
"We couldn't capture this part of the page.
 Some websites block screenshots for security.
 [Continue Without Image]"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BAD (Vague):
"Something went wrong. Please try again."

GOOD (Specific):
"Your screenshot is taking longer than usual.
 This page has a lot of images loading.
 [Wait]  [Skip This Screenshot]"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BAD (Blaming):
"You are offline. Connect to the internet to continue."

GOOD (Helpful):
"You appear to be offline.
 Your work is being saved locally and will sync when 
 you're back online.
 [Continue Offline]"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

BAD (Dead end):
"Session expired."

GOOD (Path forward):
"Your session expired.
 You've been logged out, probably because you signed in
 somewhere else. Your work is saved locally.
 [Sign In Again]  [Save Work Locally]"
```

---

## Inline Step Errors

### Error States on Individual Steps

```
STEP WITH SCREENSHOT ERROR:
┌────────────────────────────────────────────────────────────────┐
│  12  ┌────────┐  Click 'Submit' Button                         │
│      │   ⚠    │  Submits the registration form                 │
│      │  No    │                                                │
│      │ image  │  ⚠ Screenshot couldn't be captured             │
│      └────────┘    [Try Again]  [Add Manually]                 │
└────────────────────────────────────────────────────────────────┘

STEP WITH SYNC ERROR:
┌────────────────────────────────────────────────────────────────┐
│  12  [thumb]  Click 'Submit' Button              ⟳ Not saved  │
│               Submits the registration form                    │
│                                                                │
│               ⚠ Couldn't save to server                        │
│                  [Retry]  [Save Locally]                       │
└────────────────────────────────────────────────────────────────┘

STEP WITH ELEMENT ERROR:
┌────────────────────────────────────────────────────────────────┐
│  12  [thumb]  Click 'Submit' Button              ⚠ Selector   │
│               Submits the registration form                    │
│                                                                │
│               ⚠ Element may be hard to find later              │
│                  [View Details]  [Fix Now]                     │
└────────────────────────────────────────────────────────────────┘
```

### Batch Error Summary

```
MULTIPLE STEPS WITH ISSUES:
┌────────────────────────────────────────────────────────────────┐
│  ⚠  3 steps need attention                           [Review] │
│  ─────────────────────────────────────────────────────────    │
│                                                                │
│  • Step 5: Screenshot missing                                  │
│  • Step 8: Screenshot missing                                  │
│  • Step 12: Selector may be unstable                           │
│                                                                │
│  Your guide will still work, but these steps may need          │
│  manual adjustments.                                           │
│                                                                │
│  [Fix All Now]  [Remind Me Later]  [Ignore]                    │
└────────────────────────────────────────────────────────────────┘
```

---

## Toast Notifications

### Transient Feedback

```
SUCCESS (auto-dismiss after 3s):
┌────────────────────────────────────────┐
│  ✓  Step captured                      │
└────────────────────────────────────────┘

SYNC SUCCESS (auto-dismiss after 3s):
┌────────────────────────────────────────┐
│  ✓  All changes saved                  │
└────────────────────────────────────────┘

WARNING (stays until dismissed):
┌────────────────────────────────────────────────────────────┐
│  ⚠  Screenshot delayed                                     │
│     Taking longer than usual...                       [×]  │
└────────────────────────────────────────────────────────────┘

ERROR (stays until action or dismissed):
┌────────────────────────────────────────────────────────────┐
│  ✗  Couldn't capture screenshot                            │
│     [Try Again]  [Skip]                               [×]  │
└────────────────────────────────────────────────────────────┘
```

### Toast Stacking

```
MULTIPLE TOASTS:
┌────────────────────────────────────────┐
│  ✓  Step 14 captured                   │  ← Newest on top
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  ✓  Step 13 captured                   │
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│  ⚠  Screenshot delayed (step 12)  [×]  │  ← Warnings persist
└────────────────────────────────────────┘

MAX 3 visible, older ones fade/collapse.
Same-type toasts combine:
┌────────────────────────────────────────┐
│  ✓  3 steps captured                   │
└────────────────────────────────────────┘
```

---

## Recovery Actions

### Every Error Has a Next Step

```
ERROR TYPE → PRIMARY ACTION → SECONDARY ACTION

Connection lost → [Reconnect Now] → [What Happened?]
Screenshot blocked → [Grant Permission] → [Continue Without]
Sync failed → [Retry Now] → [Save to File]
Session expired → [Sign In Again] → [Save Work Locally]
Extension issue → [Restart Extension] → [Need Help?]
Slow network → [Continue Anyway] → [Pause Capture]
Server down → [Retry Now] → [Check Status Page]
```

### Self-Healing Actions

```
AUTOMATIC RECOVERY:
├── Network reconnect: Auto-retry sync queue
├── Screenshot retry: 3 attempts before showing error
├── Connection lost: Auto-reconnect every 5 seconds
└── Sync queue: Exponential backoff (1s, 2s, 4s, 8s...)

USER SEES:
├── Brief "Reconnecting..." indicator
├── Success toast when resolved
├── Error only after all retries exhausted
└── Always has manual override option
```

---

## Building Trust Through Transparency

### 1. Show the Work

```
INSTEAD OF:                    SHOW:
"Syncing..."                   "Uploading 3 of 8 screenshots (2.4 MB)"
"Please wait..."               "Capturing screenshot (340ms)"
"Processing..."                "Analyzing element for best selector"

WHY IT BUILDS TRUST:
├── User sees system is actually doing something
├── Progress feels real, not fake
├── Slower operations feel justified
└── User understands what they're waiting for
```

### 2. Admit Limitations

```
INSTEAD OF:                    SAY:
"Error occurred"               "This page blocks screenshots"
"Cannot complete"              "Some websites don't allow this"
"Operation failed"             "We tried 3 times but couldn't save"

WHY IT BUILDS TRUST:
├── Honesty about what went wrong
├── User knows it's not their fault
├── System feels more reliable by admitting limits
└── Sets realistic expectations
```

### 3. Explain Context

```
INSTEAD OF:                    SAY:
"Offline"                      "You appear to be offline. Work is 
                                saved locally and will sync when 
                                you're back online."

"Slow"                         "Your connection is slower than usual.
                                Captures will continue, but syncing
                                may take longer."

"Behind"                       "Sync is running slower than capture.
                                Your work is safe but may take a 
                                moment to appear in the web app."

WHY IT BUILDS TRUST:
├── User understands the full picture
├── Knows their work is safe
├── Feels informed, not confused
└── Can make informed decisions
```

### 4. Prove Data Safety

```
ALWAYS COMMUNICATE:
├── "Your work is saved locally"
├── "X steps waiting to sync"
├── "Nothing is lost"
├── "Will sync when online"

SHOW EVIDENCE:
├── Step count that persists through errors
├── Local storage indicator
├── Sync queue visibility
└── Recovery options always available

WHY IT BUILDS TRUST:
├── Primary user fear: "Did I lose my work?"
├── Immediate reassurance addresses this
├── Visible proof reduces anxiety
└── User feels safe to continue
```

### 5. No Silent Failures

```
EVERY FAILURE IS VISIBLE:
├── Screenshot failed → Icon on step
├── Sync failed → Status in health panel
├── Connection lost → Indicator change
└── Error occurred → Toast notification

BUT NOT ALARMING:
├── Errors are informational, not scary
├── Warnings before errors when possible
├── Context explains severity
└── Actions are always available

WHY IT BUILDS TRUST:
├── User never wonders "did something break?"
├── Issues are surfaced, not hidden
├── Transparency > false confidence
└── User can trust what they see
```

### 6. Consistent Visual Language

```
ICONS MEAN THINGS:
✓  = Success, confirmed, working
⚠  = Warning, attention needed, degraded
✗  = Error, failed, blocked
⟳  = In progress, syncing, retrying
●  = Status indicator (color-coded)
○  = Not checked, unknown, pending

COLORS MEAN THINGS:
Green  = Healthy, success, connected
Yellow = Warning, slow, degraded
Red    = Error, failed, attention needed
Gray   = Unknown, pending, inactive

WHY IT BUILDS TRUST:
├── User learns the language quickly
├── Status is glanceable
├── No interpretation needed
└── Consistent everywhere in app
```

---

## Health Check Intervals

```
CAPTURE CONNECTION:
├── Ping every 5 seconds during recording
├── Show warning after 2 missed pings
├── Show error after 3 missed pings
└── Auto-reconnect attempt every 5 seconds

SCREENSHOT STATUS:
├── Check after each capture attempt
├── 3 failures → show warning
├── 5 consecutive failures → show error
└── Reset count on success

NETWORK STATUS:
├── Check every 10 seconds
├── Also check on any failed request
├── Immediate indicator change on failure
└── Auto-check on browser online event

SYNC STATUS:
├── Update after each sync operation
├── Show "syncing" during active uploads
├── Show "behind" if queue > 5 items
└── Show "failed" after retry exhaustion
```

---

## Summary

| Principle | Implementation |
|-----------|----------------|
| Show the work | Progress indicators with specific details |
| Admit limitations | Honest explanations of what can't work |
| Explain context | Full sentences, not just status words |
| Prove data safety | Always show work is preserved |
| No silent failures | Every issue is visible |
| Consistent language | Same icons/colors everywhere |

### Error Message Checklist

- [ ] Does it say what happened?
- [ ] Does it say why (if known)?
- [ ] Does it have a primary action?
- [ ] Does it have a secondary option?
- [ ] Is it in plain language?
- [ ] Does it reassure about data safety?
- [ ] Is the severity clear?

---

*The goal is not to hide problems—it's to make problems understandable and solvable. A user who trusts your error messages trusts your entire product.*
