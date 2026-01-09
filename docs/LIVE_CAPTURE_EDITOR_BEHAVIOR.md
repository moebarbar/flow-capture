# Live Capture Editor Behavior

How the editor communicates recording state clearly while reducing user stress and never blocking interaction.

---

## Design Principles

```
1. RECORDING STATE IS ALWAYS OBVIOUS
   └── User never wonders "am I recording?"

2. NO INTERFERENCE WITH CAPTURE
   └── Editor UI never blocks page interaction

3. PERFORMANCE IS INVISIBLE
   └── Zero lag, zero flicker, zero jank

4. STRESS REDUCTION
   └── User feels in control, not anxious
```

---

## Recording Indicator

### Persistent Visual Anchor

```
TOP-CENTER FLOATING INDICATOR (during capture):
┌───────────────────────────────────────────────────────────────────────┐
│                                                                       │
│                    ┌─────────────────────────────────┐                │
│                    │ ●  Recording   00:03:42   12    │                │
│                    │ │      │           │       │    │                │
│                    │ │      │           │       └─ Step count         │
│                    │ │      │           └─ Timer                      │
│                    │ │      └─ Status text                            │
│                    │ └─ Pulsing red dot                               │
│                    └─────────────────────────────────┘                │
│                                   │                                   │
│                                   └─ Floating pill, semi-transparent  │
│                                      Doesn't block content            │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Indicator States

```
RECORDING (active capture):
┌──────────────────────────────────────┐
│  ●  Recording   00:03:42   12 steps  │
└──────────────────────────────────────┘
│
├── Red dot: Pulses gently (1.5s cycle)
├── Text: "Recording" in white
├── Timer: Running, updates every second
├── Steps: Updates instantly on capture
└── Background: Dark with 85% opacity

PAUSED:
┌──────────────────────────────────────┐
│  ⏸  Paused     00:03:42   12 steps  │
└──────────────────────────────────────┘
│
├── Pause icon: Yellow, static
├── Text: "Paused" in yellow
├── Timer: Frozen
├── Steps: Frozen
└── Background: Slightly lighter

SYNCING (after stop):
┌──────────────────────────────────────┐
│  ⟳  Saving...  12 steps              │
└──────────────────────────────────────┘
│
├── Sync icon: Rotating
├── Text: "Saving..." 
├── Progress: Optional percentage
└── Disappears when complete
```

### Indicator Behavior

```css
/* Floating indicator positioning */
.capture-indicator {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483646; /* Below side panel, above everything else */
  
  /* Non-blocking */
  pointer-events: auto; /* Only the pill itself captures clicks */
  
  /* Subtle shadow for visibility on any background */
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
  
  /* Smooth transitions */
  transition: opacity 200ms, transform 200ms;
}

/* Pulsing red dot */
.recording-dot {
  width: 8px;
  height: 8px;
  background: #ef4444;
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.1); }
}
```

---

## Timer Display

### Design

```
TIMER FORMAT: HH:MM:SS (shows hours only when > 1 hour)

< 1 hour:     00:03:42
≥ 1 hour:     1:03:42
≥ 10 hours:   10:03:42

FONT: Monospace for stable width (numbers don't shift)
```

### Timer Logic

```javascript
// Timer runs client-side, synced with capture start
class CaptureTimer {
  constructor() {
    this.startTime = null;
    this.pausedTime = 0;
    this.isPaused = false;
  }
  
  start() {
    this.startTime = Date.now();
    this.pausedTime = 0;
    this.isPaused = false;
    this.tick();
  }
  
  pause() {
    this.pauseStart = Date.now();
    this.isPaused = true;
  }
  
  resume() {
    this.pausedTime += Date.now() - this.pauseStart;
    this.isPaused = false;
    this.tick();
  }
  
  tick() {
    if (this.isPaused) return;
    
    const elapsed = Date.now() - this.startTime - this.pausedTime;
    this.updateDisplay(elapsed);
    
    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
      setTimeout(() => this.tick(), 1000 - (elapsed % 1000));
    });
  }
  
  formatTime(ms) {
    const seconds = Math.floor(ms / 1000) % 60;
    const minutes = Math.floor(ms / 60000) % 60;
    const hours = Math.floor(ms / 3600000);
    
    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  }
}
```

---

## Current Page Display

### Side Panel Page Context

```
┌─────────────────────────────────────────────────────────────────────┐
│  CURRENT PAGE                                                       │
│  ───────────────────────────────────────────────────────────────    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  🔒  example.com/signup                                     │    │
│  │      Create Account | Example App                           │    │
│  └─────────────────────────────────────────────────────────────┘    │
│       │        │              │                                     │
│       │        │              └─ Page title                         │
│       │        └─ Current URL (truncated if long)                   │
│       └─ Security indicator (🔒 HTTPS, ⚠ HTTP)                      │
│                                                                     │
│  Tab: Main Window                                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Real-Time URL Updates

```
NAVIGATION DETECTED:
├── URL updates instantly in side panel
├── Page title updates when available
├── Security status updates
├── Tab indicator updates if changed
└── Smooth text transition (no flicker)

URL TRUNCATION:
├── Max display: 40 characters
├── Middle truncation: exam...m/signup/step2
├── Full URL on hover tooltip
└── Copy button for full URL
```

### Multi-Tab Awareness

```
WHEN MULTIPLE TABS CAPTURED:
┌─────────────────────────────────────────────────────────────────────┐
│  CAPTURED TABS (3)                                                  │
│  ───────────────────────────────────────────────────────────────    │
│                                                                     │
│  ● Main Window   example.com/signup        ← Active (bold)          │
│  ○ Tab 2         docs.example.com          ← Inactive               │
│  ○ Tab 3         api.example.com/test      ← Inactive               │
│                                                                     │
│  [+ Capture Another Tab]                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

SWITCHING TABS:
├── Active tab highlighted
├── Other tabs shown but dimmed
├── Click tab to switch focus
└── Steps tagged with source tab
```

---

## Capture Health Status

### Health Indicators

```
HEALTHY (all systems go):
┌───────────────────────────────────────────────────────────────┐
│  CAPTURE HEALTH                                    ● Healthy  │
│  ───────────────────────────────────────────────────────────  │
│                                                               │
│  ✓ Connection active                                          │
│  ✓ Screenshots working                                        │
│  ✓ Steps syncing                                              │
│                                                               │
└───────────────────────────────────────────────────────────────┘

WARNING (degraded but functional):
┌───────────────────────────────────────────────────────────────┐
│  CAPTURE HEALTH                                    ● Warning  │
│  ───────────────────────────────────────────────────────────  │
│                                                               │
│  ✓ Connection active                                          │
│  ⚠ Screenshots delayed                                        │
│  ✓ Steps syncing                                              │
│                                                               │
│  Some screenshots may take longer to capture.                 │
│                                                               │
└───────────────────────────────────────────────────────────────┘

ERROR (needs attention):
┌───────────────────────────────────────────────────────────────┐
│  CAPTURE HEALTH                                      ● Error  │
│  ───────────────────────────────────────────────────────────  │
│                                                               │
│  ✓ Connection active                                          │
│  ✗ Screenshots failing                                        │
│  ⚠ Steps pending (3)                                          │
│                                                               │
│  Screenshots cannot be captured on this page.                 │
│  Steps will save without images.                              │
│                                                               │
│  [Continue Anyway]  [Troubleshoot]                            │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Health Checks

```
MONITORED SYSTEMS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. CONNECTION
   ├── Background script responding
   ├── Content script injected
   └── Message passing working
   
   Check: Ping every 5 seconds
   Fail: 3 missed pings

2. SCREENSHOTS
   ├── Tab has permission
   ├── Page not restricted
   └── Capture API available
   
   Check: After each capture attempt
   Fail: 3 consecutive failures

3. SYNC
   ├── API reachable
   ├── Authentication valid
   └── Steps uploading
   
   Check: After each step captured
   Fail: 5+ pending steps for > 30 seconds

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Minimal Health Display (Default)

```
HEALTHY: No indicator (clean UI)

WARNING: Small yellow dot on indicator
┌──────────────────────────────────────┐
│  ●  Recording   00:03:42   12  ⚠     │
└──────────────────────────────────────┘
                                  │
                                  └─ Click to see details

ERROR: Red dot, more prominent
┌──────────────────────────────────────┐
│  ●  Recording   00:03:42   12  ⚠!    │
└──────────────────────────────────────┘
                                  │
                                  └─ Attention needed
```

---

## Performance: No Lag, No Flicker

### Update Strategies

```
TIMER UPDATES:
├── Use requestAnimationFrame for smooth rendering
├── Update DOM only when value changes
├── Monospace font prevents width shifts
└── Never re-render entire component

STEP COUNT:
├── Optimistic update (instant on capture)
├── Background sync doesn't affect display
├── Counter animates briefly (+1 effect)
└── No layout shift

URL/PAGE UPDATES:
├── Debounce navigation events (100ms)
├── Fade transition for text changes
├── Skeleton state during load (rare)
└── Never show "undefined" or blank
```

### Rendering Optimizations

```javascript
// Isolated updates - only change what's needed
function updateStepCount(newCount) {
  const el = document.getElementById('step-count');
  if (el.textContent !== String(newCount)) {
    el.textContent = newCount;
    el.classList.add('count-bump');
    setTimeout(() => el.classList.remove('count-bump'), 200);
  }
}

// CSS for micro-animation
.count-bump {
  animation: bump 200ms ease-out;
}

@keyframes bump {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
```

### Shadow DOM Isolation

```
ALL EDITOR UI IN SHADOW DOM:
├── CSS cannot leak to page
├── Page CSS cannot affect editor
├── No style conflicts
├── No z-index battles
└── Clean encapsulation
```

---

## No Accidental Clicks Blocked

### Pointer Events Strategy

```css
/* Container spans full height but doesn't block */
.side-panel-container {
  position: fixed;
  right: 0;
  top: 0;
  height: 100vh;
  width: 400px;
  pointer-events: none; /* CLICKS PASS THROUGH */
}

/* Only the actual panel captures clicks */
.side-panel {
  pointer-events: auto; /* Panel itself is interactive */
}

/* Toggle tab is interactive */
.toggle-tab {
  pointer-events: auto;
}

/* Floating indicator is interactive */
.capture-indicator {
  pointer-events: auto;
}
```

### Click-Through Regions

```
PAGE LAYOUT DURING CAPTURE:
┌────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────┐                  │
│  │  ●  Recording   00:03:42   12                │← Interactive     │
│  └──────────────────────────────────────────────┘                  │
│                                                                    │
│  ┌──────────────────────────────────────────┐  ┌────────────────┐  │
│  │                                          │  │                │  │
│  │                                          │  │   Side Panel   │  │
│  │          PAGE CONTENT                    │  │                │  │
│  │          (fully interactive)             │  │ ← Interactive  │  │
│  │                                          │  │                │  │
│  │    ← Clicks captured as steps            │  │                │  │
│  │                                          │  │                │  │
│  │                                          │  └────────────────┘  │
│  │                                          │  │ ← Toggle tab      │
│  │                                          │  │   Interactive     │
│  └──────────────────────────────────────────┘                      │
│                                                                    │
│         ↑ Gap between panel and content = click-through            │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Edge Cases

```
DROPDOWN/MODAL ON PAGE:
├── Editor UI has high z-index but...
├── pointer-events: none lets clicks through
├── Only visible editor elements block
└── Page dropdowns work normally

FIXED HEADERS ON PAGE:
├── Capture indicator positioned to avoid common header areas
├── User can drag indicator if needed
├── Auto-repositions if collision detected
└── Never covers page's fixed elements

FULLSCREEN PAGE CONTENT:
├── Indicator stays visible
├── Panel auto-collapses
├── Minimal footprint
└── All page content accessible
```

---

## Communicating "You're Recording" Clearly

### Multiple Reinforcement Signals

```
VISUAL SIGNALS:
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  1. PULSING RED DOT                                                 │
│     └── Universal symbol for recording                              │
│     └── Visible at a glance from any distance                       │
│     └── Pulses gently (not aggressive)                              │
│                                                                     │
│  2. RUNNING TIMER                                                   │
│     └── Proves recording is active                                  │
│     └── Gives sense of session duration                             │
│     └── Frozen timer = paused (different state)                     │
│                                                                     │
│  3. STEP COUNT INCREMENTING                                         │
│     └── Confirms actions are being captured                         │
│     └── Bumps up visibly with each step                             │
│     └── Provides progress feedback                                  │
│                                                                     │
│  4. SIDE PANEL SHOWING NEW STEPS                                    │
│     └── Steps appear in real-time                                   │
│     └── Screenshots load as captured                                │
│     └── Proves system is working                                    │
│                                                                     │
│  5. COLORED STATUS TEXT                                             │
│     └── "Recording" in white = active                               │
│     └── "Paused" in yellow = paused                                 │
│     └── "Saving..." = finishing up                                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Ambient Awareness

```
USER DOESN'T NEED TO LOOK AT INDICATOR:
├── Red pulse visible in peripheral vision
├── Panel updates catch attention
├── Step count changes are noticeable
└── User feels recording without focusing on it

USER CAN VERIFY AT ANY TIME:
├── Quick glance at indicator confirms state
├── Timer proves active recording
├── Step list shows captured actions
└── No ambiguity ever
```

---

## Reducing User Stress

### 1. Confidence Through Feedback

```
EVERY ACTION = VISIBLE FEEDBACK:
├── Click on page → Step appears in panel (instant)
├── Screenshot taken → Thumbnail appears (within 1s)
├── Step synced → Checkmark appears
└── User KNOWS their work is being captured

"DID IT WORK?" ANXIETY ELIMINATED:
├── No silent failures
├── No mystery states
├── No "is this thing on?" moments
└── Constant reassurance through visibility
```

### 2. Low-Stakes Feel

```
MESSAGING EMPHASIZES SAFETY:
├── "You can always edit steps later"
├── "Nothing is permanent yet"
├── "Missed something? Just do it again"
└── "We'll clean up duplicates"

UI SIGNALS FLEXIBILITY:
├── Pause button always visible
├── Undo available
├── Steps are clearly editable
└── Finish is not final (can add more)
```

### 3. No Urgency Pressure

```
TIMER IS INFORMATIONAL, NOT THREATENING:
├── No "time remaining" countdown
├── No red color until 60 minutes (extreme)
├── No warnings about session limits
└── Feels like a stopwatch, not a bomb

STEP COUNT IS POSITIVE:
├── "12 steps" not "12/50 remaining"
├── Higher number = more progress
├── No limits displayed
└── Encourages thoroughness
```

### 4. Graceful Error Handling

```
PROBLEMS DON'T STOP CAPTURE:
├── Screenshot fails → Capture continues, note shown
├── Sync delayed → Capture continues, queue shown
├── Connection lost → Capture continues, offline mode
└── User never loses work

ERRORS ARE EXPLAINED SIMPLY:
├── "Screenshots paused on this page"
├── "Saving will resume when online"
├── "Some steps are waiting to sync"
└── No technical jargon, no blame
```

### 5. Clear Exit Path

```
USER ALWAYS KNOWS HOW TO STOP:
├── "Finish" button always visible
├── Keyboard shortcut (Ctrl+Enter)
├── Closing panel prompts "Finish recording?"
└── Never trapped in capture mode

PAUSE IS REVERSIBLE:
├── Paused state clearly different
├── Resume is one click
├── Timer shows paused state
└── No data lost on pause
```

### 6. Post-Capture Relief

```
AFTER FINISHING:
├── "Capture saved successfully" ✓
├── Step count confirmed
├── "Edit your guide now" option
├── Feeling of completion

TRANSITION IS SMOOTH:
├── Recording indicator fades out
├── Side panel transitions to edit mode
├── No jarring state changes
└── User feels guided, not abandoned
```

---

## State Transitions

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                         ┌─────────┐                                  │
│                         │  IDLE   │                                  │
│                         └────┬────┘                                  │
│                              │ Start capture                         │
│                              ▼                                       │
│                       ┌─────────────┐                                │
│             ┌────────▶│  RECORDING  │◀────────┐                      │
│             │         └──────┬──────┘         │                      │
│             │                │                │                      │
│         Resume          Pause│           User action                 │
│             │                ▼           (step captured)             │
│             │         ┌─────────────┐         │                      │
│             └─────────│   PAUSED    │         │                      │
│                       └─────────────┘         │                      │
│                              │                │                      │
│                         Finish                │                      │
│                              ▼                │                      │
│                       ┌─────────────┐         │                      │
│                       │   SYNCING   │─────────┘                      │
│                       └──────┬──────┘   (if still syncing)           │
│                              │                                       │
│                         Complete                                     │
│                              ▼                                       │
│                       ┌─────────────┐                                │
│                       │  COMPLETE   │                                │
│                       └──────┬──────┘                                │
│                              │                                       │
│                              ▼                                       │
│                       ┌─────────────┐                                │
│                       │ EDIT MODE   │                                │
│                       └─────────────┘                                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Summary

| Challenge | Solution |
|-----------|----------|
| "Am I recording?" | Pulsing red dot + running timer + step count |
| "Is it working?" | Steps appear instantly in panel |
| "Will I lose my work?" | Persistent sync status, offline support |
| Blocking page clicks | pointer-events: none on container |
| UI flicker | Shadow DOM isolation, targeted updates |
| Performance lag | requestAnimationFrame, debounced updates |
| User anxiety | Low-stakes messaging, clear exit paths |
| Error panic | Graceful degradation, simple explanations |

---

*The live capture experience should feel like having a reliable assistant quietly taking notes, not like operating a complex machine. The user focuses on demonstrating their workflow; we handle the rest.*
