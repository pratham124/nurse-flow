# Services

External service wrappers belong here when a phase needs them.

Phase 1 stays local-first, so this folder should not contain backend, realtime,
push notification, or auth code yet.

Phase 2 can add local-only persistence helpers here. Keep storage wrappers small
and focused on local device state only.
