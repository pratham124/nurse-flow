# 04: Verify the complete migration milestone

**What to build:** The first Go migration milestone has recorded evidence that the charge nurse's template list works end to end in the isolated environment and preserves the existing app's behavior, including failure cases. This covers ordered migration task 11.

**Blocked by:** 03: Show Go-backed templates in Expo.

**Status:** ready-for-agent

- [ ] Charge Alpha sees the synthetic floor template through Go, and Charge Beta sees the existing empty state.
- [ ] Missing, invalid, and expired credentials cannot read templates; the regular-nurse fixture is rejected from charge-nurse template access.
- [ ] Two charge nurses cannot read each other's templates, and verified identity determines ownership.
- [ ] Unavailable API and unavailable database scenarios produce controlled errors without secrets or silent fallback, preserving workspace failure behavior.
- [ ] Go and Expo target the same isolated development environment, and applicable web/device reachability is verified and documented.
- [ ] Relevant Go and changed-app checks pass, and the manual Expo walkthrough records outcomes and any applicable limitations.
- [ ] Surrounding workspace behavior and workflows retained on their existing paths are checked for regressions within the milestone's scope.
- [ ] Refactoring addresses only demonstrated issues; no later migration milestone or new product feature is implemented.
- [ ] Explain the results, record milestone verification evidence, and mark ordered task 11 complete after its criteria pass.

## Implementation guidance

Follow the approved migration plan and load the relevant testing skills before running validation. Use development fixtures without copying production records or exposing credentials. No mandatory understanding quiz is required.
