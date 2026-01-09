# Intelligent Step Editor - AI-Assisted Editing

A step editor that understands context, suggests improvements, and never changes anything without explicit user approval.

---

## Core Philosophy: AI as Assistant, Not Author

```
THE RULE: AI suggests. User decides. Always.

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   User action  ──▶  AI suggestion  ──▶  User approval       │
│                          │                    │             │
│                          │                    ▼             │
│                          │              ┌──────────┐        │
│                          │              │ Applied  │        │
│                          │              └──────────┘        │
│                          │                    │             │
│                          ▼                    │             │
│                    ┌──────────┐               │             │
│                    │ Ignored  │◀──────────────┘             │
│                    └──────────┘  (if dismissed)             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Auto-Generated Titles

### Generation Logic

```
INPUT (from capture):
├── Element type (button, link, input, etc.)
├── Element text content
├── Element labels (aria-label, title, placeholder)
├── Action type (click, type, navigate, etc.)
└── Page context (URL, page title)

OUTPUT (auto-generated title):
"[Action] '[Element Text]' [Element Type]"

EXAMPLES:
├── Click 'Submit' Button
├── Type in 'Email Address' Field  
├── Navigate to /dashboard
├── Select 'United States' from 'Country' Dropdown
├── Check 'Remember Me' Checkbox
└── Upload file to 'Profile Picture'
```

### Title Generation Rules

```
PRIORITY ORDER FOR ELEMENT TEXT:
1. aria-label (most explicit)
2. Visible text content (what user sees)
3. title attribute
4. placeholder (for inputs)
5. alt text (for images)
6. name attribute
7. id (last resort, cleaned up)

CLEANUP RULES:
├── Truncate at 50 characters
├── Remove extra whitespace
├── Capitalize first letter of each word
├── Remove technical prefixes (btn-, input-, etc.)
└── Replace underscores/hyphens with spaces

FALLBACK:
"[Action] on [element type]" if no text found
```

### Editable State

```
┌─────────────────────────────────────────────────────────────┐
│  TITLE (click to edit)                                      │
│  ───────────────────────────────────────────────────────    │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Click 'Submit' Button                              AI │  │
│  └───────────────────────────────────────────────────────┘  │
│                                          │                  │
│                                          └─ AI indicator    │
│                                             (shows origin)  │
│                                                             │
│  After user edit:                                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Complete Registration Form                              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  No AI indicator (user authored)                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Description Suggestions

### Inline Suggestion UI

```
INITIAL STATE (empty description):
┌─────────────────────────────────────────────────────────────┐
│  DESCRIPTION                                                │
│  ───────────────────────────────────────────────────────    │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Add a description...                                  │  │
│  │                                                       │  │
│  │ ┌─────────────────────────────────────────────────┐   │  │
│  │ │ ✨ Suggested:                                   │   │  │
│  │ │ "Submits the registration form to create a new  │   │  │
│  │ │  user account with the provided credentials."   │   │  │
│  │ │                                                 │   │  │
│  │ │     [Apply]  [Edit]  [Dismiss]      87% ●●●●○   │   │  │
│  │ └─────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘

SUGGESTION TIMING:
├── Appears after 500ms of focus on empty field
├── Fades in gently (200ms)
└── Never interrupts active typing
```

### Suggestion Actions

```
[Apply]   → Inserts suggestion, marks as AI-assisted
[Edit]    → Opens with suggestion as starting text
[Dismiss] → Hides suggestion, doesn't ask again for this step
```

### Refinement Suggestions (for existing descriptions)

```
USER HAS WRITTEN A DESCRIPTION:
┌─────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Click the submit button                               │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 💡 Refinement available                             │    │
│  │                                                     │    │
│  │ "Submits the registration form, creating a new      │    │
│  │  user account. This step completes the signup       │    │
│  │  flow initiated in step 8."                         │    │
│  │                                                     │    │
│  │ Changes: +context, +flow reference                  │    │
│  │          [View Diff]                                │    │
│  │                                                     │    │
│  │     [Apply]  [Ignore]                    92% ●●●●● │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘

REFINEMENT ONLY SHOWS WHEN:
├── User has written at least 10 characters
├── AI finds meaningful improvements
├── Confidence > 80%
└── User hasn't dismissed suggestions for this step
```

---

## Context-Aware Intelligence

### Previous Steps Analysis

```
AI CONTEXT WINDOW:
├── Current step metadata
├── Previous 5 steps (titles, descriptions, actions)
├── Page URL and title
├── Workflow pattern detection
└── User's editing history (style preferences)

CONTEXT SIGNALS:
┌─────────────────────────────────────────────────────────────┐
│  Step 8:  Navigate to /signup                               │
│  Step 9:  Type in 'Email' Field                             │
│  Step 10: Type in 'Password' Field                          │
│  Step 11: Check 'Terms' Checkbox                            │
│  Step 12: Click 'Submit' Button  ← CURRENT                  │
│                                                             │
│  DETECTED PATTERN: Registration flow                        │
│  SUGGESTED CONTEXT: "...completes the signup process"       │
└─────────────────────────────────────────────────────────────┘
```

### Flow References

```
AI CAN SUGGEST REFERENCES TO:
├── "Continues from step X"
├── "Part of the [detected flow] process"
├── "Follows the input in step X"
└── "Completes the action started in step X"

EXAMPLE DESCRIPTION WITH CONTEXT:
"Submits the registration form with the email and password 
entered in steps 9-10. This creates a new user account and 
redirects to the dashboard."

References are ALWAYS suggestions, never auto-inserted.
```

---

## Confidence Indicators

### Visual Confidence Scale

```
CONFIDENCE LEVELS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

95-100%  ●●●●●  "High confidence"
         Green, suggestion shown prominently
         
80-94%   ●●●●○  "Good confidence"  
         Blue, suggestion shown normally
         
60-79%   ●●●○○  "Moderate confidence"
         Gray, suggestion shown subtly
         
<60%     ●●○○○  "Low confidence"
         Not shown (below threshold)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Confidence Calculation

```
FACTORS (weighted):
├── Element text clarity    (30%)
├── Action type match       (25%)
├── Context coherence       (20%)
├── Pattern recognition     (15%)
└── Similar step history    (10%)

HIGH CONFIDENCE SIGNALS:
├── Clear button/link text
├── Standard action (click, type, navigate)
├── Matches common workflow patterns
└── Previous steps provide clear context

LOW CONFIDENCE SIGNALS:
├── Generic element (div, span with no text)
├── Unusual action type
├── Disconnected from workflow
└── No readable text content
```

### Confidence Display

```
┌─────────────────────────────────────────────────────────────┐
│  ✨ Suggested description                        92% ●●●●● │
│                                                     │       │
│  "Submits the registration form..."                 │       │
│                                                     │       │
│                                                     └─ Hover│
│                                                        for  │
│                                                        breakdown
└─────────────────────────────────────────────────────────────┘

HOVER BREAKDOWN:
┌─────────────────────────────────────┐
│  Confidence: 92%                    │
│  ─────────────────────────────────  │
│  Element text:     95%  ████████░░  │
│  Action match:     100% ██████████  │
│  Context:          85%  ████████░░  │
│  Pattern:          90%  █████████░  │
│  History:          80%  ████████░░  │
└─────────────────────────────────────┘
```

---

## Undo-Safe AI Actions

### Undo Stack

```
EVERY AI ACTION IS REVERSIBLE:

User clicks [Apply] on suggestion
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│  ✓ Description updated                    [Undo] (Ctrl+Z)│
└──────────────────────────────────────────────────────────┘
    │
    │  Undo clicked or Ctrl+Z pressed
    ▼
┌──────────────────────────────────────────────────────────┐
│  ↩ Description restored                   [Redo] (Ctrl+Y)│
└──────────────────────────────────────────────────────────┘
```

### Undo Scope

```
UNDO PRESERVES:
├── Original user text
├── Cursor position
├── Selection state
└── Scroll position

UNDO HISTORY:
├── Last 50 actions per session
├── Persists during session
├── Clears on page reload (by design)
└── Separate from reorder undo
```

### Batch Undo

```
BATCH AI ACTIONS:
If user applies multiple suggestions within 3 seconds,
they are grouped as a single undo action.

User: [Apply] [Apply] [Apply] (rapid succession)
Undo: Reverts all three at once
```

---

## Avoiding "AI Spam"

### The Problem

```
❌ BAD AI BEHAVIOR:
├── Suggestions on every keystroke
├── Popups that block content
├── Auto-applying changes
├── Re-suggesting after dismissal
├── Showing low-confidence suggestions
└── Interrupting user flow
```

### The Solution: Respectful AI

```
✓ GOOD AI BEHAVIOR:

1. DELAYED APPEARANCE
   └── Wait 500ms before showing suggestions
   └── Never appear during active typing
   └── Fade in gently, not pop

2. SINGLE SUGGESTION RULE
   └── Maximum one suggestion visible at a time
   └── New suggestion replaces old
   └── Never stack multiple popups

3. DISMISSAL IS PERMANENT
   └── Dismissed = never show for this step
   └── User can re-request via button
   └── Respects "Don't suggest" setting

4. THRESHOLD GATING
   └── Only show suggestions > 70% confidence
   └── Only show if meaningfully different
   └── Only show if adds value (not obvious)

5. USER-INITIATED MODE
   └── Some users prefer to request suggestions
   └── "Suggest" button instead of auto-show
   └── Settings toggle for auto-suggestions
```

### AI Appearance Rules

```
SHOW SUGGESTION WHEN:
├── Field is focused AND empty
├── 500ms have passed
├── User is not typing
├── Confidence > 70%
├── Not previously dismissed
└── Auto-suggestions enabled

HIDE SUGGESTION WHEN:
├── User starts typing
├── User clicks dismiss
├── User clicks outside
├── Focus leaves field
└── Escape is pressed

NEVER SHOW WHEN:
├── User is mid-edit
├── User just dismissed
├── Confidence < 70%
├── Auto-suggestions disabled
└── User has written substantial text
```

### User Controls

```
SETTINGS:
┌─────────────────────────────────────────────────────────────┐
│  AI Suggestions                                             │
│  ───────────────────────────────────────────────────────    │
│                                                             │
│  [●] Auto-suggest descriptions                              │
│      Show suggestions when description is empty             │
│                                                             │
│  [●] Show refinement suggestions                            │
│      Offer improvements to existing descriptions            │
│                                                             │
│  [ ] Request-only mode                                      │
│      Only show suggestions when I click "Suggest"           │
│                                                             │
│  Minimum confidence: [====●====] 70%                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Inline Suggestion States

### State Machine

```
                    ┌──────────────┐
                    │    IDLE      │
                    │  (no field   │
                    │   focused)   │
                    └──────┬───────┘
                           │ Focus empty field
                           ▼
                    ┌──────────────┐
                    │   WAITING    │
                    │  (500ms      │
                    │   delay)     │
                    └──────┬───────┘
                           │ Timer complete
                           │ + not typing
                           ▼
         ┌─────────────────┼─────────────────┐
         │                 │                 │
    User types       Confidence OK      Confidence low
         │                 │                 │
         ▼                 ▼                 ▼
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │    HIDDEN    │  │   SHOWING    │  │    HIDDEN    │
  │  (user is    │  │ (suggestion  │  │  (below      │
  │   typing)    │  │  visible)    │  │  threshold)  │
  └──────────────┘  └──────┬───────┘  └──────────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
          [Apply]      [Dismiss]    [Edit]
              │            │            │
              ▼            ▼            ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │ APPLIED  │ │DISMISSED │ │ EDITING  │
       │(inserted)│ │(won't    │ │(pre-     │
       │          │ │ re-show) │ │ filled)  │
       └──────────┘ └──────────┘ └──────────┘
```

---

## Request-Mode Suggestions

### Manual Request UI

```
FOR USERS WHO PREFER CONTROL:

┌─────────────────────────────────────────────────────────────┐
│  DESCRIPTION                                                │
│  ───────────────────────────────────────────────────────    │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Add a description...                         [✨ AI]  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                            │                │
│                                            └─ Click to      │
│                                               request       │
│                                               suggestion    │
└─────────────────────────────────────────────────────────────┘

AFTER CLICKING [✨ AI]:

┌─────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Generating suggestion...                    [Cancel]  │  │
│  │ ████████░░░░░░░░░░░░                                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

THEN:

┌─────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ✨ Suggestion:                                        │  │
│  │ "Submits the registration form..."                    │  │
│  │                                                       │  │
│  │     [Insert]  [Regenerate]  [Cancel]      92% ●●●●●  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Regenerate Option

```
[Regenerate] → New suggestion with different approach
               └── Tries alternative phrasing
               └── May include different context
               └── Confidence may change
               └── Limited to 3 regenerations per field
```

---

## AI Attribution

### Transparency

```
AI-ASSISTED CONTENT MARKED:
┌─────────────────────────────────────────────────────────────┐
│  Description                                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Submits the registration form to create a new user    │  │
│  │ account with the provided credentials.           [AI] │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                     │       │
│                                                     └─ Small│
│                                                        badge│
└─────────────────────────────────────────────────────────────┘

BADGE BEHAVIOR:
├── Visible only on hover (not distracting)
├── Tooltip: "This was AI-generated"
├── Disappears after user edits the text
└── Can be hidden globally in settings
```

### Edit History

```
METADATA TRACKING (not shown to user):
{
  "description": "Submits the registration form...",
  "origin": "ai_suggestion",
  "originalSuggestion": "...",
  "userEdited": false,
  "confidence": 0.92,
  "generatedAt": "2026-01-09T14:34:12Z"
}

After user edit:
{
  "description": "Complete the signup process...",
  "origin": "user_edited",
  "basedOn": "ai_suggestion",
  "userEdited": true
}
```

---

## Performance & Rate Limiting

### Request Management

```
AI SUGGESTION REQUESTS:
├── Debounce: 500ms after focus
├── Max concurrent: 1 request
├── Timeout: 5 seconds
├── Cache: 5 minutes per step
└── Offline: Use cached or skip

RATE LIMITS:
├── 60 suggestions per minute (soft limit)
├── 500 suggestions per hour (hard limit)
├── Graceful degradation to request-mode
└── User notified if limits reached
```

### Caching

```
CACHE STRATEGY:
├── Cache by step metadata hash
├── Invalidate on step data change
├── Prefetch for next 2 steps
└── Background refresh on low confidence
```

---

## Summary: Why This Doesn't Feel Like "AI Spam"

| Spam Pattern | Our Solution |
|--------------|--------------|
| Constant popups | 500ms delay, single suggestion |
| Auto-changes | Always requires [Apply] click |
| Re-suggesting after dismiss | Permanent dismissal |
| Low-quality suggestions | 70% confidence threshold |
| Blocking interaction | Subtle inline display |
| No undo | Full undo stack with Ctrl+Z |
| Hidden AI origin | Transparent [AI] badge |
| Forced on users | Request-mode option |

**The key insight**: AI should feel like a helpful colleague who speaks when they have something valuable to say, not a chatbot desperate for engagement.

---

*This editor treats AI as a tool under user control, not an autonomous agent making decisions. Every suggestion is an offer, never an imposition.*
