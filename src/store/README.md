# Store

Shared app state belongs here when a workflow grows beyond local screen state.

For Phase 1, prefer simple React state or a small reducer before adding a state
management library.

Phase 7 uses `NotificationTapContext` only for temporary notification routing
and recovery state. Saved shift data continues to live in the server workspace
boundary.
