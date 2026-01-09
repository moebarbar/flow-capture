# Element Intelligence Panel

A technical deep-dive panel that reveals the full context of captured elements—hidden by default, powerful when needed.

---

## Design Philosophy

```
FOR BASIC USERS:
└── Panel is invisible. They never need to know it exists.
    Everything "just works."

FOR ADVANCED USERS:
└── Panel is one click away. Full control, full transparency.
    Nothing is hidden from them.
```

---

## Panel Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  ELEMENT INTELLIGENCE                                     [×]   │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ELEMENT TYPE                                             │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │  <button>                                                 │  │
│  │  Primary Action Button                                    │  │
│  │                                                           │  │
│  │  Role: button    │  Interactive: Yes  │  Visible: Yes     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  SELECTOR QUALITY                                  92/100 │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │  ████████████████████████████████████░░░░                 │  │
│  │                                                           │  │
│  │  Primary:   #submit-btn                        ●  Stable  │  │
│  │  Fallback:  button[type="submit"]              ●  Good    │  │
│  │  XPath:     //button[@id='submit-btn']         ○  Backup  │  │
│  │                                                           │  │
│  │  [Copy Primary]  [Copy All]  [Test Selector]              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  VISIBILITY STATUS                                        │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │  ✓  Element was visible at capture                        │  │
│  │  ✓  Element was in viewport                               │  │
│  │  ✓  Element was not obscured                              │  │
│  │  ✓  Element was enabled                                   │  │
│  │                                                           │  │
│  │  Position: (542, 680)  │  Size: 180 × 44px                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  PAGE CONTEXT                                             │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │  URL:    https://example.com/signup                       │  │
│  │  Title:  Create Account | Example                         │  │
│  │  Tab:    Main Window (Tab 1)                              │  │
│  │  Time:   Jan 9, 2026 2:34:12 PM                           │  │
│  │                                                           │  │
│  │  [Open URL]  [Copy URL]                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ⚠ POTENTIAL RISKS                                        │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │                                                           │  │
│  │  ⚠  Dynamic class detected: "btn-xK7mN2"                  │  │
│  │     Selector may break if page regenerates                │  │
│  │     [Use data-testid instead]                             │  │
│  │                                                           │  │
│  │  ℹ  Multiple matches possible (3 elements)                │  │
│  │     Consider adding parent context                        │  │
│  │     [Add specificity]                                     │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ▸ Raw Attributes (12)                                          │
│  ▸ Computed Styles (collapsed)                                  │
│  ▸ DOM Path                                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Section Details

### 1. Element Type

```
┌───────────────────────────────────────────────────────────────┐
│  ELEMENT TYPE                                                 │
│  ─────────────────────────────────────────────────────────    │
│                                                               │
│  <button>                    ← HTML tag                       │
│  Primary Action Button       ← Semantic description           │
│                                                               │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐    │
│  │ Role        │ Interactive │ Focusable   │ Visible     │    │
│  │ button      │ Yes ●       │ Yes ●       │ Yes ●       │    │
│  └─────────────┴─────────────┴─────────────┴─────────────┘    │
│                                                               │
└───────────────────────────────────────────────────────────────┘

ELEMENT CATEGORIES:
├── Interactive: button, a, input, select, textarea
├── Container: div, section, article, nav
├── Media: img, video, audio, canvas
├── Form: form, fieldset, label
└── Text: p, span, h1-h6

SEMANTIC DESCRIPTIONS:
├── "Primary Action Button" (button.primary, button[type="submit"])
├── "Navigation Link" (a in nav, a.nav-link)
├── "Text Input Field" (input[type="text"])
├── "Password Field" (input[type="password"])
├── "Checkbox Toggle" (input[type="checkbox"])
├── "Dropdown Menu" (select, [role="listbox"])
└── "Image" (img, [role="img"])
```

### 2. Selector Quality Score

```
┌───────────────────────────────────────────────────────────────┐
│  SELECTOR QUALITY                                      92/100 │
│  ─────────────────────────────────────────────────────────    │
│                                                               │
│  ████████████████████████████████████████░░░░░░░░             │
│  │                                                            │
│  └─ Visual score bar (color-coded)                            │
│                                                               │
│  PRIMARY SELECTOR                                             │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  #submit-btn                                     [Copy] │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ●  Stable   Uses ID (highly reliable)                        │
│                                                               │
│  FALLBACK SELECTORS                                           │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  button[data-testid="submit-registration"]       [Copy] │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ●  Good   Uses data-testid (test-friendly)                   │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  form.signup-form > button[type="submit"]        [Copy] │  │
│  └─────────────────────────────────────────────────────────┘  │
│  ○  Backup   Path-based (may break with DOM changes)          │
│                                                               │
│  [Test Selector] ← Opens selector in DevTools-like tester     │
│                                                               │
└───────────────────────────────────────────────────────────────┘

SCORE CALCULATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

90-100  ████████████████████  Excellent
        Uses ID or data-testid, unique, stable

70-89   ████████████████░░░░  Good  
        Uses stable attributes, low collision risk

50-69   ████████████░░░░░░░░  Moderate
        Uses classes or paths, some collision risk

30-49   ████████░░░░░░░░░░░░  Weak
        Uses dynamic classes or deep paths

0-29    ████░░░░░░░░░░░░░░░░  Fragile
        High risk of breaking, needs attention

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCORING FACTORS:
├── ID selector:              +40 points
├── data-testid:              +35 points
├── data-* attribute:         +30 points
├── aria-label unique:        +25 points
├── Unique class name:        +20 points
├── name attribute:           +15 points
├── Type + position:          +10 points
├── Path-based:               +5 points
│
├── Dynamic class detected:   -20 points
├── Position-dependent:       -15 points
├── Multiple matches:         -10 points
├── Deep nesting (>5):        -5 points
└── Framework-generated:      -10 points
```

### 3. Visibility Status

```
┌───────────────────────────────────────────────────────────────┐
│  VISIBILITY STATUS                                            │
│  ─────────────────────────────────────────────────────────    │
│                                                               │
│  AT CAPTURE TIME:                                             │
│                                                               │
│  ✓  Element was visible                                       │
│     display: block, visibility: visible                       │
│                                                               │
│  ✓  Element was in viewport                                   │
│     Fully visible, no scroll needed                           │
│                                                               │
│  ✓  Element was not obscured                                  │
│     No overlapping elements detected                          │
│                                                               │
│  ✓  Element was enabled                                       │
│     Not disabled, not aria-disabled                           │
│                                                               │
│  ─────────────────────────────────────────────────────────    │
│                                                               │
│  POSITION & SIZE                                              │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Viewport:  1920 × 1080                                 │  │
│  │  Position:  x: 542, y: 680 (center of element)          │  │
│  │  Size:      180 × 44 px                                 │  │
│  │  Bounding:  452, 658, 632, 702 (LTRB)                   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  [Highlight in Screenshot]                                    │
│                                                               │
└───────────────────────────────────────────────────────────────┘

STATUS INDICATORS:
├── ✓ Green checkmark: Condition met
├── ⚠ Yellow warning: Potential issue  
├── ✗ Red X: Problem detected
└── ○ Gray circle: Unknown/not checked

POTENTIAL ISSUES:
├── "Element was below the fold"
├── "Element was partially visible"
├── "Element was behind overlay"
├── "Element was disabled"
├── "Element had opacity < 1"
└── "Element was zero-sized"
```

### 4. Page Context

```
┌───────────────────────────────────────────────────────────────┐
│  PAGE CONTEXT                                                 │
│  ─────────────────────────────────────────────────────────    │
│                                                               │
│  URL                                                          │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  https://example.com/signup?ref=homepage          [Copy] │  │
│  └─────────────────────────────────────────────────────────┘  │
│  [Open in New Tab]                                            │
│                                                               │
│  PAGE TITLE                                                   │
│  Create Account | Example App                                 │
│                                                               │
│  TAB INFORMATION                                              │
│  ┌─────────────┬─────────────┬─────────────────────────────┐  │
│  │ Tab ID      │ Window      │ Status                      │  │
│  │ 1234        │ Main (1)    │ Captured                    │  │
│  └─────────────┴─────────────┴─────────────────────────────┘  │
│                                                               │
│  CAPTURE TIMESTAMP                                            │
│  January 9, 2026 at 2:34:12.456 PM (local)                    │
│  Unix: 1736441652456                                          │
│                                                               │
│  SESSION INFO                                                 │
│  Guide: "User Registration Flow"                              │
│  Step: 12 of 15                                               │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 5. Potential Risks

```
┌───────────────────────────────────────────────────────────────┐
│  ⚠ POTENTIAL RISKS                                    2 found │
│  ─────────────────────────────────────────────────────────    │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  ⚠  DYNAMIC CLASS DETECTED                     Moderate │  │
│  │  ─────────────────────────────────────────────────────  │  │
│  │                                                         │  │
│  │  Class "btn-xK7mN2" appears to be dynamically generated │  │
│  │  (matches pattern: short alphanumeric suffix)           │  │
│  │                                                         │  │
│  │  Impact: Selector may break when page regenerates       │  │
│  │  classes during build or deploy.                        │  │
│  │                                                         │  │
│  │  Recommendation:                                        │  │
│  │  Use data-testid="submit-btn" instead                   │  │
│  │                                                         │  │
│  │  [Apply Fix]  [Ignore]  [Learn More]                    │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  ℹ  MULTIPLE MATCHES POSSIBLE                       Low │  │
│  │  ─────────────────────────────────────────────────────  │  │
│  │                                                         │  │
│  │  Selector "button.primary" matches 3 elements on page.  │  │
│  │  Current selector includes parent context to ensure     │  │
│  │  uniqueness.                                            │  │
│  │                                                         │  │
│  │  Matched elements:                                      │  │
│  │  1. form.signup > button.primary  ← Selected            │  │
│  │  2. header > button.primary                             │  │
│  │  3. footer > button.primary                             │  │
│  │                                                         │  │
│  │  [Add More Specificity]  [Ignore]                       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
└───────────────────────────────────────────────────────────────┘

RISK CATEGORIES:

HIGH SEVERITY (Red):
├── Selector matches zero elements
├── Element no longer exists in DOM
├── Framework detected with known issues
└── Selector uses :nth-child with dynamic content

MODERATE SEVERITY (Yellow):
├── Dynamic/generated class names
├── Multiple possible matches
├── Deep DOM nesting (>7 levels)
└── Position-dependent selector

LOW SEVERITY (Blue):
├── Minor specificity concerns
├── Could be more robust
├── Framework-specific patterns
└── Informational notes

RISK DETECTION PATTERNS:
├── /[a-z]{2,4}-[A-Za-z0-9]{5,8}/ → Dynamic class (CSS modules, styled-components)
├── /^_[A-Za-z0-9]{6,}/ → CSS-in-JS generated
├── /css-[0-9a-z]+/ → Emotion/styled-components
├── /:nth-child\(\d+\)/ → Position-dependent
└── />.*>.*>.*>.*>/ → Deep nesting
```

---

## Collapsible Sections

### Raw Attributes

```
▸ Raw Attributes (12)
  │
  └─ Click to expand:

┌───────────────────────────────────────────────────────────────┐
│  ▾ Raw Attributes (12)                               [Copy All]│
│  ─────────────────────────────────────────────────────────    │
│                                                               │
│  id             submit-btn                                    │
│  class          btn btn-primary btn-lg                        │
│  type           submit                                        │
│  data-testid    submit-registration                           │
│  aria-label     Submit registration form                      │
│  tabindex       0                                             │
│  disabled       false                                         │
│  form           signup-form                                   │
│  name           submit                                        │
│  value          Submit                                        │
│  autofocus      false                                         │
│  formaction     (none)                                        │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### DOM Path

```
▸ DOM Path
  │
  └─ Click to expand:

┌───────────────────────────────────────────────────────────────┐
│  ▾ DOM Path                                          [Copy]   │
│  ─────────────────────────────────────────────────────────    │
│                                                               │
│  html                                                         │
│   └─ body                                                     │
│       └─ div#app                                              │
│           └─ main.content                                     │
│               └─ section.signup-section                       │
│                   └─ form.signup-form                         │
│                       └─ div.form-actions                     │
│                           └─ button#submit-btn  ← TARGET      │
│                                                               │
│  Full XPath:                                                  │
│  /html/body/div[@id='app']/main/section/form/div/button       │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## How It Stays Hidden

### Progressive Disclosure Strategy

```
LEVEL 0 - BASIC USER (Default)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

User sees: Step card with title, description, thumbnail
Panel: Completely hidden, no indication it exists

Trigger: None (unless risk detected)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEVEL 1 - CURIOUS USER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

User sees: Subtle "ℹ" icon appears on step hover
Panel: Available on click

Trigger: Hover over step for 300ms reveals info icon

┌────────────────────────────────────────────────────────────┐
│  12  [img]  Click 'Submit' Button                      [ℹ] │
│             Submits the form                               │
└────────────────────────────────────────────────────────────┘
                                                          │
                                                          └─ Info icon
                                                             (hover-visible)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEVEL 2 - TECHNICAL USER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

User action: Clicks info icon OR presses 'I' key
Panel: Slides in from right or expands below step

Setting: "Always show element details" in preferences

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEVEL 3 - RISK DETECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

System detects: Potential selector issue
User sees: Warning badge on step (non-intrusive)

┌────────────────────────────────────────────────────────────┐
│  12  [img]  Click 'Submit' Button                  ⚠  [ℹ] │
│             Submits the form                               │
└────────────────────────────────────────────────────────────┘
                                                      │
                                                      └─ Warning badge
                                                         (always visible)

User can: Click warning to see risk details, or ignore it
```

### Panel Display Modes

```
MODE 1: SLIDE-OVER (Desktop)
┌──────────────────────────────────────┬─────────────────────┐
│                                      │                     │
│          MAIN EDITOR                 │  ELEMENT            │
│                                      │  INTELLIGENCE       │
│                                      │  PANEL              │
│                                      │                     │
│                                      │  (slides in from    │
│                                      │   right, 360px)     │
│                                      │                     │
└──────────────────────────────────────┴─────────────────────┘

MODE 2: INLINE EXPAND (Tablet/Mobile)
┌────────────────────────────────────────────────────────────┐
│  Step 12: Click 'Submit' Button                        [ℹ] │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ELEMENT INTELLIGENCE                                      │
│  (expands below step, full width)                          │
│                                                            │
└────────────────────────────────────────────────────────────┘

MODE 3: MODAL (Quick View)
┌────────────────────────────────────────────────────────────┐
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  ELEMENT INTELLIGENCE                            [×] │  │
│  │  (centered modal, 480px)                             │  │
│  │                                                      │  │
│  │  For quick inspection without layout shift           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Keyboard Access

```
I          Open/close panel for selected step
Escape     Close panel
Tab        Navigate between panel sections
C          Copy primary selector
T          Test selector (opens tester)
R          Refresh/recalculate risks
```

---

## How It Builds Trust with Technical Users

### 1. Full Transparency

```
NOTHING IS HIDDEN:
├── Raw HTML attributes visible
├── Full DOM path shown
├── Exact capture timestamp with milliseconds
├── All selector alternatives listed
└── Risk calculations explained

WHY THIS MATTERS:
├── Technical users distrust "magic"
├── They want to verify the system's decisions
├── They need to debug when things break
└── They want to understand limitations
```

### 2. Professional Vocabulary

```
USES DEVELOPER TERMS:
├── "CSS Selector" not "element finder"
├── "XPath" available for those who prefer it
├── "DOM Path" with actual structure
├── "data-testid" recognized and prioritized
└── Bounding box coordinates for debugging

NOT DUMBED DOWN:
├── Shows actual selector syntax
├── Displays technical attributes
├── Provides DevTools-like interface
└── Respects user's expertise
```

### 3. Actionable Information

```
EVERY INSIGHT HAS AN ACTION:
├── Risk detected → [Apply Fix] button
├── Selector shown → [Copy] button  
├── Multiple matches → [Add Specificity] button
├── URL shown → [Open in New Tab] button
└── Position shown → [Highlight in Screenshot] button

NO INFORMATION WITHOUT PURPOSE:
├── If we show it, you can act on it
├── If we flag it, you can fix it
└── If we calculate it, you can verify it
```

### 4. Selector Testing

```
[Test Selector] OPENS:
┌───────────────────────────────────────────────────────────────┐
│  SELECTOR TESTER                                         [×]  │
│  ─────────────────────────────────────────────────────────    │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  #submit-btn                                     [Test] │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  RESULT:                                                      │
│  ✓ Matched 1 element                                          │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  <button id="submit-btn" class="btn btn-primary">       │  │
│  │    Submit Registration                                   │  │
│  │  </button>                                               │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  [Highlight on Page]  [Use This Selector]                     │
│                                                               │
└───────────────────────────────────────────────────────────────┘

ALLOWS:
├── Edit selector and retest
├── Try alternative selectors
├── Verify uniqueness
└── Copy validated selector
```

### 5. Export & Integration

```
EXPORT OPTIONS:
├── Copy as CSS selector
├── Copy as XPath
├── Copy as Playwright locator
├── Copy as Cypress selector
├── Copy as Selenium locator
└── Copy full element JSON

INTEGRATION SIGNALS:
├── Recognizes data-testid (testing best practice)
├── Recognizes data-cy (Cypress)
├── Recognizes data-test (common pattern)
├── Warns about anti-patterns
└── Suggests test-friendly alternatives
```

### 6. No Surprises

```
PREDICTABLE BEHAVIOR:
├── Panel opens same way every time
├── Sections stay expanded/collapsed as user left them
├── Preferences persist across sessions
├── No auto-opening on hover (only on click)
└── Close button always in same position

RESPECTS WORKFLOW:
├── Doesn't interrupt capture
├── Doesn't block editing
├── Doesn't auto-refresh while user is reading
└── Warns before destructive actions
```

---

## User Preference Settings

```
┌───────────────────────────────────────────────────────────────┐
│  ELEMENT INTELLIGENCE SETTINGS                                │
│  ─────────────────────────────────────────────────────────    │
│                                                               │
│  VISIBILITY                                                   │
│  ○  Hide panel (click ℹ to open)               ← Default     │
│  ○  Show panel when step selected                             │
│  ○  Always show panel                                         │
│                                                               │
│  RISK WARNINGS                                                │
│  [●] Show warning badge on steps with issues                  │
│  [●] Highlight risks in step list                             │
│  [ ] Auto-expand risk section when issues found               │
│                                                               │
│  SELECTOR PREFERENCES                                         │
│  Preferred format:                                            │
│  [▾ CSS Selector (default)]                                   │
│  │                                                            │
│  ├─ CSS Selector (default)                                    │
│  ├─ XPath                                                     │
│  ├─ Playwright                                                │
│  └─ Cypress                                                   │
│                                                               │
│  [●] Prioritize data-testid when available                    │
│  [●] Warn about dynamic class names                           │
│  [●] Suggest selector improvements                            │
│                                                               │
│  ADVANCED                                                     │
│  [●] Show DOM path                                            │
│  [ ] Show computed styles                                     │
│  [●] Show raw attributes                                      │
│  [ ] Enable selector testing                                  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Summary: Hidden Power

| User Type | Experience |
|-----------|------------|
| **Basic** | Never sees panel. Steps "just work." |
| **Curious** | Discovers panel via info icon on hover. |
| **Technical** | Uses panel for debugging and validation. |
| **Power** | Enables always-visible mode, uses keyboard shortcuts. |

### Trust-Building Principles

1. **Transparency** — Show everything, hide nothing
2. **Vocabulary** — Use proper technical terms
3. **Actionability** — Every insight has a next step
4. **Verification** — Let users test and validate
5. **Predictability** — Consistent, reliable behavior
6. **Respect** — Don't dumb it down, don't force it

---

*The Element Intelligence Panel is the difference between "trust us" and "verify yourself." Technical users don't want faith—they want evidence.*
