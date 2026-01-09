# Enterprise Editor Features

Advanced collaboration and governance features that stay invisible to solo users while providing powerful capabilities for teams.

---

## Design Philosophy

```
SOLO USER EXPERIENCE:
├── Clean, simple interface
├── No empty collaboration panels
├── No disabled "upgrade" buttons
├── No hint these features exist
└── Tool feels personal and focused

ENTERPRISE USER EXPERIENCE:
├── Same clean base interface
├── Features appear contextually
├── Complexity reveals progressively
├── Power available when needed
└── Tool feels collaborative and governed
```

---

## Feature Overview

| Feature | Solo User | Team (Pro) | Enterprise |
|---------|-----------|------------|------------|
| Step Approval | Hidden | Hidden | ✓ |
| Comments | Hidden | ✓ Basic | ✓ Threaded |
| Change History | Hidden | 7 days | Unlimited |
| Version Comparison | Hidden | ✓ | ✓ + Restore |
| Step Permissions | Hidden | Hidden | ✓ |
| Audit Logs | Hidden | Hidden | ✓ |
| Review Workflows | Hidden | Hidden | ✓ |

---

## 1. Step Approval Workflow

### When Visible

```
VISIBILITY RULES:
├── Solo: Never shown
├── Team Pro: Never shown (no approval workflow)
├── Enterprise: Shown when approval workflow is enabled
└── Trigger: Workspace admin enables "Require approval for publish"
```

### Approval States

```
DRAFT (default):
┌────────────────────────────────────────────────────────────────┐
│  12  [thumb]  Click 'Submit' Button                            │
│               Submits the registration form                    │
│                                                                │
│               Status: Draft                                    │
└────────────────────────────────────────────────────────────────┘

PENDING APPROVAL:
┌────────────────────────────────────────────────────────────────┐
│  12  [thumb]  Click 'Submit' Button                   🕐       │
│               Submits the registration form                    │
│                                                                │
│               ⏳ Awaiting approval from Sarah                   │
│               Submitted 2 hours ago                            │
│                                                                │
│               [Cancel Request]                                 │
└────────────────────────────────────────────────────────────────┘

APPROVED:
┌────────────────────────────────────────────────────────────────┐
│  12  [thumb]  Click 'Submit' Button                   ✓        │
│               Submits the registration form                    │
│                                                                │
│               ✓ Approved by Sarah                              │
│               Approved 1 hour ago                              │
└────────────────────────────────────────────────────────────────┘

CHANGES REQUESTED:
┌────────────────────────────────────────────────────────────────┐
│  12  [thumb]  Click 'Submit' Button                   ⚠        │
│               Submits the registration form                    │
│                                                                │
│               ⚠ Changes requested by Sarah                     │
│               "Please clarify what form fields are required"   │
│                                                                │
│               [View Feedback]  [Resubmit]                      │
└────────────────────────────────────────────────────────────────┘
```

### Approval Panel (Reviewers Only)

```
┌─────────────────────────────────────────────────────────────────┐
│  APPROVAL REQUEST                                               │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  Step 12: Click 'Submit' Button                                 │
│  Submitted by: Alex · 2 hours ago                               │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  CHANGES FROM PREVIOUS VERSION                            │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │                                                           │  │
│  │  - Title: Updated for clarity                             │  │
│  │  - Description: Added form field details                  │  │
│  │  - Screenshot: New capture                                │  │
│  │                                                           │  │
│  │  [View Full Diff]                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Add feedback (optional):                                 │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │                                                     │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [Request Changes]  [Approve]                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Guide-Level Approval

```
GUIDE HEADER WITH APPROVAL STATUS:
┌─────────────────────────────────────────────────────────────────┐
│  User Registration Flow                                         │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  APPROVAL STATUS                                          │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │                                                           │  │
│  │  15 steps total                                           │  │
│  │  ✓  12 approved                                           │  │
│  │  ⏳  2 pending approval                                    │  │
│  │  ⚠   1 needs changes                                      │  │
│  │                                                           │  │
│  │  [Submit All for Approval]  [View Pending]                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Comments

### Comment Visibility

```
VISIBILITY RULES:
├── Solo: No comment UI at all
├── Team Pro: Simple comments (flat, no threading)
├── Enterprise: Threaded comments with @mentions
└── Trigger: Comment feature enabled at workspace level
```

### Comment Indicator (When Comments Exist)

```
STEP WITH COMMENTS:
┌────────────────────────────────────────────────────────────────┐
│  12  [thumb]  Click 'Submit' Button                   💬 3     │
│               Submits the registration form                    │
└────────────────────────────────────────────────────────────────┘
                                                         │
                                                         └─ Comment count
                                                            Click to view
```

### Comment Panel

```
TEAM PRO (Simple Comments):
┌─────────────────────────────────────────────────────────────────┐
│  COMMENTS                                                   [×] │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  👤 Sarah · 2 hours ago                                   │  │
│  │  Should we mention the required fields here?              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  👤 Alex · 1 hour ago                                     │  │
│  │  Good idea, I'll add that to the description.             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Add a comment...                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

ENTERPRISE (Threaded Comments):
┌─────────────────────────────────────────────────────────────────┐
│  COMMENTS                                    [Resolve All]  [×] │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  👤 Sarah · 2 hours ago                          [Resolve]│  │
│  │  Should we mention the required fields here?              │  │
│  │                                                           │  │
│  │  ├─ 👤 Alex · 1 hour ago                                  │  │
│  │  │  Good idea, I'll add that.                             │  │
│  │  │                                                        │  │
│  │  ├─ 👤 Sarah · 45 min ago                                 │  │
│  │  │  Thanks! Also @Jamie should review the legal text.     │  │
│  │  │                                                        │  │
│  │  └─ [Reply to thread...]                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ✓ RESOLVED · 👤 Jamie · 30 min ago              [Reopen]│  │
│  │  Updated the disclaimer text as discussed.                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Start a new thread...                         [@mention] │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### @Mentions

```
MENTION AUTOCOMPLETE:
┌───────────────────────────────────────────────────────────────┐
│  @sa                                                          │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  👤 Sarah Chen          sarah@company.com               │  │
│  │  👤 Samuel Wright       sam@company.com                 │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘

NOTIFICATION:
├── Mentioned user receives email notification
├── In-app notification badge
├── Can jump directly to comment
└── Respects notification preferences
```

---

## 3. Change History

### History Visibility

```
VISIBILITY RULES:
├── Solo: No history UI
├── Team Pro: 7-day history, view only
├── Enterprise: Unlimited history, restore capability
└── Trigger: History icon appears in step toolbar
```

### History Timeline

```
STEP HISTORY PANEL:
┌─────────────────────────────────────────────────────────────────┐
│  CHANGE HISTORY                                             [×] │
│  Step 12: Click 'Submit' Button                                 │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ● Current version                                        │  │
│  │    👤 Alex · Just now                                     │  │
│  │    Updated description                                    │  │
│  │                                                  [View]   │  │
│  └───────────────────────────────────────────────────────────┘  │
│         │                                                       │
│  ┌──────┴────────────────────────────────────────────────────┐  │
│  │  ○ Version 4                                              │  │
│  │    👤 Sarah · 2 hours ago                                 │  │
│  │    Fixed typo in title                                    │  │
│  │                                        [View]  [Compare]  │  │
│  └───────────────────────────────────────────────────────────┘  │
│         │                                                       │
│  ┌──────┴────────────────────────────────────────────────────┐  │
│  │  ○ Version 3                                              │  │
│  │    👤 Alex · Yesterday                                    │  │
│  │    Added screenshot annotation                            │  │
│  │                                        [View]  [Compare]  │  │
│  └───────────────────────────────────────────────────────────┘  │
│         │                                                       │
│  ┌──────┴────────────────────────────────────────────────────┐  │
│  │  ○ Version 2                                              │  │
│  │    👤 Alex · 3 days ago                                   │  │
│  │    Improved description                                   │  │
│  │                                        [View]  [Compare]  │  │
│  └───────────────────────────────────────────────────────────┘  │
│         │                                                       │
│  ┌──────┴────────────────────────────────────────────────────┐  │
│  │  ○ Version 1 (Original)                                   │  │
│  │    👤 Alex · 1 week ago                                   │  │
│  │    Initial capture                                        │  │
│  │                                        [View]  [Compare]  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Showing 5 of 5 versions                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Change Summary

```
VERSION DETAIL VIEW:
┌─────────────────────────────────────────────────────────────────┐
│  VERSION 4                                                  [×] │
│  👤 Sarah · 2 hours ago                                         │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  CHANGES MADE:                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Title                                                    │  │
│  │  - "Click 'Sumbit' Button"                                │  │
│  │  + "Click 'Submit' Button"                                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  [Screenshot Preview]                                     │  │
│  │  No changes                                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [← Previous]  [Next →]              [Restore This Version]     │
│                                      (Enterprise only)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Version Comparison

### Comparison Visibility

```
VISIBILITY RULES:
├── Solo: Hidden
├── Team Pro: Compare any two versions (view only)
├── Enterprise: Compare + Restore to any version
└── Trigger: Select two versions in history, or use [Compare] button
```

### Side-by-Side Comparison

```
VERSION COMPARISON:
┌─────────────────────────────────────────────────────────────────┐
│  COMPARE VERSIONS                                           [×] │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  ┌────────────────────────────┐  ┌────────────────────────────┐ │
│  │  VERSION 2                 │  │  VERSION 5 (Current)       │ │
│  │  👤 Alex · 3 days ago      │  │  👤 Alex · Just now        │ │
│  └────────────────────────────┘  └────────────────────────────┘ │
│                                                                 │
│  TITLE                                                          │
│  ┌────────────────────────────┐  ┌────────────────────────────┐ │
│  │  Click Submit Button       │  │  Click 'Submit' Button     │ │
│  │                            │  │          ─────             │ │
│  │                            │  │          Added quotes      │ │
│  └────────────────────────────┘  └────────────────────────────┘ │
│                                                                 │
│  DESCRIPTION                                                    │
│  ┌────────────────────────────┐  ┌────────────────────────────┐ │
│  │  Submit the form.          │  │  Submits the registration  │ │
│  │                            │  │  form to create a new user │ │
│  │                            │  │  account. Required fields  │ │
│  │                            │  │  must be completed first.  │ │
│  │  ───────────────────       │  │  ─────────────────────     │ │
│  │  Shorter version           │  │  Expanded with details     │ │
│  └────────────────────────────┘  └────────────────────────────┘ │
│                                                                 │
│  SCREENSHOT                                                     │
│  ┌────────────────────────────┐  ┌────────────────────────────┐ │
│  │                            │  │                            │ │
│  │      [Old Screenshot]      │  │      [New Screenshot]      │ │
│  │                            │  │      + 2 annotations       │ │
│  │                            │  │                            │ │
│  └────────────────────────────┘  └────────────────────────────┘ │
│                                                                 │
│               [Restore Version 2]  (Enterprise only)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Unified Diff View

```
DIFF VIEW (Alternative):
┌─────────────────────────────────────────────────────────────────┐
│  CHANGES: Version 2 → Version 5                             [×] │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  TITLE                                                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  - Click Submit Button                                    │  │
│  │  + Click 'Submit' Button                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  DESCRIPTION                                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  - Submit the form.                                       │  │
│  │  + Submits the registration form to create a new user     │  │
│  │  + account. Required fields must be completed first.      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  SCREENSHOT                                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ~ Screenshot replaced                                    │  │
│  │  + 2 annotations added                                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Step-Level Permissions

### Permissions Visibility

```
VISIBILITY RULES:
├── Solo: Hidden
├── Team Pro: Hidden (workspace-level permissions only)
├── Enterprise: Per-step permissions available
└── Trigger: Admin enables "granular permissions" in workspace settings
```

### Permission Levels

```
PERMISSION MATRIX:
┌─────────────────────────────────────────────────────────────────┐
│                    │  View  │  Edit  │  Approve  │  Delete     │
├─────────────────────────────────────────────────────────────────┤
│  Viewer            │   ✓    │   ✗    │     ✗     │    ✗        │
│  Editor            │   ✓    │   ✓    │     ✗     │    ✗        │
│  Reviewer          │   ✓    │   ✓    │     ✓     │    ✗        │
│  Admin             │   ✓    │   ✓    │     ✓     │    ✓        │
└─────────────────────────────────────────────────────────────────┘
```

### Step Permission Override

```
STEP WITH RESTRICTED PERMISSIONS:
┌────────────────────────────────────────────────────────────────┐
│  12  [thumb]  Click 'Submit' Button                   🔒       │
│               Submits the registration form                    │
│                                                                │
│               🔒 Restricted: Only Legal team can edit          │
└────────────────────────────────────────────────────────────────┘

PERMISSION SETTINGS (Admin View):
┌─────────────────────────────────────────────────────────────────┐
│  STEP PERMISSIONS                                           [×] │
│  Step 12: Click 'Submit' Button                                 │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  ○  Inherit from guide (default)                                │
│  ●  Custom permissions                                          │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  WHO CAN EDIT THIS STEP                                   │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │                                                           │  │
│  │  [×] Legal Team                                           │  │
│  │  [×] Sarah Chen                                           │  │
│  │                                                           │  │
│  │  [+ Add person or team]                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  REASON (shown to restricted users)                       │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  Contains legal disclaimer that requires review     │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│                              [Cancel]  [Save Permissions]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Restricted Step UX

```
USER WITHOUT PERMISSION CLICKS STEP:
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  🔒  This step has restricted editing                           │
│                                                                 │
│  Contains legal disclaimer that requires review                 │
│                                                                 │
│  Only Legal Team members and specific users can                 │
│  edit this step.                                                │
│                                                                 │
│  [Request Edit Access]  [View Only]                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Audit Logs

### Audit Log Access

```
VISIBILITY RULES:
├── Solo: Hidden
├── Team Pro: Hidden
├── Enterprise: Available to workspace admins
└── Trigger: Accessible via workspace settings
```

### Audit Log Panel

```
GUIDE AUDIT LOG:
┌─────────────────────────────────────────────────────────────────┐
│  ACTIVITY LOG                                               [×] │
│  User Registration Flow                                         │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│  Filter: [All Actions ▾]  [All Users ▾]  [Last 7 days ▾]        │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  👤 Alex edited Step 12                                   │  │
│  │  Changed description                                      │  │
│  │  Just now · 192.168.1.1                                   │  │
│  │                                              [View Diff]  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  👤 Sarah approved Step 12                                │  │
│  │  Approved for publishing                                  │  │
│  │  2 hours ago · 10.0.0.15                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  👤 Alex submitted Step 12 for approval                   │  │
│  │  Requested review from Sarah                              │  │
│  │  4 hours ago · 192.168.1.1                                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  👤 Jamie commented on Step 12                            │  │
│  │  "Should we add more context here?"                       │  │
│  │  Yesterday · 172.16.0.22                                  │  │
│  │                                            [View Comment] │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [Load More]                                   [Export CSV]     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Tracked Events

```
AUDIT EVENTS:
├── Step created
├── Step edited (with field changed)
├── Step deleted
├── Step reordered
├── Screenshot replaced
├── Annotation added/removed
├── Comment added
├── Comment resolved
├── Approval requested
├── Approval granted
├── Approval denied
├── Permission changed
├── Version restored
├── Guide published
├── Guide archived
└── Guide shared (with whom)
```

---

## Hiding Complexity Elegantly

### Progressive Disclosure

```
LEVEL 0 - SOLO USER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

UI SHOWS:
├── Step list
├── Edit tools
├── Sync status
└── That's it

UI HIDES:
├── Comments (no icon, no panel)
├── History (no icon, no button)
├── Approval (no status, no workflow)
├── Permissions (no locks, no settings)
└── Audit (not even in settings)

HOW: Features literally don't render. Not disabled, not hidden—absent.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEVEL 1 - TEAM PRO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

UI ADDS:
├── Comment icon (when comments exist)
├── Simple comment panel
├── 7-day history (in step menu)
├── Version comparison (view only)
└── Team member presence

UI STILL HIDES:
├── Approval workflow
├── @mentions
├── Threaded comments
├── Step permissions
├── Audit logs
├── Version restore

HOW: Features appear contextually. Empty states are minimal.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEVEL 2 - ENTERPRISE (Admin Enabled Features)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

UI ADDS (when admin enables):
├── Approval status badges
├── Approval workflow panel
├── @mentions in comments
├── Threaded discussions
├── Resolve/reopen comments
├── Unlimited history
├── Version restore button
├── Step permission locks
├── Audit log access
└── Review workflow

HOW: Admin toggles features on per-workspace basis.
     Users only see what's enabled for their workspace.
```

### Contextual Appearance

```
RULE: Features appear only when they have content or purpose.

COMMENTS:
├── No comments → No comment icon
├── 1+ comments → Show 💬 badge with count
└── Click badge → Open panel

HISTORY:
├── History disabled → No history option in menu
├── History enabled → "View history" in step menu
├── 1 version only → "No previous versions"
└── 2+ versions → Full history timeline

APPROVAL:
├── Approval disabled → No status badges
├── Approval enabled → Show draft/pending/approved
├── User is reviewer → Show approval panel
└── User is author → Show submit button

PERMISSIONS:
├── No restrictions → No lock icons
├── Step restricted → Show 🔒 icon
├── User can edit → Normal editing
└── User can't edit → Show explanation + request access
```

### Empty State Philosophy

```
WHEN FEATURE EXISTS BUT EMPTY:

BAD:
┌─────────────────────────────────────────────────────────────────┐
│  COMMENTS                                                   [×] │
│  ═══════════════════════════════════════════════════════════    │
│                                                                 │
│                    No comments yet.                             │
│           Be the first to start a discussion!                   │
│                                                                 │
│                 [Add Comment]                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

GOOD:
Don't show the panel at all. When user clicks "Add comment",
THEN show the input directly.

PRINCIPLE:
├── Empty panels waste space
├── Empty states feel lonely
├── Better to show nothing until there's something
└── First interaction creates the feature "space"
```

### Feature Discovery

```
FOR TEAM/ENTERPRISE USERS WHO HAVEN'T USED A FEATURE:

SUBTLE FIRST-USE HINT:
┌────────────────────────────────────────────────────────────────┐
│  12  [thumb]  Click 'Submit' Button                   💬       │
└────────────────────────────────────────────────────────────────┘
                                                         │
                                                         └─ Hover tooltip:
                                                            "Add a comment
                                                             for your team"

AFTER FIRST USE:
No tooltip. User knows what it does.

DISCOVERY RULES:
├── Show tooltip on first hover (once per feature)
├── Remember in user preferences
├── Never show upgrade prompts in editor
└── Never interrupt workflow to educate
```

---

## Summary

| Principle | Implementation |
|-----------|----------------|
| **Invisible to solo** | Features don't render, not just hidden |
| **Contextual appearance** | Show UI only when content exists |
| **Progressive disclosure** | Features unlock at plan level, then by admin |
| **Minimal empty states** | Don't show empty panels |
| **No upgrade friction** | Never show disabled "Pro" buttons |
| **Discovery without interruption** | Subtle tooltips on first hover |

### User Experience by Plan

| Plan | Experience |
|------|------------|
| **Solo** | Clean, personal tool. No collaboration UI. |
| **Team Pro** | Collaboration basics appear naturally. |
| **Enterprise** | Governance features when admin enables them. |

---

*Enterprise features should feel like a natural extension of the product, not a different product. Complexity is earned through need, not forced through upsell.*
