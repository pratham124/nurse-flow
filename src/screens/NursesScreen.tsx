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
import { AssignedShiftEditGuard } from "../components/assignment/AssignedShiftEditGuard";
import { useActiveShiftDraft } from "../hooks/useActiveShiftDraft";
import { useServerWorkspace } from "../store/ServerWorkspaceContext";
import { shiftSetupFlow } from "../utils/workflowFlows";
import { colors, radius, spacing, textSize, fontWeight, shadows } from "../theme/tokens";
import type { ExperienceLevel, LicenseType, Nurse, Shift } from "../types/models";

const licenseTypeOptions: LicenseType[] = ["RN", "LPN"];
const experienceLevelOptions: ExperienceLevel[] = [
  "new_grad",
  "mid",
  "experienced",
];
const nurseNameRequiredMessage = "Nurse name is required.";
const requiredNurseMessage = "Add at least one nurse before continuing.";
const missingMaxLoadMessage = "Set a max load for each nurse.";
const minimumMaxLoadMessage = "Max load must be at least 1.";
const wholeNumberMaxLoadMessage = "Max load must be a whole number.";

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
  onUpdateMaxPatientLoad: (nurseId: string, maxPatientLoad: number) => void;
  rowNumber: number;
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

function getSideBasedMaxLoad(activeShift: Shift) {
  return Math.max(
    activeShift.sideLoadLimits.admitting.max,
    activeShift.sideLoadLimits.nonAdmitting.max,
  );
}

function getMaximumMaxLoadMessage(sideBasedMaxLoad: number) {
  return `Max load cannot be higher than the side-based max of ${sideBasedMaxLoad}.`;
}

function getMaxLoadValidationMessage(
  maxPatientLoad: number,
  sideBasedMaxLoad: number,
) {
  if (!Number.isInteger(maxPatientLoad)) {
    return wholeNumberMaxLoadMessage;
  }

  if (maxPatientLoad < 1) {
    return minimumMaxLoadMessage;
  }

  if (maxPatientLoad > sideBasedMaxLoad) {
    return getMaximumMaxLoadMessage(sideBasedMaxLoad);
  }

  return "";
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

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function NurseRow({
  nurse,
  onRemoveNurse,
  onUpdateMaxPatientLoad,
  rowNumber,
}: NurseRowProps) {
  const maxLoadValue =
    nurse.maxPatientLoad > 0 ? nurse.maxPatientLoad.toString() : "--";
  const canDecreaseMaxLoad = nurse.maxPatientLoad > 0;

  return (
    <SwipeRevealAction
      accessibilityLabel={`Remove nurse ${rowNumber}, ${nurse.name}`}
      actionIcon={<TrashIcon color={colors.neutral.surface} size={18} />}
      actionLabel="Remove"
      actionWidth={72}
      onActionPress={() => onRemoveNurse(nurse.id)}
    >
      <View style={styles.nurseRow}>
        <View style={styles.nurseLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(nurse.name)}</Text>
          </View>
          <View style={styles.nurseInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.nurseName}>{nurse.name}</Text>
              <View
                style={[
                  styles.licenseBadge,
                  nurse.licenseType === "RN" ? styles.rnBadge : styles.lpnBadge,
                ]}
              >
                <Text
                  style={[
                    styles.licenseBadgeText,
                    nurse.licenseType === "RN" ? styles.rnBadgeText : styles.lpnBadgeText,
                  ]}
                >
                  {nurse.licenseType}
                </Text>
              </View>
            </View>
            <Text style={styles.nurseMeta}>
              Nurse {rowNumber} • {getExperienceLabel(nurse.experienceLevel)}
            </Text>
          </View>
        </View>
        <View style={styles.maxLoad}>
          <Text style={styles.maxLoadLabel}>Max load</Text>
          <NumberStepperPlaceholder
            decrementLabel={`Decrease max load for nurse ${rowNumber}, ${nurse.name}`}
            incrementLabel={`Increase max load for nurse ${rowNumber}, ${nurse.name}`}
            onDecrement={
              canDecreaseMaxLoad
                ? () =>
                    onUpdateMaxPatientLoad(
                      nurse.id,
                      nurse.maxPatientLoad - 1,
                    )
                : undefined
            }
            onIncrement={() =>
              onUpdateMaxPatientLoad(nurse.id, nurse.maxPatientLoad + 1)
            }
            value={maxLoadValue}
          />
        </View>
      </View>
    </SwipeRevealAction>
  );
}

function getNurseKey(nurse: Nurse) {
  return nurse.id;
}

export default function NursesScreen() {
  const {
    activeShift: serverActiveShift,
    saveActiveShift,
    saveStatus,
  } = useServerWorkspace();
  const { draftShift: activeShift, setDraftShift } =
    useActiveShiftDraft(serverActiveShift);
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
  const [serverSaveError, setServerSaveError] = useState("");
  const isSavingShift = saveStatus === "saving";

  function handleNurseNameChange(name: string) {
    setNurseName(name);
    setServerSaveError("");

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

    const nextNurse: Nurse = {
      id: createLocalId("nurse"),
      name: trimmedName,
      licenseType,
      experienceLevel,
      maxPatientLoad: activeShift.sideLoadLimits.admitting.max,
    };

    setDraftShift({
      ...activeShift,
      nurses: [...activeShift.nurses, nextNurse],
    });

    setNurseName("");
    setNurseNameError("");
    setNurseListError("");
    setServerSaveError("");
  }

  function handleRemoveNurse(nurseId: string) {
    setDraftShift((currentShift) => {
      if (!currentShift) {
        return currentShift;
      }

      const nurseExists = currentShift.nurses.some(
        (nurse) => nurse.id === nurseId,
      );

      if (!nurseExists) {
        return currentShift;
      }

      const shouldClearAssignment =
        currentShift.status === "assigned" ||
        Boolean(currentShift.assignmentResult);

      return {
        ...currentShift,
        assignmentResult: shouldClearAssignment
          ? undefined
          : currentShift.assignmentResult,
        flags: shouldClearAssignment ? [] : currentShift.flags,
        nurses: currentShift.nurses.filter((nurse) => nurse.id !== nurseId),
        status: shouldClearAssignment ? "setup" : currentShift.status,
      };
    });
  }

  function handleUpdateMaxPatientLoad(
    nurseId: string,
    maxPatientLoad: number,
  ) {
    if (!activeShift) {
      return;
    }

    const validationMessage = getMaxLoadValidationMessage(
      maxPatientLoad,
      getSideBasedMaxLoad(activeShift),
    );

    if (validationMessage) {
      setNurseListError(validationMessage);
      return;
    }

    setDraftShift((currentShift) => {
      if (!currentShift) {
        return currentShift;
      }

      return {
        ...currentShift,
        nurses: currentShift.nurses.map((nurse) =>
          nurse.id === nurseId ? { ...nurse, maxPatientLoad } : nurse,
        ),
      };
    });

    setNurseListError("");
    setServerSaveError("");
  }

  async function handleContinue() {
    if (!activeShift) {
      return;
    }

    if (nurses.length === 0) {
      setNurseListError(requiredNurseMessage);
      return;
    }

    if (nurses.some((nurse) => nurse.maxPatientLoad < 1)) {
      setNurseListError(missingMaxLoadMessage);
      return;
    }

    const invalidMaxLoadMessage = nurses
      .map((nurse) =>
        getMaxLoadValidationMessage(
          nurse.maxPatientLoad,
          getSideBasedMaxLoad(activeShift),
        ),
      )
      .find(Boolean);

    if (invalidMaxLoadMessage) {
      setNurseListError(invalidMaxLoadMessage);
      return;
    }

    try {
      setServerSaveError("");
      await saveActiveShift(activeShift);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nurses could not be saved. Try again.";

      setServerSaveError(message);
      return;
    }

    router.push("/patients-and-acuity");
  }

  function renderNurseItem({ item, index }: { item: Nurse; index: number }) {
    return (
      <NurseRow
        nurse={item}
        onRemoveNurse={handleRemoveNurse}
        onUpdateMaxPatientLoad={handleUpdateMaxPatientLoad}
        rowNumber={index + 1}
      />
    );
  }

  return (
    <>
      <WorkflowListScreen
        activeStep="Nurses"
        actionErrorText={
          activeShift
            ? serverSaveError || nurseListError
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
        primaryDisabled={isSavingShift}
        primaryLabel={
          isSavingShift
            ? "Saving..."
            : serverSaveError
              ? "Retry save"
              : "Continue"
        }
        renderItem={renderNurseItem}
        subtitle="Step 2 of 3"
        title={activeShift?.floorName ?? "Nurses"}
      />
      <AssignedShiftEditGuard activeShift={serverActiveShift} />
    </>
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
    fontWeight: fontWeight.medium,
  },
  shiftNursesHeader: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  shiftNursesTitleGroup: {
    gap: spacing.xs,
  },
  shiftNursesTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  nurseRow: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  nurseLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  avatar: {
    backgroundColor: colors.brand.burgundy10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderColor: colors.brand.burgundy15,
    borderWidth: 1,
  },
  avatarText: {
    color: colors.brand.burgundy,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  licenseBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radius.micro,
  },
  rnBadge: {
    backgroundColor: colors.status.blue50,
  },
  rnBadgeText: {
    color: colors.status.blue800,
  },
  lpnBadge: {
    backgroundColor: colors.status.amber50,
  },
  lpnBadgeText: {
    color: colors.status.amber800,
  },
  licenseBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
  nurseInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  nurseName: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  nurseMeta: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
  },
  maxLoad: {
    alignItems: "flex-end",
    gap: spacing.xs,
  },
  maxLoadLabel: {
    color: colors.neutral.textSecondary,
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
});
