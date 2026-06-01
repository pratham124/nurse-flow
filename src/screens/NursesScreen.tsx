import { useState } from "react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  NumberStepperPlaceholder,
  PlaceholderButton,
  PlaceholderInput,
  PlusIcon,
  SegmentedPlaceholder,
  SummaryTile,
  SummaryTileGrid,
  SwipeRevealAction,
  TrashIcon,
  WorkflowListScreen,
  WorkflowSection,
} from "../components/workflow";
import { createLocalId } from "../helpers/localId";
import { useLocalState } from "../store/LocalStateContext";
import { shiftSetupFlow } from "../utils/workflowFlows";
import { colors, radius, spacing, textSize } from "../theme/tokens";
import type { ExperienceLevel, LicenseType, Nurse } from "../types/models";

const licenseTypeOptions: LicenseType[] = ["RN", "LPN"];
const experienceLevelOptions: ExperienceLevel[] = [
  "new_grad",
  "mid",
  "experienced",
];
const nurseNameRequiredMessage = "Nurse name is required.";
const requiredNurseMessage = "Add at least one nurse before continuing.";

type AddNurseFormProps = {
  experienceLevel: ExperienceLevel;
  licenseType: LicenseType;
  name: string;
  nameError: string;
  onAddNurse: () => void;
  onExperienceLevelChange: (experienceLevel: ExperienceLevel) => void;
  onLicenseTypeChange: (licenseType: LicenseType) => void;
  onNameChange: (name: string) => void;
};

type NursesListHeaderProps = AddNurseFormProps & {
  nurseCount: number;
  totalCapacity: number;
};

type NurseRowProps = {
  nurse: Nurse;
  onRemoveNurse: (nurseId: string) => void;
};

function getExperienceLabel(experienceLevel: ExperienceLevel) {
  switch (experienceLevel) {
    case "new_grad":
      return "New grad";
    case "mid":
      return "Mid";
    case "experienced":
      return "Experienced";
  }
}

function getSelectedLicenseTypeIndex(licenseType: LicenseType) {
  return licenseTypeOptions.findIndex((option) => option === licenseType);
}

function getSelectedExperienceLevelIndex(experienceLevel: ExperienceLevel) {
  return experienceLevelOptions.findIndex(
    (option) => option === experienceLevel,
  );
}

function AddNurseForm({
  experienceLevel,
  licenseType,
  name,
  nameError,
  onAddNurse,
  onExperienceLevelChange,
  onLicenseTypeChange,
  onNameChange,
}: AddNurseFormProps) {
  return (
    <WorkflowSection title="Add nurse">
      <PlaceholderInput
        errorText={nameError}
        label="Nurse name"
        onChangeText={onNameChange}
        placeholder="Taylor"
        value={name}
      />

      <View style={styles.selectorField}>
        <Text style={styles.selectorLabel}>License type</Text>
        <SegmentedPlaceholder
          options={licenseTypeOptions}
          selectedIndex={getSelectedLicenseTypeIndex(licenseType)}
          onSelect={(index) => onLicenseTypeChange(licenseTypeOptions[index])}
        />
      </View>

      <View style={styles.selectorField}>
        <Text style={styles.selectorLabel}>Experience level</Text>
        <SegmentedPlaceholder
          options={experienceLevelOptions.map(getExperienceLabel)}
          selectedIndex={getSelectedExperienceLevelIndex(experienceLevel)}
          onSelect={(index) =>
            onExperienceLevelChange(experienceLevelOptions[index])
          }
        />
      </View>

      <PlaceholderButton
        icon={<PlusIcon color={colors.neutral.surface} size={12} />}
        label="Add nurse"
        onPress={onAddNurse}
        variant="primary"
      />
    </WorkflowSection>
  );
}

function NursesListHeader({
  experienceLevel,
  licenseType,
  name,
  nameError,
  nurseCount,
  onAddNurse,
  onExperienceLevelChange,
  onLicenseTypeChange,
  onNameChange,
  totalCapacity,
}: NursesListHeaderProps) {
  return (
    <View style={styles.headerContent}>
      <AddNurseForm
        experienceLevel={experienceLevel}
        licenseType={licenseType}
        name={name}
        nameError={nameError}
        onAddNurse={onAddNurse}
        onExperienceLevelChange={onExperienceLevelChange}
        onLicenseTypeChange={onLicenseTypeChange}
        onNameChange={onNameChange}
      />

      <View style={styles.shiftNursesHeader}>
        <View style={styles.shiftNursesTitleGroup}>
          <Text style={styles.shiftNursesTitle}>Shift nurses</Text>
        </View>

        <SummaryTileGrid>
          <SummaryTile value={nurseCount.toString()} label="Nurses" />
          <SummaryTile value={totalCapacity.toString()} label="Total capacity" />
        </SummaryTileGrid>
      </View>
    </View>
  );
}

function NurseRow({ nurse, onRemoveNurse }: NurseRowProps) {
  const maxLoadValue =
    nurse.maxPatientLoad > 0 ? nurse.maxPatientLoad.toString() : "--";

  return (
    <SwipeRevealAction
      accessibilityLabel={`Remove nurse ${nurse.name}`}
      actionIcon={<TrashIcon color={colors.neutral.surface} size={18} />}
      actionLabel="Remove"
      actionWidth={72}
      onActionPress={() => onRemoveNurse(nurse.id)}
    >
      <View style={styles.nurseRow}>
        <View style={styles.nurseInfo}>
          <Text style={styles.nurseName}>{nurse.name}</Text>
          <Text style={styles.nurseMeta}>
            {nurse.licenseType} - {getExperienceLabel(nurse.experienceLevel)}
          </Text>
        </View>
        <View style={styles.maxLoad}>
          <Text style={styles.maxLoadLabel}>Max load</Text>
          <NumberStepperPlaceholder value={maxLoadValue} />
        </View>
      </View>
    </SwipeRevealAction>
  );
}

function getNurseKey(nurse: Nurse) {
  return nurse.id;
}

export default function NursesScreen() {
  const { localState, setLocalState } = useLocalState();
  const activeShift = localState.activeShift;
  const nurses = activeShift?.nurses ?? [];
  const totalCapacity = nurses.reduce(
    (capacity, nurse) => capacity + nurse.maxPatientLoad,
    0,
  );
  const [nurseName, setNurseName] = useState("");
  const [licenseType, setLicenseType] = useState<LicenseType>("RN");
  const [experienceLevel, setExperienceLevel] =
    useState<ExperienceLevel>("experienced");
  const [nurseNameError, setNurseNameError] = useState("");
  const [nurseListError, setNurseListError] = useState("");

  function handleNurseNameChange(name: string) {
    setNurseName(name);

    if (nurseNameError) {
      setNurseNameError("");
    }
  }

  function handleAddNurse() {
    const trimmedName = nurseName.trim();

    if (!trimmedName) {
      setNurseNameError(nurseNameRequiredMessage);
      return;
    }

    if (!activeShift) {
      return;
    }

    setLocalState((currentState) => {
      if (!currentState.activeShift) {
        return currentState;
      }

      const nextNurse: Nurse = {
        id: createLocalId("nurse"),
        name: trimmedName,
        licenseType,
        experienceLevel,
        maxPatientLoad: 0,
      };

      return {
        ...currentState,
        activeShift: {
          ...currentState.activeShift,
          nurses: [...currentState.activeShift.nurses, nextNurse],
        },
      };
    });

    setNurseName("");
    setNurseNameError("");
    setNurseListError("");
  }

  function handleRemoveNurse(nurseId: string) {
    setLocalState((currentState) => {
      const currentShift = currentState.activeShift;

      if (!currentShift) {
        return currentState;
      }

      const nurseExists = currentShift.nurses.some(
        (nurse) => nurse.id === nurseId,
      );

      if (!nurseExists) {
        return currentState;
      }

      const shouldClearAssignment =
        currentShift.status === "assigned" ||
        Boolean(currentShift.assignmentResult);

      return {
        ...currentState,
        activeShift: {
          ...currentShift,
          assignmentResult: shouldClearAssignment
            ? undefined
            : currentShift.assignmentResult,
          flags: shouldClearAssignment ? [] : currentShift.flags,
          nurses: currentShift.nurses.filter((nurse) => nurse.id !== nurseId),
          status: shouldClearAssignment ? "setup" : currentShift.status,
        },
      };
    });
  }

  function handleContinue() {
    if (!activeShift) {
      return;
    }

    if (nurses.length === 0) {
      setNurseListError(requiredNurseMessage);
      return;
    }

    router.push("/patients-and-acuity");
  }

  function renderNurseItem({ item }: { item: Nurse }) {
    return <NurseRow nurse={item} onRemoveNurse={handleRemoveNurse} />;
  }

  return (
    <WorkflowListScreen
      activeStep="Nurses"
      actionErrorText={
        activeShift
          ? nurseListError
          : "Start a shift before adding nurses."
      }
      data={nurses}
      flow={shiftSetupFlow}
      headerActionLabel="Floors"
      keyExtractor={getNurseKey}
      listHeader={
        <NursesListHeader
          experienceLevel={experienceLevel}
          licenseType={licenseType}
          name={nurseName}
          nameError={nurseNameError}
          nurseCount={nurses.length}
          onAddNurse={handleAddNurse}
          onExperienceLevelChange={setExperienceLevel}
          onLicenseTypeChange={setLicenseType}
          onNameChange={handleNurseNameChange}
          totalCapacity={totalCapacity}
        />
      }
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={handleContinue}
      primaryLabel="Continue"
      renderItem={renderNurseItem}
      subtitle="Step 2 of 3"
      title="Nurses"
    />
  );
}

const styles = StyleSheet.create({
  headerContent: {
    gap: spacing.cardGap,
  },
  selectorField: {
    gap: spacing.sm,
  },
  selectorLabel: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
  },
  shiftNursesHeader: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  shiftNursesTitleGroup: {
    gap: spacing.xs,
  },
  shiftNursesTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: "500",
  },
  nurseRow: {
    alignItems: "center",
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  nurseInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  nurseName: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: "500",
  },
  nurseMeta: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
  },
  maxLoad: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  maxLoadLabel: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
  },
});
