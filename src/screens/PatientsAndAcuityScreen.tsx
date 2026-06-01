import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  BedChip,
  FilterChip,
  FilterChipRow,
  PlaceholderInput,
  SegmentedPlaceholder,
  StatusPill,
  SummaryTile,
  SummaryTileGrid,
  WorkflowListScreen,
  WorkflowSection,
} from "../components/workflow";
import { useLocalState } from "../store/LocalStateContext";
import { colors, spacing, textSize } from "../theme/tokens";
import type { Bed, BedState, Patient, Sex, Shift } from "../types/models";
import { shiftSetupFlow } from "../utils/workflowFlows";

const censusFilters = ["All beds", "Occupied", "Empty"];
const sexOptions = ["F", "M", "Other"];

type PatientField = "initials" | "age" | "sex" | "diagnosis";

type PatientBedRow = {
  bed: Bed;
  bedState?: BedState;
};

type PatientRoomGroup = {
  id: string;
  label: string;
  sideName: string;
  beds: PatientBedRow[];
};

type PatientsListHeaderProps = {
  occupiedBedCount: number;
  totalBedCount: number;
};

type RoomPatientsRowProps = {
  room: PatientRoomGroup;
  onUpdatePatientField: (
    bedId: string,
    field: PatientField,
    value: string,
  ) => void;
};

type BedPatientFormProps = {
  bedRow: PatientBedRow;
  onUpdatePatientField: (
    bedId: string,
    field: PatientField,
    value: string,
  ) => void;
};

type BedStatusBadgeProps = {
  occupied: boolean;
};

function isOccupiedBedState(bedState?: BedState) {
  return Boolean(bedState?.patient?.initials.trim());
}

function getPatientAgeText(patient?: Patient) {
  return patient?.age === undefined ? "" : patient.age.toString();
}

function getPatientAgeFromText(value: string) {
  const trimmedAge = value.trim();

  if (!trimmedAge) {
    return undefined;
  }

  if (!/^\d+$/.test(trimmedAge)) {
    return undefined;
  }

  return Number(trimmedAge);
}

function getPatientSexIndex(sex?: Sex) {
  switch (sex) {
    case "female":
      return 0;
    case "male":
      return 1;
    case "other":
      return 2;
    default:
      return null;
  }
}

function getSexFromIndex(index: number): Sex {
  switch (index) {
    case 1:
      return "male";
    case 2:
      return "other";
    default:
      return "female";
  }
}

function shouldKeepPatient(patient: Patient) {
  return Boolean(
    patient.initials.trim() ||
      patient.age !== undefined ||
      patient.sex ||
      patient.diagnosis?.trim(),
  );
}

function getRoomGroups(activeShift?: Shift): PatientRoomGroup[] {
  if (!activeShift) {
    return [];
  }

  return activeShift.rooms.map((room) => {
    const doctorSide = activeShift.doctorSides.find(
      (side) => side.id === room.doctorSideId,
    );
    const beds = activeShift.beds
      .filter((bed) => bed.roomId === room.id)
      .map((bed) => ({
        bed,
        bedState: activeShift.bedStates.find(
          (bedState) => bedState.bedId === bed.id,
        ),
      }));

    return {
      id: room.id,
      label: room.label,
      sideName: doctorSide?.name ?? "Unassigned side",
      beds,
    };
  });
}

function PatientsListHeader({
  occupiedBedCount,
  totalBedCount,
}: PatientsListHeaderProps) {
  return (
    <View style={styles.headerContent}>
      <WorkflowSection title="Census">
        <SummaryTileGrid>
          <SummaryTile value={occupiedBedCount.toString()} label="Occupied" />
          <SummaryTile value={totalBedCount.toString()} label="Total beds" />
        </SummaryTileGrid>
      </WorkflowSection>

      <WorkflowSection title="Filters">
        <FilterChipRow>
          {censusFilters.map((filter, index) => (
            <FilterChip key={filter} label={filter} selected={index === 0} />
          ))}
        </FilterChipRow>
      </WorkflowSection>
    </View>
  );
}

function RoomPatientsRow({
  room,
  onUpdatePatientField,
}: RoomPatientsRowProps) {
  return (
    <WorkflowSection note={room.sideName} title={`Room ${room.label}`}>
      {room.beds.map((bedRow) => (
        <BedPatientForm
          bedRow={bedRow}
          key={bedRow.bed.id}
          onUpdatePatientField={onUpdatePatientField}
        />
      ))}
    </WorkflowSection>
  );
}

function BedPatientForm({
  bedRow,
  onUpdatePatientField,
}: BedPatientFormProps) {
  const patient = bedRow.bedState?.patient;
  const occupied = isOccupiedBedState(bedRow.bedState);

  return (
    <View style={styles.bedRow}>
      <View style={styles.bedHeader}>
        <BedChip label={bedRow.bed.label} />
        <BedStatusBadge occupied={occupied} />
      </View>

      <PlaceholderInput
        label="Patient initials"
        onChangeText={(value) =>
          onUpdatePatientField(bedRow.bed.id, "initials", value)
        }
        placeholder="J.S."
        value={patient?.initials ?? ""}
      />

      <View style={styles.patientDetailsRow}>
        <PlaceholderInput
          keyboardType="number-pad"
          label="Age"
          onChangeText={(value) =>
            onUpdatePatientField(bedRow.bed.id, "age", value)
          }
          placeholder="67"
          value={getPatientAgeText(patient)}
        />

        <View style={styles.selectorField}>
          <Text style={styles.selectorLabel}>Sex</Text>
          <SegmentedPlaceholder
            options={sexOptions}
            selectedIndex={getPatientSexIndex(patient?.sex)}
            onSelect={(index) =>
              onUpdatePatientField(
                bedRow.bed.id,
                "sex",
                getSexFromIndex(index),
              )
            }
          />
        </View>
      </View>

      <PlaceholderInput
        label="Diagnosis"
        onChangeText={(value) =>
          onUpdatePatientField(bedRow.bed.id, "diagnosis", value)
        }
        placeholder="CHF exacerbation"
        value={patient?.diagnosis ?? ""}
      />
    </View>
  );
}

function BedStatusBadge({ occupied }: BedStatusBadgeProps) {
  return (
    <StatusPill
      label={occupied ? "Occupied" : "Empty"}
      tone={occupied ? "occupied" : "empty"}
    />
  );
}

function getRoomKey(room: PatientRoomGroup) {
  return room.id;
}

export default function PatientsAndAcuityScreen() {
  const { localState, setLocalState } = useLocalState();
  const activeShift = localState.activeShift;
  const roomGroups = getRoomGroups(activeShift);
  const occupiedBedCount =
    activeShift?.bedStates.filter(isOccupiedBedState).length ?? 0;
  const totalBedCount = activeShift?.beds.length ?? 0;

  function handleUpdatePatientField(
    bedId: string,
    field: PatientField,
    value: string,
  ) {
    setLocalState((currentState) => {
      const currentShift = currentState.activeShift;

      if (!currentShift) {
        return currentState;
      }

      return {
        ...currentState,
        activeShift: {
          ...currentShift,
          bedStates: currentShift.bedStates.map((bedState) => {
            if (bedState.bedId !== bedId) {
              return bedState;
            }

            const currentPatient = bedState.patient ?? { initials: "" };
            const updatedPatient: Patient = { ...currentPatient };

            if (field === "initials") {
              updatedPatient.initials = value;
            }

            if (field === "age") {
              updatedPatient.age = getPatientAgeFromText(value);
            }

            if (field === "sex") {
              updatedPatient.sex = value ? (value as Sex) : undefined;
            }

            if (field === "diagnosis") {
              updatedPatient.diagnosis = value;
            }

            return {
              ...bedState,
              patient: shouldKeepPatient(updatedPatient)
                ? updatedPatient
                : undefined,
            };
          }),
        },
      };
    });
  }

  function handleContinue() {
    if (!activeShift) {
      router.replace("/start-shift");
      return;
    }

    router.push("/assignment-review");
  }

  function renderRoomItem({ item }: { item: PatientRoomGroup }) {
    return (
      <RoomPatientsRow
        room={item}
        onUpdatePatientField={handleUpdatePatientField}
      />
    );
  }

  return (
    <WorkflowListScreen
      activeStep="Patients"
      actionErrorText={activeShift ? "" : "Start a shift before adding patients."}
      data={roomGroups}
      flow={shiftSetupFlow}
      headerActionLabel="Floors"
      keyExtractor={getRoomKey}
      listHeader={
        <PatientsListHeader
          occupiedBedCount={occupiedBedCount}
          totalBedCount={totalBedCount}
        />
      }
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={handleContinue}
      primaryLabel="Review assignment"
      renderItem={renderRoomItem}
      subtitle="Step 3 of 3"
      title={activeShift?.floorName ?? "Patients and acuity"}
    />
  );
}

const styles = StyleSheet.create({
  headerContent: {
    gap: spacing.cardGap,
  },
  bedRow: {
    gap: spacing.lg,
    marginTop: spacing.md,
    paddingVertical: spacing.lg,
  },
  bedHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  patientDetailsRow: {
    gap: spacing.md,
  },
  selectorField: {
    gap: spacing.sm,
  },
  selectorLabel: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
  },
});
