import type { WorkflowStep } from "../components/workflow/types";

export type WorkflowRoute =
  | "/"
  | "/floor-details"
  | "/rooms-and-beds"
  | "/doctor-sides"
  | "/template-review"
  | "/carry-over-review"
  | "/start-shift"
  | "/nurses"
  | "/patients-and-acuity"
  | "/assignment-review"
  | "/floor-board"
  | "/simulated-nurse-picker"
  | "/simulated-nurse-assignment"
  | "/simulated-nurse-issue"
  | "/simulated-nurse-swap"
  | "/flags";

export type WorkflowFlowStep = {
  step: WorkflowStep;
  route: WorkflowRoute;
};

export const floorTemplateFlow: WorkflowFlowStep[] = [
  { step: "Floor", route: "/floor-details" },
  { step: "Rooms", route: "/rooms-and-beds" },
  { step: "Sides", route: "/doctor-sides" },
  { step: "Review", route: "/template-review" },
];

export const shiftSetupFlow: WorkflowFlowStep[] = [
  { step: "Shift", route: "/start-shift" },
  { step: "Nurses", route: "/nurses" },
  { step: "Patients", route: "/patients-and-acuity" },
];

export const carryOverReviewFlow: WorkflowFlowStep[] = [
  { step: "Carry Over", route: "/carry-over-review" },
  { step: "Shift", route: "/start-shift" },
  { step: "Nurses", route: "/nurses" },
  { step: "Patients", route: "/patients-and-acuity" },
];

export const assignmentFlow: WorkflowFlowStep[] = [
  { step: "Patients", route: "/patients-and-acuity" },
  { step: "Assign", route: "/assignment-review" },
  { step: "Board", route: "/floor-board" },
  { step: "Flags", route: "/flags" },
];
