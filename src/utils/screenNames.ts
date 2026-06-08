export const APP_SCREEN_NAMES = [
  "Local Workspace",
  "Floor Details",
  "Rooms and Beds",
  "Doctor Sides",
  "Template Review",
  "Start Shift",
  "Nurses",
  "Patients and Acuity",
  "Assignment Review",
  "Floor Board",
  "Simulated Nurse Picker",
  "Simulated Nurse Assignment",
  "Flags",
] as const;

export type AppScreenName = (typeof APP_SCREEN_NAMES)[number];
