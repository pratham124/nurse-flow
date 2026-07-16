# Expo Notifications Setup Notes

Task: Phase 7 Task 0.3, Review Current Notification Docs

This beginner-readable note records the requirements for later Phase 7 work. It
does not install a package, change `app.json`, request permission, create a
token, or send a notification.

## The Big Picture

A push notification needs separate steps:

1. The operating system lets the user allow notifications.
2. The app gets a device-specific push token.
3. The app registers that token with NurseFlow's server for the signed-in
   profile.
4. The server sends a safe alert for an important event.
5. A tap opens the app and reloads current server data.

The token is an address for one app installation. It is not patient data and it
is not proof that a shift or request is still current.

## Current Expo Requirements

NurseFlow uses Expo SDK 55. Expo's current guidance uses
`expo-notifications` to request permission and obtain an `ExpoPushToken`; it
uses `expo-constants` to read the EAS `projectId`. This project already has
`expo-constants` and an EAS project ID in `app.json`, but it does not yet have
`expo-notifications` installed or configured.

When Task 1.1 begins, use Expo's version-matched installer rather than guessing
a package version:

```bash
npx expo install expo-notifications expo-constants
```

Remote push testing needs a supported device/build. In SDK 53 and later, Expo
Go cannot test remote push notifications; use a development build. Local
notifications are different and do not prove NurseFlow's server-sent push path.

Sources: [Expo push-notification setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), [Expo SDK 55 Notifications](https://docs.expo.dev/versions/v55.0.0/sdk/notifications/), and [development builds](https://docs.expo.dev/develop/development-builds/expo-go-to-dev-build/).

## Later Permission And Token Flow

Later Phase 7 code should:

1. Read the current permission with `getPermissionsAsync`.
2. Request permission only when it has not already been granted.
3. Leave NurseFlow usable when permission is unavailable or denied.
4. On Android, create a notification channel before requesting/getting a token.
5. Read the configured Expo project ID.
6. Call `getExpoPushTokenAsync({ projectId })` in `try/catch`, because it can
   fail while offline or during a network timeout.
7. Register only token, platform, permission state, and minimal metadata with
   the server for the signed-in profile.

Later code must also respond if a token changes. Retrying token registration is
safe; queuing clinical shift writes while offline is not part of Phase 7.

## iOS Notes

- iOS permission results are more detailed. Code should read the iOS-specific
  authorization status, not only the top-level status.
- iOS can report not determined, denied, authorized, provisional, or ephemeral
  authorization. The UI must not treat every status as a full alert permission.
- Push credentials require an Apple Developer account. EAS can guide setup of
  the Apple Push Notification service key for a first development build; the
  test device needs to be registered first.
- No iOS notification usage-description string is required for this API.
- Background/headless handling is not part of the foundation tasks. It would
  need explicit configuration and another native build later.

Sources: [Expo SDK 55 iOS permissions](https://docs.expo.dev/versions/v55.0.0/sdk/notifications/#interpret-the-ios-permissions-response) and [Expo push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/).

## Android Notes

- Android 13 and later requires users to opt in to notifications.
- On Android 13, Expo requires at least one notification channel before the
  permission prompt/token request can appear correctly.
- Android push delivery needs Firebase Cloud Messaging (FCM) v1 credentials.
- The notification config plugin can set Android build-time values such as an
  all-white transparent icon, tint color, and default channel. Changing them
  requires a new native build.
- Exact-alarm permission is for exact scheduled local alarms, not the Phase 7
  remote-push foundation.

Sources: [Expo SDK 55 Android requirements](https://docs.expo.dev/versions/v55.0.0/sdk/notifications/#android) and [FCM credentials](https://docs.expo.dev/push-notifications/fcm-credentials/).

## Development-Build Notes

- A development build includes native remote-push capability that Expo Go lacks
  in current Expo SDKs.
- Installing `expo-notifications` or changing the notification config plugin is
  a native change. Rebuild with EAS Build or a local `npx expo run:android` /
  `npx expo run:ios` workflow afterwards.
- The existing EAS project ID should be read from configuration rather than
  hard-coded into later token code.
- Expo documents a debug Android splash-screen issue when launching from a
  notification. Test release Android builds before treating that as a product
  behavior problem.

## Task 2.7 Tap Payload Contract

A notification tap carries only enough data to locate current server state:

- `targetRoute`: `requestDetail`, `requestsList`, `joinedNurseAssignment`,
  `floorBoard`, or `flags`.
- `shiftId`: the server shift that produced the event.
- `relatedRequestId`: required only for `requestDetail`.
- `recipientAccessId`: required only for `joinedNurseAssignment`.

Snake-case versions of these keys are accepted at the server boundary. The app
validates the payload, reloads the current shift or nurse-scoped assignment,
and confirms access before navigating. Titles, bodies, patient details, and
full shift snapshots are never used as routing authority.

## Out Of Scope For Tasks 0.2 And 0.3

- Installing `expo-notifications`.
- Adding the config plugin to `app.json`.
- Prompting for permission or registering tokens.
- Creating server tables or send logic.
- Adding background processing, an offline write queue, or patient details in
  notification payloads.

## Manual Validation Before Task 1.1

1. Use a physical device, supported Android emulator, or supported iOS
   simulator.
2. Install a development build; do not use Expo Go to judge remote-push support.
3. Configure Android FCM v1 or iOS APNs credentials for the matching build.
4. Confirm token code can read the EAS project ID.
5. Test both allowed and denied permission, with normal app use still working
   after denial.

## Task 0.3 Guardrail

The requirements are clear, but runtime notification work belongs to Task 1.1
and later. This task remains documentation only.
