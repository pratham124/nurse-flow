# Phase 8 Accessibility and Performance Pass

Task: Phase 8 Tasks 5.1 through 5.3

This pass is limited to the manual assignment, request thread, responsive board,
and shared workflow primitives changed in Phase 8. It does not claim that every
earlier NurseFlow screen has received a complete accessibility audit.

## Accessibility Changes

- Screen and section titles now expose heading roles in shared workflow screens.
- Board beds expose acuity in visible text and in the accessible move label, so
  acuity is not communicated by the colored rail alone.
- Move and confirmation dialogs focus their title when opened and identify their
  content as modal. Native focus return still needs device confirmation.
- Assignment swipe and modal transitions skip animation when the operating
  system reduced-motion preference is enabled.
- Send controls expose disabled and busy state, and move controls expose selected,
  checked, disabled, warning, and result state through their existing semantics.
- Phase 8 filter, refresh, confirmation, header, lifecycle, and composer actions
  now meet a 44-point minimum target. Fixed-height shared actions were changed to
  minimum heights so larger text can grow instead of clipping.
- Lifecycle and confirmation action rows can wrap when accessibility text needs
  more horizontal room.

## Remaining Non-Phase-8 Accessibility Debt

- Earlier floor-setup and shift-setup screens were not re-audited control by
  control because Task 5.1 is scoped to Phase 8 flows and their shared primitives.
- A native VoiceOver/TalkBack pass is still required for focus return after both
  dialog types close and for the custom `Reveal Move` accessibility action.
- Larger accessibility text and screen-reader order still require native checks
  in phone and tablet portrait/landscape layouts. These checks belong to Task 6.3
  and must not be inferred from TypeScript or web validation.

## Development Measurement Fixture

`tests/fixtures/phase8PerformanceFixture.ts` creates a development-only scenario:

- 4 doctor sides
- 200 rooms
- 400 beds
- 40 nurses
- 100 flags
- 250 request messages

The fixture is imported only by tests and the measurement script. It is never
loaded into `ServerWorkspaceContext`, persisted to Supabase, or used as production
shift data.

Run the repeatable JavaScript preparation measurement with:

```text
npm run measure:phase8
```

## Recorded Results

Measured on 2026-08-09 on Windows with Node 24.14.1. Each result uses 10 warm-up
runs and 100 recorded runs. These numbers measure the JavaScript work that
prepares board and thread rows; they do not claim native UI frame timings.

| Interaction preparation | Before median | After median | Before p95 | After p95 |
| --- | ---: | ---: | ---: | ---: |
| 400-bed board projection | 3.302 ms | 0.317 ms | 5.810 ms | 0.591 ms |
| 250-message time projection | 19.384 ms | 0.593 ms | 32.292 ms | 0.677 ms |

The actual measured bottleneck was recreating a locale formatter for every
message whenever the thread rendered. A shared `Intl.DateTimeFormat` removed
that repeated work. Stable message-list and row components also prevent reply
typing from rebuilding an unchanged history.

The board scan was smaller but repeated for unrelated local state changes.
`createFloorBoardLookup` now creates bed-, room-, nurse-, assignment-, and
flag-keyed maps once per effective shift change. Memoized projections then avoid
rebuilding the whole board when the move dialog opens or tablet selection changes.
The assignment algorithm is unchanged, and routine ownership still comes from
the effective bed-assignment projection rather than override history.

## List and Gesture Decision

No list dependency was added. The phone board already virtualizes doctor-side
items and the nurse workload strip uses `FlatList`. The measured JavaScript
bottleneck was formatting and repeated derivation, so changing the thread to a
nested virtualized list would add scrolling complexity without evidence that it
solves the current problem.

Swipe reveal continues to animate only a transform with the native driver. The
board projection no longer reruns when a row reveals or opens the move dialog.
Native board scrolling, long-thread scrolling, and swipe response still need the
same-device before/after check in Task 6.3; any observed dropped frames should be
recorded before further list restructuring.

## Automated Verification

- `node_modules\\.bin\\tsc.cmd --noEmit`
- `npm run lint`
- `npm run test:phase8-performance`
- `npm run test:effective-assignment`
- `npm run test:request-realtime`
- `npm run test:request-lifecycle`

All commands passed during this pass. Native VoiceOver/TalkBack, dynamic type,
focus return, and device scroll checks remain explicitly pending.

A signed-in web smoke pass also loaded the charge request detail and expanded
floor board without app-origin errors. The browser accessibility tree exposed
the new headings and spoken acuity label. Measured Phase 8 controls, including
filters, request actions, send, navigation, and board tabs, were at least 44
points high. The web pass does not replace native assistive-technology testing.
