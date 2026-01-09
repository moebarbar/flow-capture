# Screenshot Interaction System

A focused, professional screenshot viewer with smart zoom, minimal annotations, and non-destructive editing.

---

## Core Philosophy

```
FEWER TOOLS = MORE PROFESSIONAL

Traditional annotation tools:
├── 47 icons
├── 12 colors
├── 8 fonts
├── 5 shapes
├── Overwhelming options
└── Result: Cluttered, amateur-looking annotations

Our approach:
├── 4 essential tools
├── 2 colors (auto-selected)
├── 1 font
├── Constraint-driven design
└── Result: Clean, consistent, professional annotations
```

---

## Screenshot Viewer

### Default State

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │                                                           │  │
│  │                                                           │  │
│  │                    SCREENSHOT                             │  │
│  │                    (fit to container)                     │  │
│  │                                                           │  │
│  │             ┌─────────────────────┐                       │  │
│  │             │   Clicked Element   │ ← Auto-highlighted    │  │
│  │             │   (subtle outline)  │                       │  │
│  │             └─────────────────────┘                       │  │
│  │                                                           │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  [Fit]  [100%]  ─────●─────  [⛶]  │  [✏️ Annotate]       │  │
│  └───────────────────────────────────────────────────────────┘  │
│       │      │         │        │              │                │
│       │      │         │        │              └─ Toggle mode   │
│       │      │         │        └─ Fullscreen                   │
│       │      │         └─ Zoom slider                           │
│       │      └─ Actual size                                     │
│       └─ Fit to view                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Zoom Behavior

```
ZOOM LEVELS:
├── Fit:     Scale to container (default)
├── 50%:     Half size
├── 100%:    Actual pixels (1:1)
├── 150%:    Slight zoom
├── 200%:    Double size
└── 400%:    Maximum zoom (for detail inspection)

ZOOM CONTROLS:
├── Slider:       Drag for precise control
├── Click Fit:    Instant fit to container
├── Click 100%:   Instant actual size
├── Scroll wheel: Zoom in/out at cursor position
├── Pinch:        Touch zoom (mobile/trackpad)
└── Double-click: Toggle between Fit and 100%
```

---

## Click-to-Zoom

### Smart Focus Behavior

```
USER CLICKS ON SCREENSHOT:
    │
    ├── If zoomed out (< 100%)
    │   └── Zoom to 150% centered on click point
    │
    ├── If at 100-150%
    │   └── Zoom to 200% centered on click point
    │
    ├── If at 200%+
    │   └── Zoom out to Fit
    │
    └── Always smooth animation (300ms)

CLICK ON HIGHLIGHTED ELEMENT:
    │
    └── Zoom to element + 20% padding
        └── Element fills ~60% of viewport
        └── Context visible around element
```

### Smart Focus Algorithm

```javascript
function smartFocus(element, container) {
  // Calculate ideal zoom to show element with context
  const elementRect = element.boundingBox;
  const containerRect = container.getBoundingClientRect();
  
  // Element should fill 60% of viewport
  const targetFill = 0.6;
  
  const scaleX = (containerRect.width * targetFill) / elementRect.width;
  const scaleY = (containerRect.height * targetFill) / elementRect.height;
  
  // Use smaller scale to ensure element fits
  const zoom = Math.min(scaleX, scaleY, 4); // Max 400%
  
  // Center on element
  const centerX = elementRect.x + elementRect.width / 2;
  const centerY = elementRect.y + elementRect.height / 2;
  
  return { zoom, centerX, centerY };
}
```

### Visual Feedback

```
ZOOMING IN:
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│     ┌─────────────────────────────────────────────────────┐   │
│     │                                                     │   │
│     │         ╭─────────────────────────╮                 │   │
│     │         │     Button clicked      │ ← Target        │   │
│     │         │     (zooming in...)     │                 │   │
│     │         ╰─────────────────────────╯                 │   │
│     │                                                     │   │
│     └─────────────────────────────────────────────────────┘   │
│                                                               │
│     Zoom: 100% → 200%  ████████████░░░░░░░░  (animating)      │
│                                                               │
└───────────────────────────────────────────────────────────────┘

ZOOMED STATE:
┌───────────────────────────────────────────────────────────────┐
│                                                               │
│     ┌─────────────────────────────────────────────────────┐   │
│     │                                                     │   │
│     │    ╭───────────────────────────────────────────╮    │   │
│     │    │                                           │    │   │
│     │    │         Submit Registration               │    │   │
│     │    │                                           │    │   │
│     │    ╰───────────────────────────────────────────╯    │   │
│     │                                                     │   │
│     └─────────────────────────────────────────────────────┘   │
│                           ↕ ↔ (draggable to pan)              │
│                                                               │
│     [Reset View]                               Zoom: 200%     │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Pan Behavior

```
WHEN ZOOMED IN (> Fit):
├── Click + Drag: Pan the image
├── Scroll: Pan vertically (shift+scroll for horizontal)
├── Arrow keys: Pan in direction (10px steps)
├── Edge indicators: Show when more content exists
└── Minimap: Optional thumbnail showing current viewport
```

---

## Minimal Annotation Tools

### The Essential Four

```
┌─────────────────────────────────────────────────────────────────┐
│  ANNOTATION TOOLBAR                                             │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────────┐  │
│  │    ○    │ │   □     │ │   →     │ │   T     │ │  [Undo]   │  │
│  │ Callout │ │  Box    │ │  Arrow  │ │  Text   │ │  [Clear]  │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └───────────┘  │
│       │           │           │           │                     │
│       │           │           │           └── Add text label    │
│       │           │           └── Point to something            │
│       │           └── Highlight area                            │
│       └── Number marker (1, 2, 3...)                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Tool Behaviors

#### 1. Callout (Numbered Marker)

```
PURPOSE: Mark sequence points ("do this first, then this")

USAGE:
├── Click to place marker
├── Auto-increments (1, 2, 3...)
├── Can reorder by dragging
└── Double-click to edit number

APPEARANCE:
    ╭───╮
    │ 1 │  ← Solid circle, white text
    ╰───╯     Primary color background
              32px diameter

SMART BEHAVIOR:
├── Snaps to nearby element centers
├── Avoids overlapping other callouts
└── Connects to step number in timeline
```

#### 2. Box (Highlight Rectangle)

```
PURPOSE: Draw attention to an area

USAGE:
├── Click + drag to draw rectangle
├── Drag corners to resize
├── Drag center to move
└── Click outside to deselect

APPEARANCE:
    ┌─────────────────────────┐
    │                         │  ← 2px border, primary color
    │   (transparent fill)    │     Subtle fill (10% opacity)
    │                         │     Rounded corners (4px)
    └─────────────────────────┘

SMART BEHAVIOR:
├── Snaps to element boundaries
├── Shift+drag for perfect square
└── Shows dimensions on resize
```

#### 3. Arrow

```
PURPOSE: Point to something specific

USAGE:
├── Click start point, drag to end
├── Drag endpoints to adjust
├── Arrow automatically points outward
└── Click line to select

APPEARANCE:
              │
              │     ← 2px stroke, primary color
              │        Smooth curve (slight arc)
              ▼        Arrow head at end only

SMART BEHAVIOR:
├── Curves slightly for visual appeal
├── Avoids crossing other annotations
├── Snaps to element edges
└── Shift+drag for straight lines
```

#### 4. Text Label

```
PURPOSE: Add explanatory text

USAGE:
├── Click to place text box
├── Type immediately (no dialog)
├── Click outside to finish
└── Double-click to edit

APPEARANCE:
    ┌─────────────────────────────────┐
    │  Click here to continue         │  ← Background: semi-transparent
    └─────────────────────────────────┘    Text: white, 14px, medium weight
                                           Padding: 8px 12px
                                           Rounded: 6px

SMART BEHAVIOR:
├── Auto-sizes to content
├── Max width: 240px (then wraps)
├── Connects to nearest arrow if close
└── Moves with connected elements
```

---

## Color System

### Automatic Color Selection

```
NO COLOR PICKER. EVER.

Primary color:    Used for all annotations
                  Automatically chosen for contrast against screenshot

ALGORITHM:
1. Analyze screenshot dominant colors
2. Select high-contrast accent color
3. Apply to all annotations consistently

DEFAULT COLORS:
├── Light backgrounds → Blue (#3b82f6) or Purple (#8b5cf6)
├── Dark backgrounds  → Yellow (#fbbf24) or Cyan (#22d3ee)
├── Colorful images   → White with shadow
└── User can override in settings (one color, not per-annotation)

WHY NO COLOR PICKER:
├── Eliminates decision fatigue
├── Ensures visual consistency
├── Prevents amateur rainbow annotations
└── Looks professional regardless of user skill
```

### Single Color Override

```
SETTINGS (if user really wants different color):
┌─────────────────────────────────────────────────────────────────┐
│  Annotation color:  ○ Auto (recommended)                        │
│                     ○ Blue                                      │
│                     ○ Purple                                    │
│                     ○ Yellow                                    │
│                     ○ Green                                     │
└─────────────────────────────────────────────────────────────────┘

Still ONE color for all annotations.
No per-element color selection.
```

---

## Non-Destructive Edits

### Layer Architecture

```
SCREENSHOT STACK:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Layer 3: ANNOTATIONS (editable, deletable)
         ├── Callouts
         ├── Boxes
         ├── Arrows
         └── Text labels

Layer 2: ELEMENT HIGHLIGHT (system-generated, toggleable)
         └── Outline of clicked element

Layer 1: ORIGINAL SCREENSHOT (immutable)
         └── Never modified, always recoverable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Data Model

```json
{
  "screenshot": {
    "original": "https://storage.example.com/step_12_orig.png",
    "timestamp": "2026-01-09T14:34:12Z",
    "dimensions": { "width": 1920, "height": 1080 }
  },
  "elementHighlight": {
    "enabled": true,
    "boundingBox": { "x": 452, "y": 658, "width": 180, "height": 44 },
    "selector": "#submit-btn"
  },
  "annotations": [
    {
      "id": "ann_1",
      "type": "callout",
      "number": 1,
      "position": { "x": 542, "y": 640 },
      "createdAt": "2026-01-09T14:35:00Z"
    },
    {
      "id": "ann_2",
      "type": "arrow",
      "start": { "x": 400, "y": 600 },
      "end": { "x": 500, "y": 660 },
      "createdAt": "2026-01-09T14:35:15Z"
    },
    {
      "id": "ann_3",
      "type": "text",
      "content": "Click here to submit",
      "position": { "x": 350, "y": 580 },
      "createdAt": "2026-01-09T14:35:30Z"
    }
  ]
}
```

### Undo/Redo Stack

```
ANNOTATION HISTORY:
├── Every annotation action is recorded
├── Undo: Ctrl+Z (removes last action)
├── Redo: Ctrl+Y (restores undone action)
├── History preserved per step (not global)
└── Clear all: Removes all annotations, undoable

ACTIONS TRACKED:
├── Add annotation
├── Move annotation
├── Resize annotation
├── Edit text content
├── Delete annotation
└── Reorder callouts
```

### Recovery

```
"I MESSED UP MY ANNOTATIONS":
├── Undo: Ctrl+Z to step back
├── Clear All: Remove everything, start fresh
├── Reset: Restore to original state (no annotations)
└── Version history: See previous annotation states

ORIGINAL SCREENSHOT ALWAYS SAFE:
├── Annotations are overlays, not edits
├── Original PNG never modified
├── Can export with or without annotations
└── "View Original" toggle hides all annotations
```

---

## Syncing to Platform

### Real-Time Sync

```
ANNOTATION CREATED/MODIFIED:
    │
    ├── Immediate visual update (optimistic UI)
    │
    ├── Debounced sync (500ms after last change)
    │
    └── Batch send to server
        │
        ├── Success: Mark as synced ✓
        │
        └── Failure: Show retry indicator ⟳
                     Queue for retry
```

### Sync Protocol

```
WEBSOCKET MESSAGE:
{
  "type": "ANNOTATION_UPDATE",
  "stepId": "step_12",
  "guideId": "guide_abc123",
  "annotations": [...],
  "timestamp": "2026-01-09T14:35:30Z",
  "checksum": "sha256:..."
}

SERVER RESPONSE:
{
  "type": "ANNOTATION_ACK",
  "stepId": "step_12",
  "version": 3,
  "synced": true
}
```

### Conflict Resolution

```
SIMULTANEOUS EDITS (rare in single-user, possible in teams):
├── Last-write-wins for same annotation
├── Merge for different annotations
├── Conflict UI if same element edited differently
└── User chooses which version to keep
```

### Offline Support

```
OFFLINE EDITING:
├── Annotations stored locally
├── Sync queued for when online
├── Visual indicator: "Pending sync"
└── Auto-sync on reconnection

LOCAL STORAGE:
├── IndexedDB for annotation data
├── Service Worker for offline access
└── Sync queue persisted across sessions
```

---

## Why Fewer Tools Feel More Professional

### 1. Constraint Creates Quality

```
AMATEUR TOOLS:                    PROFESSIONAL TOOLS:
├── 47 options                    ├── 4 options
├── Rainbow colors                ├── One consistent color
├── Every font imaginable         ├── One perfect font
├── Dozens of shapes              ├── Essential shapes only
│                                 │
└── User overwhelmed,             └── User confident,
    inconsistent results              consistent results
```

### 2. Design System Enforcement

```
WITH MANY OPTIONS:
├── User A: Red arrows, Comic Sans, thick lines
├── User B: Blue boxes, Arial, thin lines
├── User C: Green highlights, no consistency
└── Result: Unprofessional, inconsistent documentation

WITH FEW OPTIONS:
├── User A: Blue callout #1
├── User B: Blue callout #2
├── User C: Blue callout #3
└── Result: Consistent, branded, professional
```

### 3. Faster Decisions

```
DECISION TIME:
├── Pick from 47 colors: 5-10 seconds
├── Pick from 0 colors (auto): 0 seconds
│
├── Pick from 12 shapes: 3-5 seconds
├── Pick from 4 tools: <1 second

TIME SAVED PER ANNOTATION: ~10 seconds
TIME SAVED FOR 20 ANNOTATIONS: ~3 minutes
```

### 4. Signal of Quality

```
PARADOX OF CHOICE:
├── More options = More anxiety
├── Fewer options = Confidence in choice
│
PROFESSIONAL TOOLS:
├── Figma: Limited but powerful
├── Linear: Opinionated defaults
├── Stripe Dashboard: Constrained UI
│
AMATEUR TOOLS:
├── MS Paint: Every option imaginable
├── Word Art: Infinite bad choices
└── Result: Cringe-worthy output
```

---

## How Annotation Never Blocks Capture

### Mode Separation

```
CAPTURE MODE:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  [●] Recording...                                               │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │                    LIVE PAGE                              │  │
│  │                    (user interacting)                     │  │
│  │                                                           │  │
│  │                    ← Clicks captured as steps             │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Side panel: Shows steps, NO annotation tools                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

EDIT MODE (after capture):
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  [✏️] Editing Step 12                                           │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  │                    SCREENSHOT                             │  │
│  │                    (static image)                         │  │
│  │                                                           │  │
│  │                    ← Annotations added here               │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Toolbar: [○ Callout] [□ Box] [→ Arrow] [T Text]                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Timing Rules

```
DURING CAPTURE:
├── Annotation toolbar: HIDDEN
├── Screenshot viewer: Shows last step (read-only)
├── Click on screenshot: Does nothing (no zoom, no edit)
├── Focus: On live page, not editor
└── User sees steps, cannot edit them

AFTER CAPTURE STOPPED:
├── Annotation toolbar: AVAILABLE
├── Screenshot viewer: Full interaction enabled
├── Click on screenshot: Zoom and pan work
├── Focus: On editor
└── User can annotate all steps
```

### Quick Annotation During Pause

```
IF USER PAUSES CAPTURE:
├── Can switch to editor view
├── Can annotate recent steps
├── Resume capture: Returns to live page
└── Annotations saved, capture continues

FLOW:
[Recording] → [Pause] → [Edit Step 5] → [Add Annotation] → [Resume] → [Recording]
                                              │
                                              └── Does not interrupt capture
```

---

## Keyboard Shortcuts

```
VIEWER:
├── +/-           Zoom in/out
├── 0             Fit to view
├── 1             100% zoom
├── F             Fullscreen toggle
├── Arrow keys    Pan (when zoomed)
├── Space + Drag  Pan mode
└── Double-click  Toggle zoom

ANNOTATION:
├── V             Select tool (default)
├── C             Callout tool
├── B             Box tool
├── A             Arrow tool
├── T             Text tool
├── Delete        Delete selected annotation
├── Escape        Deselect / exit tool
├── Ctrl+Z        Undo
├── Ctrl+Y        Redo
└── Ctrl+A        Select all annotations
```

---

## Accessibility

### Screen Reader Support

```html
<div role="img" aria-label="Screenshot of signup page with Submit button highlighted">
  <div role="group" aria-label="Annotations">
    <div role="note" aria-label="Callout 1 at position 542, 640">1</div>
    <div role="note" aria-label="Text annotation: Click here to submit">
      Click here to submit
    </div>
  </div>
</div>
```

### Keyboard-Only Annotation

```
TAB:           Cycle through annotations
ENTER:         Edit selected annotation
ARROW KEYS:    Move selected annotation (5px steps)
SHIFT+ARROWS:  Move annotation (1px precision)
DELETE:        Remove selected annotation
```

---

## Summary

| Traditional Tool | Our Approach | Why Better |
|------------------|--------------|------------|
| 47 tools | 4 tools | No decision fatigue |
| Color picker | Auto-color | Consistent look |
| Destructive edits | Layer-based | Always recoverable |
| Edit during capture | Separated modes | No interruption |
| Manual sync | Real-time sync | Always saved |
| Complex UI | Minimal controls | Professional output |

---

*The screenshot system treats every annotation as a suggestion to the viewer, not a modification to the image. Professional documentation doesn't need rainbow highlights—it needs clear, consistent visual communication.*
