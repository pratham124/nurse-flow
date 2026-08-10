# Phase 8 Task 6 Regression Pass

Date: 2026-08-10

Status: in progress. Safe automated and signed-out native checks are complete.
Authenticated manual-override, two-session request, and previous-phase workflow
checks still require explicit approval to create disposable Supabase test accounts
or user-provided test-account access. No test account was created during this pass.

## Test environment

- Android Pixel 5 API 34 emulator
- Current Expo development build for `com.pfrog123.firstapp`
- Portrait viewport: 1080 by 2340 physical pixels
- Landscape viewport after the orientation fix: 2340 by 1080 physical pixels
- Android maximum font-size setting used for the dynamic-type check, then restored
- TalkBack is not installed in this emulator image; Android Settings returns
  `No results for TalkBack`

## Regression found and fixed

The app was locked to portrait in both `app.json` and the generated Android
manifest. That prevented the Phase 8 expanded landscape layouts from being
reached on a native device even though the React layout already responded to
window width.

The durable Expo orientation is now `default`. The local generated Android
activity was refreshed to `unspecified` for the emulator rebuild. After
rebuilding, the native root bounds changed from 1080 by 2340 in portrait to
2340 by 1080 in landscape. No shift, assignment, request, or navigation state
was changed by this fix.

## Completed evidence

### Build and automated checks

- Current Android debug build: pass
- Incremental Android rebuild after the orientation fix: pass
- TypeScript (`tsc --noEmit`): pass
- Expo lint: pass
- Targeted regression tests: 23 passed, 0 failed
  - local identifiers: 2
  - effective assignment and move preview: 8
  - request realtime: 1
  - request lifecycle and notification routing: 8
  - responsive breakpoint: 2
  - floor-board lookup: 2

### Repeatable large-fixture measurement

The fixture contains 200 rooms, 400 beds, 40 nurses, 100 flags, 4 doctor
sides, and 250 request messages.

| Path | Optimized median | Comparison median | Optimized p95 | Comparison p95 |
| --- | ---: | ---: | ---: | ---: |
| Floor-board lookup | 0.351 ms | 4.815 ms | 0.931 ms | 7.933 ms |
| Thread timestamp formatting | 0.797 ms | 29.539 ms | 1.371 ms | 38.782 ms |

The optimized paths remain materially faster without adding a list library or
changing assignment rules.

### Signed-out native accessibility and responsive checks

- Login and signup load without an app error.
- Email, password, display-name, sign-in, signup, and account-switch controls
  expose readable Android accessibility labels and roles.
- Primary controls remain large touch targets in the inspected native bounds.
- Portrait-to-landscape rotation now changes the real app viewport.
- At Android's maximum font-size setting, login labels grow, controls remain
  readable, and the screen remains scrollable in portrait and landscape.
- The emulator font setting was restored after the check.

### Scope and readability audit

- No production optimizer, solver objective, AI, EHR/EMR, automated-acuity,
  multi-hospital, handoff-note, global-chat, offline-write-queue, or
  conflict-merging implementation exists in production code.
- Generated assignment remains the baseline; `getEffectiveAssignmentResult`
  projects only active bed-keyed overrides over it.
- `createFloorBoardLookup` indexes the current effective shift and does not scan
  server override history.
- A swap is accepted before it is completed; completion requires a saved linked
  override ID, and later assignment changes remain distinguishable.
- Request messages and realtime topics carry both shift and request scope, while
  server RPCs remain responsible for authorization.

## Remaining manual matrix

### Task 6.1: Manual Override Pass

Pending authenticated native validation of eligible moves, blocked moves,
warning acknowledgement, stale writes, realtime refresh, rerun behavior, swipe
reveal, tap selection, and confirmation.

### Task 6.2: Request Thread and Lifecycle Pass

Pending two authenticated sessions for authorization, realtime messages,
disconnected state, issue lifecycle, swap decision/completion, and thread-leak
checks.

### Task 6.3: Responsive, Accessibility, and Performance Pass

Native rotation, maximum text size, control semantics, signed-out scrolling,
and repeatable performance measurements pass. Authenticated active-shift screen
checks remain pending. Spoken TalkBack traversal is an environment limitation
because TalkBack is not installed on this emulator image.

### Task 6.4: Previous-Phase Regression Pass

Automated assignment, realtime, lifecycle, notification-routing, responsive,
and lookup regressions pass. Authenticated floor/shift setup, persistence,
carry-over, invites, joined-nurse scope, connection-disabled actions, template
and snapshot immutability, and notification-failure isolation remain pending.

### Task 6.5: Scope and Beginner-Readability Pass

The code-scope and boundary review passes. Task markers, the final understanding
checklist entry, and the teaching checkpoint must wait until the remaining
credential-dependent checks are complete.
