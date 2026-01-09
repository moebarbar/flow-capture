# Tech Intelligence Editor - Design System

A visual identity that feels like **AI + DevTools + Notion had a baby**.

---

## Design Philosophy

### Why This System Feels Intelligent, Not Flashy

**1. Information Hierarchy Over Decoration**
Every visual element serves a purpose. If something doesn't help the user understand, navigate, or act faster, it's removed. Intelligence is communicated through clarity, not complexity.

**2. Confidence Through Restraint**
Premium tools don't need to prove themselves. The interface stays quiet until needed. Hover states appear. Tooltips surface contextually. AI suggestions materialize when relevant. This restraint signals competence.

**3. Density Without Overwhelm**
Like DevTools, we embrace information density—but with intentional breathing room. Data-rich doesn't mean cluttered. White space is used surgically to create visual rhythm.

**4. Predictable Motion = Trust**
Animations confirm actions, not entertain. When something moves, it means something happened. Users learn to trust the interface because it never surprises them unnecessarily.

**5. Dark-First = Focus-First**
Dark themes reduce eye strain during long sessions and draw attention to content, not chrome. Light mode exists for accessibility and preference, not as an afterthought.

---

## Color Palette

### Dark Theme (Primary)

```
Background Layers (darkest to lightest):
--bg-deep:        #09090b    Base layer, editor background
--bg-surface:     #0f0f12    Cards, panels, elevated surfaces
--bg-elevated:    #18181b    Hover states, active items
--bg-overlay:     #1f1f23    Modals, dropdowns, floating UI

Borders:
--border-subtle:  #27272a    Default borders, separators
--border-default: #3f3f46    Active/focused borders
--border-bright:  #52525b    High-contrast borders (rare)

Text:
--text-primary:   #fafafa    Headlines, primary content
--text-secondary: #a1a1aa    Descriptions, metadata
--text-tertiary:  #71717a    Placeholders, disabled
--text-inverse:   #09090b    Text on light backgrounds
```

### Accent Colors

```
Primary (Intelligence Blue):
--accent-primary:      #3b82f6    Primary actions, active states
--accent-primary-dim:  #1d4ed8    Pressed states
--accent-primary-glow: #3b82f620  Subtle backgrounds, glows

Why blue: Universally associated with trust, technology, and intelligence.
Not electric—slightly muted for extended viewing.

Secondary (Insight Purple):
--accent-secondary:      #8b5cf6    AI features, smart suggestions
--accent-secondary-dim:  #6d28d9    AI active states
--accent-secondary-glow: #8b5cf620  AI-related backgrounds

Why purple: Signals intelligence, creativity, AI-powered features.
Distinguishes "smart" features from standard actions.

Success (Confidence Green):
--success:      #22c55e    Saved, synced, complete
--success-dim:  #16a34a    Pressed states
--success-bg:   #22c55e15  Success backgrounds

Danger (Alert Red):
--danger:       #ef4444    Errors, destructive actions
--danger-dim:   #dc2626    Pressed states
--danger-bg:    #ef444415  Error backgrounds

Warning (Caution Amber):
--warning:      #f59e0b    Warnings, pending states
--warning-dim:  #d97706    Pressed states
--warning-bg:   #f59e0b15  Warning backgrounds
```

### Light Theme (Accessibility Mode)

```
Background Layers:
--bg-deep:       #ffffff
--bg-surface:    #fafafa
--bg-elevated:   #f4f4f5
--bg-overlay:    #ffffff

Borders:
--border-subtle:  #e4e4e7
--border-default: #d4d4d8
--border-bright:  #a1a1aa

Text:
--text-primary:   #09090b
--text-secondary: #52525b
--text-tertiary:  #a1a1aa

Accents remain the same with adjusted opacity for backgrounds.
```

---

## Typography

### Font Stack

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
```

**Why Inter**: Designed for screens, excellent legibility at small sizes, extensive weight options, free.

**Why JetBrains Mono**: Technical credibility, ligature support, optimized for code display.

### Type Scale

```
--text-xs:   11px / 1.4    Micro labels, step numbers
--text-sm:   13px / 1.5    Metadata, secondary info, badges
--text-base: 14px / 1.6    Body text, step descriptions
--text-md:   15px / 1.5    Emphasized body, panel headers
--text-lg:   17px / 1.4    Section headers
--text-xl:   20px / 1.3    Page headers
--text-2xl:  24px / 1.2    Major headlines (rare)
```

### Font Weights

```
--weight-normal:   400    Body text
--weight-medium:   500    Emphasis, labels
--weight-semibold: 600    Headers, buttons
--weight-bold:     700    Headlines (used sparingly)
```

### Typography Rules

1. **No font size below 11px** - Accessibility requirement
2. **Monospace for selectors, code, technical data** - Visual distinction
3. **Medium weight for interactive elements** - Indicates clickability
4. **Line height increases with text size decrease** - Maintains readability
5. **Letter-spacing: -0.01em for headlines** - Tightens large text elegantly

---

## Spacing System

### Base Unit: 4px

```
--space-0:   0
--space-1:   4px     Micro gaps (icon to text)
--space-2:   8px     Tight spacing (within components)
--space-3:   12px    Default gap (between related items)
--space-4:   16px    Section padding (cards, panels)
--space-5:   20px    Major sections
--space-6:   24px    Panel padding
--space-8:   32px    Large separations
--space-10:  40px    Page-level spacing
--space-12:  48px    Maximum spacing
```

### Layout Rules

**Panels & Containers**
```
Padding: 16px (--space-4) minimum
Border radius: 8px for cards, 6px for buttons, 4px for inputs
```

**Component Spacing**
```
Between related items: 8px
Between groups: 16px
Between sections: 24px
```

**Information Density Modes**
```
Compact:  8px vertical rhythm, 12px padding
Default:  12px vertical rhythm, 16px padding
Relaxed:  16px vertical rhythm, 20px padding
```

---

## Layout Architecture

### Editor Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  Command Bar (48px)                                    [AI] [?] │
├────────────┬───────────────────────────────────┬────────────────┤
│            │                                   │                │
│  Step      │   Main Canvas                     │  Intelligence  │
│  Navigator │   (Screenshot + Annotations)      │  Panel         │
│            │                                   │                │
│  240px     │   Flex                            │  320px         │
│  min       │                                   │  collapsible   │
│            │                                   │                │
│            ├───────────────────────────────────┤                │
│            │   Step Detail Bar (variable)      │                │
│            │                                   │                │
├────────────┴───────────────────────────────────┴────────────────┤
│  Status Bar (32px)                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Responsive Breakpoints

```
--bp-sm:   640px    Mobile (panels stack)
--bp-md:   768px    Tablet (side panel collapses)
--bp-lg:   1024px   Desktop (standard layout)
--bp-xl:   1280px   Wide (relaxed spacing)
--bp-2xl:  1536px   Ultra-wide (additional panels)
```

### Z-Index Scale

```
--z-base:      0      Default content
--z-elevated:  10     Cards, elevated surfaces
--z-sticky:    20     Sticky headers
--z-dropdown:  30     Dropdowns, popovers
--z-modal:     40     Modal backdrops
--z-overlay:   50     Modal content
--z-toast:     60     Toast notifications
--z-tooltip:   70     Tooltips (always on top)
```

---

## Icon System

### Style Guidelines

**Type**: Outlined, 1.5px stroke weight
**Size**: 16px default, 14px compact, 20px headers
**Library**: Lucide React (consistent, MIT licensed)

### Icon Categories

```
Navigation:    ChevronRight, ArrowLeft, Menu, X
Actions:       Play, Pause, Plus, Trash2, Edit3, Copy
Status:        Check, AlertCircle, Info, Loader
AI Features:   Sparkles, Wand2, Brain, Lightbulb
Media:         Image, Video, Camera, Maximize2
```

### Icon Usage Rules

1. **Icons always paired with text for primary actions** - Accessibility
2. **Icon-only buttons require tooltips** - Discoverability
3. **Consistent sizing within context** - Visual harmony
4. **Color inherits from text** - Automatic theme support
5. **No filled icons except for toggle states** - Visual consistency

### Icon Animation

```css
/* Loader rotation */
.icon-spin {
  animation: spin 1s linear infinite;
}

/* Subtle pulse for AI features */
.icon-pulse {
  animation: pulse 2s ease-in-out infinite;
}

/* Scale on hover for interactive icons */
.icon-interactive:hover {
  transform: scale(1.1);
  transition: transform 150ms ease;
}
```

---

## Animation Philosophy

### Core Principle: Motion = Meaning

Every animation must answer: "What is this telling the user?"

**Valid reasons for animation:**
- Confirming an action completed (save, sync, delete)
- Showing state change (recording started, paused)
- Guiding attention (new step appeared, error occurred)
- Revealing information (panel expanded, tooltip shown)

**Invalid reasons for animation:**
- Making things look "cool"
- Filling silence during loading (use skeleton states instead)
- Entrance animations for static content
- Continuous movement without state change

### Timing Functions

```css
--ease-default:  cubic-bezier(0.4, 0, 0.2, 1)    Standard transitions
--ease-in:       cubic-bezier(0.4, 0, 1, 1)      Elements exiting
--ease-out:      cubic-bezier(0, 0, 0.2, 1)      Elements entering
--ease-bounce:   cubic-bezier(0.34, 1.56, 0.64, 1)  Confirmations (rare)
```

### Duration Scale

```css
--duration-instant:  75ms     Micro-interactions (opacity)
--duration-fast:     150ms    Button states, hovers
--duration-normal:   200ms    Panel transitions
--duration-slow:     300ms    Modal open/close
--duration-slower:   500ms    Complex transitions (rare)
```

### Approved Animations

```css
/* State change confirmation */
.save-indicator {
  animation: confirm 300ms ease-out;
}
@keyframes confirm {
  0% { transform: scale(0.8); opacity: 0; }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); opacity: 1; }
}

/* Sync spinner */
.sync-spinner {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Panel slide */
.panel-enter {
  animation: slideIn 200ms ease-out;
}
@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

/* Subtle pulse for AI suggestions */
.ai-suggestion {
  animation: aiPulse 3s ease-in-out infinite;
}
@keyframes aiPulse {
  0%, 100% { box-shadow: 0 0 0 0 var(--accent-secondary-glow); }
  50% { box-shadow: 0 0 0 4px var(--accent-secondary-glow); }
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Component Patterns

### Buttons

```
Primary:   Blue background, white text, used for main CTAs
Secondary: Transparent, border, used for secondary actions
Ghost:     No border, subtle hover, used for toolbar actions
Danger:    Red background, used only for destructive actions

Sizes:
- sm: 28px height, 12px padding, text-sm
- md: 36px height, 16px padding, text-base (default)
- lg: 44px height, 20px padding, text-md
```

### Inputs

```
Background:  --bg-deep (inset feel)
Border:      --border-subtle, --border-default on focus
Focus ring:  2px --accent-primary with 20% opacity
Height:      36px default, 32px compact

Monospace variant for selectors and code inputs.
```

### Cards

```
Background:  --bg-surface
Border:      1px --border-subtle
Radius:      8px
Shadow:      None (flat aesthetic) or subtle on hover
Padding:     16px
```

### Status Badges

```
Synced:    Green background, checkmark icon
Pending:   Amber background, clock icon
Failed:    Red background, alert icon
AI:        Purple background, sparkles icon
```

---

## Why This Feels Intelligent

### 1. **Semantic Color Usage**
Colors have meaning. Blue = action. Purple = AI. Green = success. Users learn the language without reading documentation.

### 2. **Density Matches Expertise**
The interface is information-rich because workflow documentation requires seeing context. But every piece of information has visual hierarchy—users know where to look.

### 3. **Quiet When Idle, Responsive When Active**
The dark, minimal aesthetic recedes when users are thinking. When they act, the interface responds immediately and predictably.

### 4. **Technical Credibility**
Monospace fonts for selectors. Precise spacing. Clean lines. This signals that the tool understands the user's domain—technical documentation.

### 5. **No Gratuitous Flair**
No gradients. No parallax. No bouncing animations. Every visual choice is functional. This restraint signals confidence and professionalism.

### 6. **AI as Assistant, Not Spectacle**
AI features use subtle purple accents and gentle animations—present but not overwhelming. The AI enhances; it doesn't dominate.

---

## Implementation Notes

### CSS Custom Properties

All values defined as CSS custom properties for:
- Runtime theme switching without page reload
- Consistent values across components
- Easy maintenance and updates

### Dark/Light Toggle

```css
:root {
  /* Default: dark theme values */
}

:root.light {
  /* Override with light theme values */
}
```

### Component Library Compatibility

This system is designed to work with:
- Tailwind CSS (via theme extension)
- shadcn/ui (via CSS variables)
- Radix UI primitives
- Custom components

---

*This design system prioritizes function over form. Every decision serves the user's ability to create, edit, and share workflow documentation efficiently.*
