# 03: Show Go-backed templates in Expo

**What to build:** A signed-in charge nurse sees the existing floor-template list in Expo using the local Go API, with the same application models, ordering, empty state, and workspace failure behavior. This covers ordered migration task 10.

**Blocked by:** 02: Read the charge nurse's templates through Go.

**Status:** done (web and Android verified; no physical-phone LAN test)

- [x] A separate public Go API base URL is configured for isolated development; it contains no database credentials.
- [x] Only the floor-template list read moves to Go. Other workspace reads and application writes retain their existing paths.
- [x] Requests send the current Supabase access token while preserving the existing sign-in and refresh lifecycle.
- [x] Returned templates preserve existing application models and snapshot validation/mapping semantics.
- [x] The populated list and existing empty state work in Expo with the development fixtures.
- [x] Authentication, authorization, network, and API errors produce controlled user-facing behavior; no silent fallback hides Go integration failures.
- [x] Failure of the template read continues to fail the surrounding workspace load as before.
- [x] Applicable web and Android emulator reachability are exercised; physical-device LAN setup is documented without claiming an unavailable phone test.
- [x] Relevant changed-app checks and a manual Expo walkthrough pass, with implementation and results explained.
- [x] Ordered task 10 is marked complete after its criteria pass.

## Implementation guidance

Explain the design before coding and use grill-with-docs to settle only unresolved decisions. Load the relevant React Native/Expo development and testing skills. Preserve the current screens and product scope. No mandatory understanding quiz is required.

## 2026-10-17 implementation and checks

Task 9 was committed separately as `677b20e`. The user approved committing the Task 10 implementation after reviewing its Axios client and Zod validation. The remaining manual criteria keep this ticket open.

Implementation and setup are documented in `docs/go-migration/expo-template-read.md`.
New template repository tests (11), existing workspace-store tests (9), TypeScript, lint, Go race tests, and Go vet passed. Expo web built and Charge Alpha's real session showed Migration Test Floor with two rooms and three beds.

The Beta fixture rejected its previous password once; the user does not remember the current password. No reset or database fixture changes were made. The real Beta browser empty-state check remains pending; the automated empty-list case passed. Web reachability is exercised; physical-device instructions are documented without claiming a connected-device test. The full Task 11 matrix has not been performed.

The Alpha browser unavailable-API/recovery check also passed: Go stopped -> controlled workspace error; Go restarted + Retry -> template list restored. Final TypeScript/lint and the 11 focused repository tests passed after source formatting/status validation.

Review follow-up: removed the optional fetch implementation at the user's request. Production calls fetch directly; tests mock and restore the global function. The 11 repository tests, TypeScript, and focused lint passed.

Latest review follow-up: user chose a shared Axios client with a constant base URL and relative endpoint paths. Axios 1.20.0 is pinned; no fetch injection, URL-building helper, or per-call base-URL override remains. The 16 Axios/template checks and nine workspace tests passed. Expo web displayed Alpha's real template through the new client. Beta/device manual criteria remain pending.

The finalized shared client also passed TypeScript and focused lint. Temporary verification servers were stopped.

Readability follow-up: `loadFloorTemplates` now reads as session lookup, authenticated request, and response parsing. Private `throwTemplateRequestError` and `parseFloorTemplateList` helpers retain the same controlled messages, HTTP 200 contract, row/snapshot validation, mapping, and owner checks. All 16 existing Axios/template checks, TypeScript, and focused lint passed after the refactor.

- [x] User-requested Task 10 validation follow-up: added pinned Zod 4.6.7 directly to Expo, inferred the row type from a schema, and replaced the manual list/row guard with safeParse. Snapshot mapping and ownership checks are preserved. All 18 Axios/template checks, nine workspace tests, TypeScript, and focused lint passed. This remains part of the Expo-to-Go integration; Beta/device manual criteria are unchanged.

The Zod browser smoke check passed with Alpha's real Go-backed template list. The validation change is included in the reviewed Task 10 implementation.

## Completion verification on 2026-10-17

The user chose fresh accounts instead of recovering Beta. Real Charge Empty web and Charge Native Empty Android sessions displayed the existing empty state through Go. The earlier Alpha populated web list passed. Stopping Go produced controlled errors on both web and Android; restarting Go and Retry restored both lists. All 18 template-client tests, nine workspace-store tests, TypeScript, lint, Go race tests/vet, live database isolation, and public signing-key discovery passed. Tasks 10 and 11 are complete. Detailed evidence and automated/manual boundaries: [Milestone 1 verification](../../../docs/go-migration/milestone-one-verification.md).

Android used an existing read-only API 34 emulator with scoped ADB reverse ports 8080/8081. No physical-phone LAN or iOS result is claimed. Beta's password was unchanged; the unused local reset helper was removed. Earlier pending Beta/device notes above describe verification history and are superseded by this completion record. Temporary servers and emulator were stopped.
