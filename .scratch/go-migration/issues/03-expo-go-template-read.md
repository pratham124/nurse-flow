# 03: Show Go-backed templates in Expo

**What to build:** A signed-in charge nurse sees the existing floor-template list in Expo using the local Go API, with the same application models, ordering, empty state, and workspace failure behavior. This covers ordered migration task 10.

**Blocked by:** 02: Read the charge nurse's templates through Go.

**Status:** ready-for-agent

- [ ] A separate public Go API base URL is configured for isolated development; it contains no database credentials.
- [ ] Only the floor-template list read moves to Go. Other workspace reads and application writes retain their existing paths.
- [ ] Requests send the current Supabase access token while preserving the existing sign-in and refresh lifecycle.
- [ ] Returned templates preserve existing application models and snapshot validation/mapping semantics.
- [ ] The populated list and existing empty state work in Expo with the development fixtures.
- [ ] Authentication, authorization, network, and API errors produce controlled user-facing behavior; no silent fallback hides Go integration failures.
- [ ] Failure of the template read continues to fail the surrounding workspace load as before.
- [ ] Applicable web and physical-device API configuration and reachability are documented and exercised; a physical device uses an address reachable from that device.
- [ ] Relevant changed-app checks and a manual Expo walkthrough pass, with implementation and results explained.
- [ ] Ordered task 10 is marked complete after its criteria pass.

## Implementation guidance

Explain the design before coding and use grill-with-docs to settle only unresolved decisions. Load the relevant React Native/Expo development and testing skills. Preserve the current screens and product scope. No mandatory understanding quiz is required.
