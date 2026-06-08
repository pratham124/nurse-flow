import type {
  Bed,
  BedState,
  DoctorSide,
  Nurse,
  Room,
  Shift,
} from "../types/models";

export type NurseAssignedBedView = {
  bed: Bed;
  bedState?: BedState;
  doctorSide: DoctorSide;
  room: Room;
};

export type NurseAssignmentView = {
  assignedBeds: NurseAssignedBedView[];
  coveredRooms: Room[];
  invalidAssignmentCount: number;
  nurse: Nurse;
};

export type NurseAssignmentViewResult =
  | { status: "ready"; view: NurseAssignmentView }
  | { status: "missing_shift"; title: string; message: string }
  | { status: "missing_assignment"; title: string; message: string }
  | { status: "missing_nurse"; title: string; message: string };

function getCoveredRooms(activeShift: Shift, nurseId: string) {
  if (!activeShift.assignmentResult) {
    return [];
  }

  return activeShift.assignmentResult.roomCoverage.flatMap((coverage) => {
    if (!coverage.nurseIds.includes(nurseId)) {
      return [];
    }

    const room = activeShift.rooms.find(
      (shiftRoom) => shiftRoom.id === coverage.roomId,
    );

    return room ? [room] : [];
  });
}

function getAssignedBedView(
  activeShift: Shift,
  bedId: string,
): NurseAssignedBedView | undefined {
  const bed = activeShift.beds.find((shiftBed) => shiftBed.id === bedId);

  if (!bed) {
    return undefined;
  }

  const room = activeShift.rooms.find((shiftRoom) => shiftRoom.id === bed.roomId);

  if (!room) {
    return undefined;
  }

  const doctorSide = activeShift.doctorSides.find(
    (shiftDoctorSide) => shiftDoctorSide.id === room.doctorSideId,
  );

  if (!doctorSide) {
    return undefined;
  }

  return {
    bed,
    bedState: activeShift.bedStates.find(
      (shiftBedState) => shiftBedState.bedId === bed.id,
    ),
    doctorSide,
    room,
  };
}

export function getSelectedNurseAssignmentView(
  activeShift: Shift | undefined,
  selectedNurseId: string | undefined,
): NurseAssignmentViewResult {
  if (!activeShift) {
    return {
      status: "missing_shift",
      title: "No active shift",
      message: "Start a shift and run assignment before opening nurse view.",
    };
  }

  if (activeShift.status !== "assigned" || !activeShift.assignmentResult) {
    return {
      status: "missing_assignment",
      title: "Assignment needed",
      message: "Run assignment before opening nurse view.",
    };
  }

  if (!selectedNurseId) {
    return {
      status: "missing_nurse",
      title: "Choose a nurse",
      message: "Select a nurse before opening the assignment view.",
    };
  }

  const nurse = activeShift.nurses.find(
    (shiftNurse) => shiftNurse.id === selectedNurseId,
  );

  if (!nurse) {
    return {
      status: "missing_nurse",
      title: "Nurse no longer available",
      message: "Choose another nurse from the active shift.",
    };
  }

  const assignedBedIds = activeShift.assignmentResult.bedAssignments
    .filter((assignment) => assignment.nurseId === nurse.id)
    .map((assignment) => assignment.bedId);
  const assignedBeds = assignedBedIds.flatMap((bedId) => {
    const assignedBed = getAssignedBedView(activeShift, bedId);

    return assignedBed ? [assignedBed] : [];
  });

  return {
    status: "ready",
    view: {
      assignedBeds,
      coveredRooms: getCoveredRooms(activeShift, nurse.id),
      invalidAssignmentCount: assignedBedIds.length - assignedBeds.length,
      nurse,
    },
  };
}

