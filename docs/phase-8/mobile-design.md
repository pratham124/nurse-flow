# Phase 8 Mobile Design

Phase 8 refines NurseFlow's established mobile visual language while adding manual assignment moves, request threads, board sharing, and tablet layouts. This is design guidance only; no prototype or implementation is part of the planning task.

## Design Principles

- Keep phone as the primary experience.
- Preserve familiar routes, labels, card hierarchy, acuity colors, and live-status treatment from earlier phases.
- Make high-risk actions deliberate: enter move mode, select a target, review consequences, then confirm.
- Use color plus labels and icons; never encode acuity, eligibility, warning severity, or status with color alone.
- Keep tap targets at least 44 points and primary actions about 52-56 points high.
- Use the existing spacing and typography system, with consistent horizontal padding and safe-area handling.
- Prefer progressive disclosure: the board stays scannable while detail, threads, and warnings open on demand.
- Treat tablets as a responsive expansion of the same workflow, not a separate product.

## Responsive Layout Model

Use semantic layout modes decided from available content width, not device name:

| Mode | Intended Behavior |
| --- | --- |
| Compact | One-column phone layout; stacked cards; full-screen detail routes or sheets. |
| Expanded | Tablet-width layout; side list plus focused detail where that improves scanning. |

Implementation should choose and document one breakpoint after checking representative devices. The breakpoint is presentation logic only and is not persisted.

### Compact Layout

- One doctor-side section at a time in the normal vertical board flow.
- Nurse cards contain compact bed rows and current flags.
- Drag targets scroll into view, with auto-scroll only if it can be implemented predictably.
- Confirmation and warning review use a bottom sheet or full-screen modal.
- Request thread is a full-screen detail view.
- Share preview is full screen so the user can inspect the entire capture.

### Expanded Layout

- Use a two-pane board: doctor sides and nurse summaries on the left; selected nurse, rooms, beds, and flags on the right.
- Keep the selected nurse visible while reviewing detail.
- Request detail can place request metadata and lifecycle controls beside the thread.
- Joined-nurse assignment uses a readable centered content region or two balanced columns.
- Setup forms that are not otherwise changed remain centered with a readable maximum width.

## Drag-and-Drop Interaction

### Entry

- Add a clear `Adjust assignments` action to the charge board.
- Entering move mode changes the header treatment and shows a short instruction.
- A visible `Done` or `Cancel` exits move mode.
- Do not make normal scrolling accidentally start a drag; use a dedicated drag handle or intentional long press.

### Drag Item

- Move one occupied bed assignment at a time.
- Show bed label, patient initials when already visible, acuity label, and current nurse.
- Lifted state uses elevation/scale and a concise accessible announcement.
- The original row remains as a placeholder so the board does not jump unpredictably.

### Drop Targets

- Eligible nurse cards receive a clear outline and `Move here` label.
- Ineligible targets remain visually present but show why they are unavailable when focused or selected.
- Hard-invalid drops return the item to its origin and announce the reason.
- A non-drag `Move assignment` action on each bed opens the same eligible-nurse picker and confirmation flow.

### Confirmation

Show:

- Bed and acuity.
- Current nurse → proposed nurse.
- Before/after loads for both nurses.
- Any new or worsened warnings.
- Optional accepted swap request to link, when the move is intentionally completing one.
- `Cancel` and `Confirm move` actions.

Warnings use checkboxes or a single explicit acknowledgement only when required. Acknowledging risk does not visually dismiss the resulting board flag.

### States

- Checking move.
- Blocking eligibility reason.
- Non-blocking warnings awaiting acknowledgement.
- Saving.
- Saved.
- Server data changed; refresh and try again.
- Disconnected; reconnect before moving.

## Request Thread Design

### Request Header

Keep request identity above the thread:

- Request type.
- Requesting nurse.
- Bed context when relevant.
- Created time.
- Current issue or swap state.

### Thread

- Chronological messages with author name/role and time.
- Use restrained left/right or surface differences; do not imitate a consumer chat app.
- Original request text appears once as the request origin.
- New messages appear below it.
- Long text wraps and supports dynamic type.
- Empty thread copy invites relevant follow-up without implying a global inbox.

### Composer

- Multiline input with a documented character limit.
- Send action remains reachable above the keyboard.
- Disable send for blank content, duplicate in-flight submission, or disconnected state.
- Show inline failure and retain unsent text for an immediate connected retry; do not queue it across sessions.

### Lifecycle Controls

For issues:

- `Mark reviewed` for open issues.
- `Resolve issue` for open or reviewed issues.
- `Reopen issue` for resolved issues.

For swaps:

- `Accept` and `Decline` only while pending.
- Accepted state shows `Assignment change pending` until a linked override succeeds.
- `Complete with assignment move` enters the same move flow with the request preselected.
- Completed state shows the resulting assignment move and time.
- If that linked override is later superseded, retain the historical completion and add calm `Assignment later changed` copy.

Controls stay separate from the message composer so sending a message cannot accidentally change lifecycle state.

## Board Share Preview

The shared image should be a purpose-built static layout, not a screenshot of scroll chrome.

### Preview Content

- NurseFlow and floor name.
- `Captured` timestamp and current census.
- Doctor-side headings, including admitting-side label.
- Nurse name, credentials, load/max, and current break when relevant.
- Assigned rooms and beds from the effective assignment.
- Acuity shown with color and a text or symbol label.
- Current safety flags in a concise summary.
- A footer stating that the image is a point-in-time snapshot.

### Preview Screen

- Privacy reminder before the share action.
- Scrollable or zoomable preview for large captures.
- Primary `Share snapshot` action.
- Secondary `Back to board` action.
- Generating, ready, failed, and retry states.

Do not include editing, annotations, branding customization, upload history, or thread attachments.

## Tablet Floor Board

### Left Pane

- Floor summary and live status.
- Doctor-side sections.
- Compact nurse rows with load and flag count.
- Selected state with accessible announcement.

### Right Pane

- Selected nurse identity, coverage, and load.
- Rooms and bed assignments.
- Inline flags.
- Move-mode targets and accessible move actions.

If no nurse is selected, show a calm instructional empty state. A board-level alert remains visible even when its affected nurse is not selected.

## Visual Polish Boundaries

In scope:

- More consistent card spacing and section rhythm.
- Clearer hierarchy between floor, doctor side, nurse, room, and bed.
- Consistent status chips and warning surfaces.
- Loading skeletons or calm progress states where existing blank transitions are confusing.
- Pressed, focused, disabled, saving, success, and error states.
- Reduced visual noise on dense boards.

Out of scope:

- A full brand redesign.
- New navigation architecture solely for appearance.
- Decorative animation that competes with clinical information.
- New data, analytics, or optimizer controls disguised as polish.

## Accessibility Requirements

- Every move has a non-drag alternative.
- Drag handles, move targets, lifecycle controls, composer, and share actions have accessible names and roles.
- Announce selected bed, eligible target, blocking reason, saving result, and current request state.
- Use visible focus and logical focus order in expanded layouts.
- Return focus to the initiating control when a modal closes.
- Ensure warning icons include text and acuity includes a spoken label.
- Test common larger text settings; avoid fixed-height text containers.
- Respect reduced motion by minimizing lift and transition effects.
- Do not rely on hover behavior.

## Performance Direction

- Measure before changing list primitives.
- Keep the board's hierarchical grouping understandable even if sections are flattened for virtualization.
- Virtualize genuinely large board or message lists where measurement shows dropped frames or excessive rendering.
- Keep row props stable and avoid recalculating the complete effective board for unrelated local UI changes.
- Render only the selected detail pane on tablet rather than duplicating every nurse's full detail.
- Avoid capturing the live interactive tree if a purpose-built static share view is more reliable.
- Preserve readable fallbacks while capture or list optimization work is in progress.

## Manual Design Review Matrix

Review at minimum:

- Small phone portrait.
- Large phone portrait.
- Tablet portrait.
- Tablet landscape.
- Larger accessibility text.
- VoiceOver or TalkBack for the move and request flows.
- Small floor and representative large floor.
- Short and long request threads.
- Long nurse, room, diagnosis, and message text.

## Phase Boundary

This design must not introduce production optimizer controls, advanced break optimization, AI recommendations, EHR/EMR data, automated acuity, global chat, offline write queues, or persistent board-sharing history.
