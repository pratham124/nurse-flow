import { useState } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  BedChip,
  CheckCircleIcon,
  FilterChip,
  FilterChipRow,
  PlaceholderButton,
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
import type {
  Acuity,
  Bed,
  BedState,
  Patient,
  Sex,
  Shift,
} from "../types/models";
import { shiftSetupFlow } from "../utils/workflowFlows";

const censusFilters = [
  { label: "All beds", value: "all" },
  { label: "Occupied", value: "occupied" },
  { label: "Empty", value: "empty" },
] as const;
const sexOptions = ["F", "M", "Other"];
const acuityOptions: Acuity[] = ["green", "yellow", "red"];
const wholeNumberAgeMessage = "Age must be a whole number.";

type PatientField = "initials" | "age" | "sex" | "diagnosis";
type CensusFilter = (typeof censusFilters)[number]["value"];

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
  onSelectFilter: (filter: CensusFilter) => void;
  selectedFilter: CensusFilter;
  totalBedCount: number;
};

type RoomPatientsRowProps = {
  ageTextByBedId: Record<string, string>;
  room: PatientRoomGroup;
  onClearPatient: (bedId: string) => void;
  onUpdatePatientField: (
    bedId: string,
    field: PatientField,
    value: string,
  ) => void;
  onUpdateAcuity: (bedId: string, acuity: Acuity) => void;
};

type BedPatientFormProps = {
  ageErrorText: string;
  ageText: string;
  bedRow: PatientBedRow;
  onClearPatient: (bedId: string) => void;
  onUpdatePatientField: (
    bedId: string,
    field: PatientField,
    value: string,
  ) => void;
  onUpdateAcuity: (bedId: string, acuity: Acuity) => void;
};

type BedStatusBadgeProps = {
  occupied: boolean;
};

type AcuitySelectorProps = {
  acuity?: Acuity;
  bedLabel: string;
  onSelect: (acuity: Acuity) => void;
};

function isOccupiedBedState(bedState?: BedState) {
  return Boolean(bedState?.patient?.initials.trim());
}

function isWholeNumberText(value: string) {
  const trimmedValue = value.trim();

  return !trimmedValue || /^\d+$/.test(trimmedValue);
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

function getAcuityLabel(acuity: Acuity) {
  return acuity.charAt(0).toUpperCase() + acuity.slice(1);
}

function getAcuityOptionStyle(acuity: Acuity) {
  switch (acuity) {
    case "red":
      return styles.redAcuityOption;
    case "yellow":
      return styles.yellowAcuityOption;
    default:
      return styles.greenAcuityOption;
  }
}

function getAcuityOptionTextStyle(acuity: Acuity) {
  switch (acuity) {
    case "red":
      return styles.redAcuityOptionText;
    case "yellow":
      return styles.yellowAcuityOptionText;
    default:
      return styles.greenAcuityOptionText;
  }
}

function getAcuityMarkerColor(acuity: Acuity) {
  switch (acuity) {
    case "red":
      return colors.status.red800;
    case "yellow":
      return colors.status.amber800;
    default:
      return colors.status.green800;
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

function getFilteredRoomGroups(
  roomGroups: PatientRoomGroup[],
  selectedFilter: CensusFilter,
) {
  if (selectedFilter === "all") {
    return roomGroups;
  }

  return roomGroups
    .map((room) => ({
      ...room,
      beds: room.beds.filter((bedRow) => {
        const occupied = isOccupiedBedState(bedRow.bedState);

        return selectedFilter === "occupied" ? occupied : !occupied;
      }),
    }))
    .filter((room) => room.beds.length > 0);
}

function PatientsListHeader({
  occupiedBedCount,
  onSelectFilter,
  selectedFilter,
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
          {censusFilters.map((filter) => (
            <FilterChip
              key={filter.value}
              label={filter.label}
              onPress={() => onSelectFilter(filter.value)}
              selected={filter.value === selectedFilter}
            />
          ))}
        </FilterChipRow>
      </WorkflowSection>
    </View>
  );
}

function RoomPatientsRow({
  ageTextByBedId,
  room,
  onClearPatient,
  onUpdatePatientField,
  onUpdateAcuity,
}: RoomPatientsRowProps) {
  return (
    <WorkflowSection note={room.sideName} title={`Room ${room.label}`}>
      {room.beds.map((bedRow) => (
        <BedPatientForm
          ageErrorText={
            isWholeNumberText(
              ageTextByBedId[bedRow.bed.id] ??
                getPatientAgeText(bedRow.bedState?.patient),
            )
              ? ""
              : wholeNumberAgeMessage
          }
          ageText={
            ageTextByBedId[bedRow.bed.id] ??
            getPatientAgeText(bedRow.bedState?.patient)
          }
          bedRow={bedRow}
          key={bedRow.bed.id}
          onClearPatient={onClearPatient}
          onUpdateAcuity={onUpdateAcuity}
          onUpdatePatientField={onUpdatePatientField}
        />
      ))}
    </WorkflowSection>
  );
}

function BedPatientForm({
  ageErrorText,
  ageText,
  bedRow,
  onClearPatient,
  onUpdateAcuity,
  onUpdatePatientField,
}: BedPatientFormProps) {
  const patient = bedRow.bedState?.patient;
  const occupied = isOccupiedBedState(bedRow.bedState);
  const hasPatientInfo = Boolean(patient);

  return (
    <View style={styles.bedRow}>
      <View style={styles.bedHeader}>
        <BedChip label={bedRow.bed.label} />
        <View style={styles.bedHeaderActions}>
          <BedStatusBadge occupied={occupied} />
          {hasPatientInfo ? (
            <PlaceholderButton
              label="Clear patient"
              onPress={() => onClearPatient(bedRow.bed.id)}
            />
          ) : null}
        </View>
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
          errorText={ageErrorText}
          label="Age"
          onChangeText={(value) =>
            onUpdatePatientField(bedRow.bed.id, "age", value)
          }
          placeholder="67"
          value={ageText}
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

      {occupied ? (
        <AcuitySelector
          acuity={bedRow.bedState?.acuity}
          bedLabel={bedRow.bed.label}
          onSelect={(acuity) => onUpdateAcuity(bedRow.bed.id, acuity)}
        />
      ) : null}
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

function AcuitySelector({
  acuity,
  bedLabel,
  onSelect,
}: AcuitySelectorProps) {
  return (
    <View style={styles.selectorField}>
      <Text style={styles.selectorLabel}>Acuity</Text>
      <View style={styles.acuityOptionRow}>
        {acuityOptions.map((option) => {
          const selected = option === acuity;

          return (
            <Pressable
              accessibilityLabel={`Set ${bedLabel} acuity to ${getAcuityLabel(
                option,
              )}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option}
              onPress={() => onSelect(option)}
              style={[
                styles.acuityOption,
                getAcuityOptionStyle(option),
                selected ? styles.selectedAcuityOption : null,
              ]}
            >
              {selected ? (
                <View style={styles.selectedAcuityMarker}>
                  <CheckCircleIcon
                    color={getAcuityMarkerColor(option)}
                    size={14}
                  />
                  <Text
                    style={[
                      styles.selectedAcuityText,
                      getAcuityOptionTextStyle(option),
                    ]}
                  >
                    Selected
                  </Text>
                </View>
              ) : null}
              <Text
                style={[
                  styles.acuityOptionText,
                  getAcuityOptionTextStyle(option),
                ]}
              >
                {getAcuityLabel(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function getRoomKey(room: PatientRoomGroup) {
  return room.id;
}

export default function PatientsAndAcuityScreen() {
  const { localState, setLocalState } = useLocalState();
  const [ageTextByBedId, setAgeTextByBedId] = useState<Record<string, string>>(
    {},
  );
  const [selectedFilter, setSelectedFilter] = useState<CensusFilter>("all");
  const activeShift = localState.activeShift;
  const roomGroups = getRoomGroups(activeShift);
  const filteredRoomGroups = getFilteredRoomGroups(roomGroups, selectedFilter);
  const occupiedBedCount =
    activeShift?.bedStates.filter(isOccupiedBedState).length ?? 0;
  const totalBedCount = activeShift?.beds.length ?? 0;
  const hasInvalidAge =
    activeShift?.beds.some((bed) => {
      const ageText = ageTextByBedId[bed.id] ?? "";

      return !isWholeNumberText(ageText);
    }) ?? false;

  function handleUpdatePatientField(
    bedId: string,
    field: PatientField,
    value: string,
  ) {
    if (field === "age") {
      setAgeTextByBedId((currentAgeTextByBedId) => ({
        ...currentAgeTextByBedId,
        [bedId]: value,
      }));
    }

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
              updatedPatient.age = isWholeNumberText(value)
                ? getPatientAgeFromText(value)
                : undefined;
            }

            if (field === "sex") {
              updatedPatient.sex = value ? (value as Sex) : undefined;
            }

            if (field === "diagnosis") {
              updatedPatient.diagnosis = value;
            }

            return {
              ...bedState,
              acuity: updatedPatient.initials.trim()
                ? bedState.acuity
                : undefined,
              patient: shouldKeepPatient(updatedPatient)
                ? updatedPatient
                : undefined,
            };
          }),
        },
      };
    });
  }

  function handleUpdateAcuity(bedId: string, acuity: Acuity) {
    setLocalState((currentState) => {
      const currentShift = currentState.activeShift;

      if (!currentShift) {
        return currentState;
      }

      return {
        ...currentState,
        activeShift: {
          ...currentShift,
          bedStates: currentShift.bedStates.map((bedState) =>
            bedState.bedId === bedId ? { ...bedState, acuity } : bedState,
          ),
        },
      };
    });
  }

  function handleClearPatient(bedId: string) {
    setAgeTextByBedId((currentAgeTextByBedId) => {
      const nextAgeTextByBedId = { ...currentAgeTextByBedId };
      delete nextAgeTextByBedId[bedId];

      return nextAgeTextByBedId;
    });

    setLocalState((currentState) => {
      const currentShift = currentState.activeShift;

      if (!currentShift) {
        return currentState;
      }

      return {
        ...currentState,
        activeShift: {
          ...currentShift,
          bedStates: currentShift.bedStates.map((bedState) =>
            bedState.bedId === bedId
              ? { ...bedState, acuity: undefined, patient: undefined }
              : bedState,
          ),
        },
      };
    });
  }

  function handleContinue() {
    if (!activeShift) {
      router.replace("/start-shift");
      return;
    }

    if (!hasInvalidAge) {
      router.push("/assignment-review");
    }
  }

  function renderRoomItem({ item }: { item: PatientRoomGroup }) {
    return (
      <RoomPatientsRow
        ageTextByBedId={ageTextByBedId}
        onClearPatient={handleClearPatient}
        onUpdateAcuity={handleUpdateAcuity}
        room={item}
        onUpdatePatientField={handleUpdatePatientField}
      />
    );
  }

  return (
    <WorkflowListScreen
      activeStep="Patients"
      actionErrorText={
        activeShift
          ? hasInvalidAge
            ? wholeNumberAgeMessage
            : ""
          : "Start a shift before adding patients."
      }
      data={filteredRoomGroups}
      flow={shiftSetupFlow}
      headerActionLabel="Floors"
      keyExtractor={getRoomKey}
      listHeader={
        <PatientsListHeader
          onSelectFilter={setSelectedFilter}
          occupiedBedCount={occupiedBedCount}
          selectedFilter={selectedFilter}
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
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  bedHeaderActions: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "flex-end",
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
  acuityOptionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  acuityOption: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  selectedAcuityOption: {
    borderColor: colors.neutral.textPrimary,
    borderWidth: 2,
  },
  selectedAcuityMarker: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  selectedAcuityText: {
    fontSize: textSize.xs,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  acuityOptionText: {
    fontSize: textSize.md,
    fontWeight: "500",
  },
  greenAcuityOption: {
    backgroundColor: colors.status.green50,
    borderColor: colors.status.greenBorder,
  },
  yellowAcuityOption: {
    backgroundColor: colors.status.amber50,
    borderColor: colors.status.yellow700,
  },
  redAcuityOption: {
    backgroundColor: colors.status.red50,
    borderColor: colors.status.red700,
  },
  greenAcuityOptionText: {
    color: colors.status.green800,
  },
  yellowAcuityOptionText: {
    color: colors.status.amber800,
  },
  redAcuityOptionText: {
    color: colors.status.red800,
  },
});
