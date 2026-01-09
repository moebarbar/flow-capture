# Tech Intelligence Editor - Layout Specification

## Layout Diagram

### Desktop Layout (1280px+)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  CAPTURE STATUS HEADER (48px, sticky top)                                        │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │ [●] Recording · 12 steps · 00:03:42   │   [Pause] [Finish]   │ Guide Name ▼│  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────┐  ┌──────────────────┐  │
│  │                                                     │  │                  │  │
│  │                                                     │  │  STICKY SIDE     │  │
│  │                                                     │  │  EDITOR          │  │
│  │           MAIN CANVAS                               │  │                  │  │
│  │           (Screenshot + Element Preview)            │  │  ┌────────────┐  │  │
│  │                                                     │  │  │ Step 12    │  │  │
│  │  ┌───────────────────────────────────────────────┐  │  │  │ Click btn  │  │  │
│  │  │                                               │  │  │  │ [thumb]    │  │  │
│  │  │                                               │  │  │  └────────────┘  │  │
│  │  │         SCREENSHOT VIEWER                     │  │  │  ┌────────────┐  │  │
│  │  │         (zoomable, pannable)                  │  │  │  │ Step 11    │  │  │
│  │  │                                               │  │  │  │ Type email │  │  │
│  │  │    ┌─────────┐                                │  │  │  │ [thumb]    │  │  │
│  │  │    │ Element │ ← Highlighted element          │  │  │  └────────────┘  │  │
│  │  │    │ Overlay │   with selector tooltip        │  │  │  ┌────────────┐  │  │
│  │  │    └─────────┘                                │  │  │  │ Step 10    │  │  │
│  │  │                                               │  │  │  │ Navigate   │  │  │
│  │  │                                               │  │  │  │ [thumb]    │  │  │
│  │  └───────────────────────────────────────────────┘  │  │  └────────────┘  │  │
│  │                                                     │  │       ⋮          │  │
│  │  ┌───────────────────────────────────────────────┐  │  │  STEP TIMELINE   │  │
│  │  │  STEP TIMELINE (horizontal, scrollable)       │  │  │  (scrollable)    │  │
│  │  │  ○───●───○───○───○───○───○───○───○───○───○───○ │  │  │                  │  │
│  │  │  1   2   3   4   5   6   7   8   9  10  11  12 │  │  └──────────────────┘  │
│  │  └───────────────────────────────────────────────┘  │                        │
│  │                                                     │  ┌──────────────────┐  │
│  └─────────────────────────────────────────────────────┘  │  METADATA PANEL  │  │
│                                                           │                  │  │
│                                                           │  Selector:       │  │
│                                                           │  #submit-btn     │  │
│                                                           │                  │  │
│                                                           │  URL:            │  │
│                                                           │  example.com/... │  │
│                                                           │                  │  │
│                                                           │  Timestamp:      │  │
│                                                           │  2:34 PM         │  │
│                                                           │                  │  │
│                                                           │  Tab: Main       │  │
│                                                           └──────────────────┘  │
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│  STATUS BAR (32px)                                                               │
│  Sync: ✓ All saved  │  AI: Ready  │  Last edit: 2 min ago  │  v1.0.0           │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Component Dimensions

```
CAPTURE STATUS HEADER
├── Height: 48px (fixed)
├── Position: sticky top
└── Contains: Recording indicator, timer, step count, actions, guide selector

MAIN CANVAS
├── Width: calc(100% - 360px) on desktop
├── Min-width: 480px
├── Contains:
│   ├── Screenshot Viewer (flex-1, min-height 400px)
│   └── Horizontal Timeline (height: 64px, fixed)

STICKY SIDE EDITOR
├── Width: 360px (desktop), 320px (laptop), collapsible
├── Position: fixed right
├── Contains:
│   ├── Step Timeline (scrollable list, flex-1)
│   └── Metadata Panel (collapsible, max-height: 240px)

STATUS BAR
├── Height: 32px (fixed)
├── Position: sticky bottom
└── Contains: Sync status, AI status, last edit time, version
```

---

## Tablet Layout (768px - 1279px)

```
┌────────────────────────────────────────────────────────┐
│  CAPTURE STATUS HEADER (48px)                          │
│  [●] Recording · 12 steps     [Pause] [Finish] [☰]    │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │                                                  │  │
│  │           MAIN CANVAS                            │  │
│  │           (Full width)                           │  │
│  │                                                  │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │                                            │  │  │
│  │  │         SCREENSHOT VIEWER                  │  │  │
│  │  │                                            │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  │                                                  │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │  TIMELINE ○───●───○───○───○───○───○───○    │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  │                                                  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
├────────────────────────────────────────────────────────┤
│  STEP DETAIL BAR (expandable, 80px collapsed)          │
│  Step 12: Click 'Submit' Button      [Edit] [▲ More]  │
│  #submit-btn · example.com · 2:34 PM                   │
└────────────────────────────────────────────────────────┘

SIDE EDITOR: Slides in as overlay from right (320px)
             Triggered by [☰] menu button
             Backdrop dims main content
```

---

## Mobile Layout (< 768px)

```
┌──────────────────────────────────┐
│  HEADER (56px)                   │
│  [←] Guide Name        [●] [☰]  │
├──────────────────────────────────┤
│                                  │
│  ┌────────────────────────────┐  │
│  │                            │  │
│  │    SCREENSHOT VIEWER       │  │
│  │    (swipeable gallery)     │  │
│  │                            │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │  Step 12 of 12             │  │
│  │  Click 'Submit' Button     │  │
│  │                            │  │
│  │  [< Prev]  [Edit]  [Next >]│  │
│  └────────────────────────────┘  │
│                                  │
├──────────────────────────────────┤
│  BOTTOM NAV (64px)               │
│  [Steps] [Details] [AI] [More]  │
└──────────────────────────────────┘

Full step list: Bottom sheet (slides up)
Metadata: "Details" tab in bottom nav
Side editor: Not available (use step cards)
```

---

## Ultrawide Layout (1920px+)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  CAPTURE STATUS HEADER (48px)                                                                    │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│  ┌────────────┐  ┌─────────────────────────────────────────────────────┐  ┌──────────────────┐  │
│  │            │  │                                                     │  │                  │  │
│  │  STEP      │  │                                                     │  │  INTELLIGENCE    │  │
│  │  NAVIGATOR │  │              MAIN CANVAS                            │  │  PANEL           │  │
│  │            │  │                                                     │  │                  │  │
│  │  (Tree     │  │  ┌───────────────────────────────────────────────┐  │  │  AI Suggestions  │  │
│  │   View)    │  │  │                                               │  │  │  ─────────────   │  │
│  │            │  │  │                                               │  │  │  "Consider       │  │
│  │  ○ Step 1  │  │  │         SCREENSHOT VIEWER                     │  │  │   adding a       │  │
│  │  ○ Step 2  │  │  │         (larger viewport)                     │  │  │   callout here"  │  │
│  │  ● Step 3  │  │  │                                               │  │  │                  │  │
│  │  ○ Step 4  │  │  │                                               │  │  │  [Apply] [Skip]  │  │
│  │  ○ Step 5  │  │  │                                               │  │  │                  │  │
│  │    ⋮       │  │  └───────────────────────────────────────────────┘  │  │  ───────────────  │  │
│  │            │  │                                                     │  │                  │  │
│  │  240px     │  │  ┌───────────────────────────────────────────────┐  │  │  METADATA        │  │
│  │            │  │  │  TIMELINE ○───●───○───○───○───○───○───○───○   │  │  │                  │  │
│  │            │  │  └───────────────────────────────────────────────┘  │  │  Selector:       │  │
│  │            │  │                                                     │  │  #submit-btn     │  │
│  └────────────┘  └─────────────────────────────────────────────────────┘  │                  │  │
│                                                                           │  360px           │  │
│                                                                           └──────────────────┘  │
│                                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  STATUS BAR (32px)                                                                               │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Responsive Behavior Rules

### Breakpoint Definitions

```css
--bp-mobile:     0px      /* 0 - 767px */
--bp-tablet:     768px    /* 768 - 1023px */
--bp-laptop:     1024px   /* 1024 - 1279px */
--bp-desktop:    1280px   /* 1280 - 1919px */
--bp-ultrawide:  1920px   /* 1920px+ */
```

### Panel Behavior by Breakpoint

| Breakpoint | Side Editor | Step Navigator | Metadata | AI Panel |
|------------|-------------|----------------|----------|----------|
| Mobile | Bottom sheet | Hidden | Tab view | Hidden |
| Tablet | Slide-over | Hidden | Collapsed | Hidden |
| Laptop | Fixed 320px | Hidden | In side panel | Hidden |
| Desktop | Fixed 360px | Hidden | In side panel | Hidden |
| Ultrawide | Fixed 360px | Fixed 240px | In side panel | In side panel |

### Collapse Triggers

```
Side Editor:
├── Laptop+: Always visible, toggle to collapse
├── Tablet: Hidden by default, toggle to slide in
└── Mobile: Not available (use step cards)

Step Navigator:
├── Ultrawide: Always visible
├── Desktop: Hidden (use horizontal timeline)
└── Below: Hidden (use horizontal timeline or step cards)

Metadata Panel:
├── All sizes: Collapsible accordion in side panel
├── Mobile: Separate "Details" tab
└── Default state: Expanded on desktop, collapsed on mobile

AI Panel:
├── Ultrawide: Integrated in side panel
├── Desktop: Floating popover on demand
└── Mobile: Bottom sheet on demand
```

### Content Priority (Mobile-First)

1. **Critical**: Screenshot viewer, current step info
2. **Important**: Step navigation, capture controls
3. **Secondary**: Metadata, timeline
4. **Optional**: AI suggestions, advanced settings

---

## Z-Index Strategy

### Layer Stack

```
Layer 0 - Base Content
├── z-0:   Page content (behind everything)
├── z-10:  Main canvas, screenshot viewer
└── z-20:  Horizontal timeline

Layer 1 - Sticky UI
├── z-100: Status bar (bottom)
├── z-110: Capture header (top)
└── z-120: Side editor (right)

Layer 2 - Overlays
├── z-200: Step navigator (left, when overlay mode)
├── z-210: Backdrop/scrim (semi-transparent)
└── z-220: Slide-over panels

Layer 3 - Floating UI
├── z-300: Dropdowns, popovers
├── z-310: Context menus
└── z-320: Tooltips

Layer 4 - Modals
├── z-400: Modal backdrop
├── z-410: Modal content
└── z-420: Modal nested elements

Layer 5 - Critical Overlays
├── z-500: Toast notifications
├── z-510: AI suggestion bubbles
└── z-520: Capture recording indicator

Layer 6 - System
├── z-600: Error overlays
├── z-610: Loading screens
└── z-999: Debug overlays (dev only)
```

### Z-Index CSS Variables

```css
:root {
  /* Base */
  --z-base: 0;
  --z-canvas: 10;
  --z-timeline: 20;
  
  /* Sticky UI */
  --z-status-bar: 100;
  --z-header: 110;
  --z-side-editor: 120;
  
  /* Overlays */
  --z-navigator: 200;
  --z-backdrop: 210;
  --z-slide-panel: 220;
  
  /* Floating */
  --z-dropdown: 300;
  --z-context-menu: 310;
  --z-tooltip: 320;
  
  /* Modals */
  --z-modal-backdrop: 400;
  --z-modal: 410;
  --z-modal-nested: 420;
  
  /* Critical */
  --z-toast: 500;
  --z-ai-bubble: 510;
  --z-recording-indicator: 520;
  
  /* System */
  --z-error: 600;
  --z-loading: 610;
  --z-debug: 999;
}
```

### Stacking Context Rules

1. **Isolation**: Each major panel creates its own stacking context
2. **No gaps**: Z-index values increment by 10 to allow insertion
3. **Semantic groups**: Related elements share a z-index range
4. **Capture indicator always visible**: Highest z-index in normal UI

---

## Non-Blocking Interaction Rules

### During Active Capture

```
MUST NOT BLOCK:
├── Page scrolling
├── Page clicking (for capture)
├── Keyboard input (for capture)
├── Page navigation
└── Browser shortcuts

MUST ALLOW:
├── Side panel interaction
├── Step editing
├── Pause/resume controls
├── Panel collapse/expand
└── Screenshot preview
```

### Implementation Strategy

```css
/* Side editor: pointer-events only on panel, not container */
.side-editor-container {
  position: fixed;
  right: 0;
  top: 0;
  height: 100vh;
  width: 400px; /* includes toggle tab */
  pointer-events: none; /* Allow clicks through to page */
}

.side-editor-panel {
  pointer-events: auto; /* Panel itself captures clicks */
}

.side-editor-toggle {
  pointer-events: auto; /* Toggle tab captures clicks */
}

/* Capture header: minimal height, non-intrusive */
.capture-header {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  pointer-events: auto;
  /* Centered pill, doesn't span full width */
}

/* Alternative: Top-right floating indicator */
.capture-indicator {
  position: fixed;
  top: 16px;
  right: 380px; /* Offset from side panel */
  pointer-events: auto;
}
```

### Focus Management

```
Tab order:
1. Capture controls (header)
2. Current step in side panel
3. Metadata fields
4. Action buttons

Escape key:
├── If editing: Cancel edit
├── If modal open: Close modal
├── If panel focused: Return focus to page
└── Otherwise: No action (don't interfere with page)
```

---

## Component Specifications

### Capture Status Header

```
┌─────────────────────────────────────────────────────────────────┐
│  [●] Recording  │  12 steps  │  00:03:42  ║  [⏸ Pause] [✓ Finish] │
└─────────────────────────────────────────────────────────────────┘

Height: 48px
Background: --bg-surface with subtle border-bottom
Position: Fixed top-center (pill style) or full-width

Recording Indicator:
├── Red dot with pulse animation when recording
├── Yellow dot when paused
└── Gray dot when idle

Timer: Elapsed time since capture started
Step Count: Updates in real-time as steps are captured

Actions:
├── Pause/Resume toggle button
└── Finish button (stops capture, opens summary)
```

### Side Editor Panel

```
┌──────────────────────────────────────┐
│  STEP TIMELINE                       │
│  ════════════════════════════════    │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ [thumb] Step 12                │  │
│  │         Click 'Submit' Button  │  │
│  │         2:34 PM · ✓ Saved      │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ [thumb] Step 11                │  │
│  │         Type in 'Email' Field  │  │
│  │         2:33 PM · ✓ Saved      │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ [thumb] Step 10                │  │
│  │         Navigate to /signup    │  │
│  │         2:32 PM · ✓ Saved      │  │
│  └────────────────────────────────┘  │
│                                      │
│          (scrollable)                │
│                                      │
├──────────────────────────────────────┤
│  METADATA [▼]                        │
│  ──────────────────────────────────  │
│  Selector: #submit-btn               │
│  URL: https://example.com/signup     │
│  Tab: Main Window                    │
│  Captured: 2:34:12 PM                │
└──────────────────────────────────────┘

Width: 360px (desktop), 320px (tablet/laptop)
Position: Fixed right
Toggle: Purple tab on left edge
```

### Screenshot Viewer

```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                     │    │
│  │     ┌───────────────────────────────────────────┐   │    │
│  │     │                                           │   │    │
│  │     │                                           │   │    │
│  │     │          SCREENSHOT                       │   │    │
│  │     │                                           │   │    │
│  │     │    ┌─────────┐                            │   │    │
│  │     │    │ Element │ ← Highlight overlay        │   │    │
│  │     │    │ [info]  │   with element info        │   │    │
│  │     │    └─────────┘                            │   │    │
│  │     │                                           │   │    │
│  │     └───────────────────────────────────────────┘   │    │
│  │                                                     │    │
│  │  [100%] ─────●───────────────── [Fit] [1:1] [⛶]    │    │
│  │   Zoom slider              View controls            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ○───○───●───○───○───○───○───○───○───○───○───○      │    │
│  │  1   2   3   4   5   6   7   8   9  10  11  12      │    │
│  │              ↑ Current step                         │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘

Features:
├── Pan: Click and drag
├── Zoom: Scroll wheel or slider
├── Element highlight: Overlay on captured element
└── Timeline: Click to jump between steps
```

---

## Keyboard Shortcuts

```
Global (always available):
├── Ctrl/Cmd + S      Save current step edits
├── Escape            Close modal / cancel edit
├── ?                 Show keyboard shortcuts

Navigation:
├── ← / →             Previous / next step
├── Home / End        First / last step
├── 1-9               Jump to step 1-9
├── Ctrl + G          Go to step (number input)

Capture:
├── Space             Pause / resume capture
├── Ctrl + Enter      Finish capture
├── Ctrl + Z          Undo last step (if supported)

Editing:
├── E                 Edit current step title
├── D                 Edit current step description
├── Delete            Delete current step (with confirm)
├── Ctrl + D          Duplicate current step

View:
├── [ / ]             Collapse / expand side panel
├── Ctrl + +/-        Zoom screenshot in/out
├── Ctrl + 0          Reset screenshot zoom
├── F                 Toggle fullscreen screenshot
```

---

## Performance Considerations

### Virtualization

```
Step list: Virtualized after 50 items
├── Only render visible steps + 5 buffer
├── Recycle DOM nodes on scroll
└── Lazy load thumbnails

Screenshot viewer:
├── Progressive loading (blur-up)
├── Tile-based rendering for large images
└── WebGL acceleration if available
```

### Memory Management

```
Screenshot cache:
├── Keep last 10 in memory (full size)
├── Keep all as thumbnails (compressed)
└── Evict on low memory warning

Step data:
├── Full data for visible + 20 buffer
├── Metadata only for remaining
└── Lazy fetch on scroll
```

---

*This layout system prioritizes non-blocking capture, responsive adaptation, and clear visual hierarchy.*
