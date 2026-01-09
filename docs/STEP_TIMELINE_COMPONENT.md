# Step Timeline - Intelligence Feed Component

An advanced vertical timeline that transforms captured steps into an intelligent, navigable feed.

---

## Component Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  STEP TIMELINE                                    [+ Add Step]   │
│  ═══════════════════════════════════════════════════════════════ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ⋮⋮  12  ┌─────┐  Click 'Submit' Button              ✓ ●   │  │
│  │ drag    │thumb│  Submits the registration form            │  │
│  │         └─────┘  button#submit · 2:34 PM                  │  │
│  │                  ▸ View element details                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                               │                                  │
│                               ▼                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ⋮⋮  11  ┌─────┐  Type in 'Email' Field               ○    │  │
│  │         │thumb│  Enters user email address                │  │
│  │         └─────┘  input#email · 2:33 PM                    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                               │                                  │
│                               ▼                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ⋮⋮  10  ┌─────┐  Navigate to /signup                 ○    │  │
│  │         │thumb│  Opens the registration page              │  │
│  │         └─────┘  navigation · 2:32 PM                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                               │                                  │
│                               ⋮                                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Step Card Anatomy

### Full Step Card (320px width)

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  ⋮⋮   12   ┌────────────┐   Click 'Submit' Button    ✓  ●  │
│  │    │    │            │   │                         │  │  │
│  │    │    │ Screenshot │   │                         │  │  │
│  │    │    │  Thumbnail │   └─ Title (editable)       │  │  │
│  │    │    │   64x48    │                             │  │  │
│  │    │    │            │   Submits the registration  │  │  │
│  │    │    └────────────┘   form to create account    │  │  │
│  │    │                     │                         │  │  │
│  │    └─ Step Number        └─ Description (editable) │  │  │
│  │       (click to select)                            │  │  │
│  │                          ┌─────────────────────────┤  │  │
│  └─ Drag Handle             │ button#submit-btn      │  │  │
│     (visible on hover)      │ 2:34:12 PM             │  │  │
│                             └─ Selector + Time ──────┘  │  │
│                                                         │  │
│                         Sync Status: ✓ Saved ───────────┘  │
│                         Selection: ● (radio, one active)   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  ▸ Element Details (collapsed by default)                    │
│    └─ Expands to show full metadata                          │
└──────────────────────────────────────────────────────────────┘
```

### Compact Step Card (for dense view)

```
┌──────────────────────────────────────────────────────────────┐
│  12  [img]  Click 'Submit' Button          button  ✓  2:34  │
└──────────────────────────────────────────────────────────────┘
```

---

## Visual Distinction by Action Type

### Action Type Indicators

```
┌─────────────────────────────────────────────────────────────┐
│  ACTION TYPE        │  COLOR ACCENT    │  ICON             │
├─────────────────────┼──────────────────┼───────────────────┤
│  click              │  Blue #3b82f6    │  MousePointer     │
│  type / input       │  Teal #14b8a6    │  Type             │
│  navigate           │  Purple #8b5cf6  │  Navigation       │
│  scroll             │  Slate #64748b   │  ArrowUpDown      │
│  select (dropdown)  │  Amber #f59e0b   │  ChevronDown      │
│  check / toggle     │  Green #22c55e   │  CheckSquare      │
│  hover              │  Pink #ec4899    │  MousePointer2    │
│  drag               │  Orange #f97316  │  Move             │
│  upload             │  Cyan #06b6d4    │  Upload           │
│  screenshot         │  Indigo #6366f1  │  Camera           │
└─────────────────────────────────────────────────────────────┘
```

### Visual Treatment

```css
/* Left border accent by action type */
.step-card[data-action="click"] {
  border-left: 3px solid var(--action-click);
}

.step-card[data-action="type"] {
  border-left: 3px solid var(--action-type);
}

/* Action badge in card */
.action-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  background: var(--action-color-10);
  color: var(--action-color);
}
```

---

## Keyboard Navigation

### Navigation Keys

```
MOVEMENT
────────────────────────────────────────────────────────
↑ / k          Move selection to previous step
↓ / j          Move selection to next step
Home           Jump to first step
End            Jump to last step
Page Up        Jump 5 steps up
Page Down      Jump 5 steps down
1-9            Jump to step 1-9 directly
Ctrl + G       Open "Go to step" dialog

SELECTION
────────────────────────────────────────────────────────
Enter          Expand selected step details
Space          Toggle step selection (multi-select)
Escape         Clear selection / exit mode
Ctrl + A       Select all steps

EDITING
────────────────────────────────────────────────────────
E              Edit title of selected step
D              Edit description of selected step
Tab            Move to next editable field
Shift + Tab    Move to previous editable field
Ctrl + Enter   Save edit and exit edit mode
Escape         Cancel edit

REORDERING
────────────────────────────────────────────────────────
Alt + ↑        Move selected step up
Alt + ↓        Move selected step down
Alt + Home     Move to top
Alt + End      Move to bottom
Ctrl + Z       Undo last reorder
Ctrl + Y       Redo reorder

ACTIONS
────────────────────────────────────────────────────────
Delete         Delete selected step(s) with confirm
Ctrl + D       Duplicate selected step
Ctrl + C       Copy step to clipboard
Ctrl + V       Paste step after selection
M              Merge with previous step (combine)
S              Split step (if applicable)
```

### Focus Indicators

```css
/* Visible focus ring for keyboard users */
.step-card:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px var(--accent-primary-glow);
}

/* Selection state (can have focus + selection) */
.step-card[data-selected="true"] {
  background: var(--bg-elevated);
  border-color: var(--accent-primary);
}

/* Current step (being viewed in canvas) */
.step-card[data-current="true"] {
  background: var(--accent-primary-glow);
}
```

---

## Inline Editing

### Title Edit Mode

```
┌──────────────────────────────────────────────────────────────┐
│  12  [img]  ┌────────────────────────────────────────────┐   │
│             │ Click 'Submit' Button                    │█│   │
│             └────────────────────────────────────────────┘   │
│             │                                                │
│             └─ Input field replaces title                    │
│                Border: accent color                          │
│                Focus: auto-select all text                   │
│                                                              │
│             [Save ↵]  [Cancel Esc]  ← Inline hints           │
└──────────────────────────────────────────────────────────────┘
```

### Description Edit Mode

```
┌──────────────────────────────────────────────────────────────┐
│  12  [img]  Click 'Submit' Button                            │
│             ┌────────────────────────────────────────────┐   │
│             │ Submits the registration form to create    │   │
│             │ a new user account with the provided       │   │
│             │ email and password.                        │   │
│             └────────────────────────────────────────────┘   │
│             │                                                │
│             └─ Textarea (auto-grow, max 4 lines)             │
│                Shift+Enter for newline                       │
│                Enter to save                                 │
│                                                              │
│             72/200 characters                                │
└──────────────────────────────────────────────────────────────┘
```

### Edit Behaviors

```
TITLE EDITING
├── Trigger: Click title, press E, or double-click card
├── Selection: All text selected on focus
├── Save: Enter, blur, or click away
├── Cancel: Escape
├── Validation: 1-100 characters, required
└── Feedback: Success toast on save

DESCRIPTION EDITING
├── Trigger: Click description, press D
├── Selection: Cursor at end
├── Save: Ctrl+Enter or blur
├── Cancel: Escape
├── Validation: 0-500 characters, optional
└── Auto-resize: Grows with content, max 4 lines
```

---

## Hover Intelligence

### Metadata Preview Popover

When hovering over a step for 300ms, show a popover with extended details:

```
                    ┌─────────────────────────────────────────┐
                    │  ELEMENT DETAILS                        │
                    │  ─────────────────────────────────────  │
┌──────────────┐    │                                         │
│  Step 12     │    │  Selector                               │
│  Click...    │ ──▶│  button#submit-btn.primary              │
│              │    │  [Copy]                                 │
└──────────────┘    │                                         │
                    │  Element Type                           │
                    │  <button> · Primary Button              │
                    │                                         │
                    │  Text Content                           │
                    │  "Submit Registration"                  │
                    │                                         │
                    │  Position                               │
                    │  x: 542, y: 680                         │
                    │  w: 180, h: 44                          │
                    │                                         │
                    │  Attributes                             │
                    │  ┌───────────────────────────────────┐  │
                    │  │ id: submit-btn                    │  │
                    │  │ class: primary, large             │  │
                    │  │ type: submit                      │  │
                    │  │ data-testid: submit-registration  │  │
                    │  └───────────────────────────────────┘  │
                    │                                         │
                    │  ─────────────────────────────────────  │
                    │  Tab: Main Window                       │
                    │  URL: example.com/signup                │
                    │  Captured: Jan 9, 2026 2:34:12 PM       │
                    └─────────────────────────────────────────┘
```

### Hover States

```
TIMING
├── Appear delay: 300ms (prevents accidental triggers)
├── Disappear delay: 100ms (allows moving to popover)
└── Animation: Fade in 150ms

POSITIONING
├── Default: Right of step card
├── Near right edge: Left of step card
├── Near bottom: Above step card
└── Offset: 8px gap from card

INTERACTION
├── Hovering popover keeps it open
├── Click inside: Stays open, allows copying
├── Click outside: Closes immediately
└── Escape: Closes immediately
```

### Quick Actions on Hover

```
┌────────────────────────────────────────────────────────────┐
│  12  [img]  Click 'Submit' Button    ┌─────────────────┐   │
│             Submits the form         │ [📋] [✏️] [🗑️] │   │
│                                      └─────────────────┘   │
│                                            │               │
│                                            └─ Quick actions│
│                                               Copy         │
│                                               Edit         │
│                                               Delete       │
└────────────────────────────────────────────────────────────┘

Visibility: Only on hover (opacity transition)
Position: Top-right corner of card
Size: 24px icon buttons
```

---

## Safe Reordering

### Drag and Drop

```
DRAG INITIATION
├── Handle: Grip dots (⋮⋮) on left side
├── Anywhere: Hold for 200ms to initiate
└── Keyboard: Alt + Arrow keys

VISUAL FEEDBACK
├── Dragged item: Slight scale (1.02), elevated shadow
├── Drop zone: Blue line between steps
├── Invalid zone: Red line (if dropping would break flow)
└── Other items: Subtle shift to make room

SAFETY MEASURES
├── Confirm: Toast with undo option
├── Undo: Ctrl+Z within 10 seconds
├── Batch: Multiple moves = single undo
└── Sync: Server update after 1s debounce
```

### Reorder Animation

```css
/* Smooth reorder animation */
.step-card {
  transition: transform 200ms ease-out;
}

.step-card[data-dragging="true"] {
  transform: scale(1.02);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  z-index: 100;
  cursor: grabbing;
}

.step-card[data-drop-target="true"]::before {
  content: '';
  position: absolute;
  top: -2px;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--accent-primary);
  border-radius: 2px;
}
```

### Reorder Validation

```
ALLOWED
├── Any step can move to any position
├── Multiple selected steps move together
└── Maintains relative order within selection

PREVENTED
├── Moving to same position (no-op)
└── Moving during active capture (optional lock)

AUTO-RENUMBER
├── Numbers update after reorder
├── Smooth number transition animation
└── Original order preserved in metadata
```

---

## Why This Feels Faster

### 1. Zero-Click Information

**Traditional**: Click step → Wait for panel → Scan for info → Click another step
**Intelligence Feed**: Hover 300ms → See everything → Move mouse → See next

**Time saved**: ~2 seconds per step inspection

### 2. Keyboard-First Navigation

**Traditional**: Mouse to list → Click → Mouse to panel → Click field → Type
**Intelligence Feed**: j/k to navigate → E to edit → Type → Enter

**Time saved**: ~1.5 seconds per edit (no hand movement)

### 3. Inline Context

**Traditional**: Title in one place, screenshot in another, metadata in a third
**Intelligence Feed**: All context visible within the step card

**Time saved**: ~1 second per step (no visual scanning)

### 4. Predictive Actions

**Traditional**: Find action button → Click → Confirm
**Intelligence Feed**: Quick actions appear on hover, single click

**Time saved**: ~0.5 seconds per action

### 5. Batch Operations

**Traditional**: Select one → Act → Select next → Act → Repeat
**Intelligence Feed**: Select multiple (Space) → Act once

**Time saved**: ~3 seconds for 5 items

### 6. Undo Confidence

**Traditional**: Hesitate before changes, fear of mistakes
**Intelligence Feed**: Bold actions knowing Ctrl+Z works

**Time saved**: Eliminates decision paralysis

---

## Cognitive Load Reduction

### Visual Hierarchy

```
PRIMARY (immediate attention)
├── Step number (navigation anchor)
├── Step title (what happened)
└── Action type color (category recognition)

SECONDARY (available on focus)
├── Screenshot thumbnail (visual confirmation)
├── Description (additional context)
└── Sync status (system state)

TERTIARY (on demand)
├── Element selector (technical detail)
├── Timestamp (audit trail)
└── Full metadata (deep inspection)
```

### Progressive Disclosure

```
Level 0 - Glance (50ms)
└── Number + Color accent = Know which step, what type

Level 1 - Scan (200ms)
└── Title + Thumbnail = Understand the action

Level 2 - Read (1s)
└── Description + Selector = Full context

Level 3 - Inspect (hover/expand)
└── All metadata = Technical deep-dive
```

### Muscle Memory Patterns

After 10 uses, users develop:
- j/k for navigation (like Vim, Gmail)
- E for edit (like many editors)
- Space for select (like file managers)
- Alt+Arrow for reorder (like VS Code)

These patterns transfer from other professional tools, reducing learning curve.

---

## Accessibility

### Screen Reader Support

```html
<div role="listbox" aria-label="Workflow steps">
  <div role="option" 
       aria-selected="true"
       aria-posinset="12" 
       aria-setsize="15"
       aria-describedby="step-12-details">
    <span class="sr-only">Step 12 of 15, selected</span>
    <span>Click 'Submit' Button</span>
  </div>
</div>

<div id="step-12-details" class="sr-only">
  Click action on button element with selector button#submit-btn, 
  captured at 2:34 PM. Status: Saved.
</div>
```

### Color Independence

All action types have:
- Unique icons (not just colors)
- Text labels available
- Pattern differences on focus

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .step-card {
    transition: none;
  }
  
  .step-card[data-dragging="true"] {
    transform: none;
    box-shadow: 0 0 0 2px var(--accent-primary);
  }
}
```

---

## Performance

### Virtualization

```
Steps 1-100:     Full virtualization
Steps 101-500:   Aggressive virtualization
Steps 500+:      Pagination with "Load more"

Visible buffer:  10 items above/below viewport
Thumbnail load:  Intersection Observer
Animation:       RequestAnimationFrame
```

### Optimistic Updates

```
User action → Immediate UI update → Background sync
                    ↓
              If sync fails → Revert + Show error
```

---

*This timeline component treats each step as a first-class intelligence unit, not just a list item. Users interact with a feed of decisions, not a table of data.*
