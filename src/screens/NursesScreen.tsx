import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  NumberStepperPlaceholder,
  PlaceholderButton,
  PlaceholderInput,
  SegmentedPlaceholder,
  SummaryTile,
  SummaryTileGrid,
  WorkflowListScreen,
  WorkflowSection,
} from "../components/workflow";
import { shiftSetupFlow } from "../utils/workflowFlows";
import { colors, radius, spacing, textSize } from "../theme/tokens";

const previewNurses = [
  { name: "Taylor", license: "RN", experience: "Experienced", maxLoad: "5" },
  { name: "Sam", license: "LPN", experience: "Mid", maxLoad: "6" },
];

type PreviewNurse = (typeof previewNurses)[number];

function NursesListHeader() {
  return (
    <View style={styles.headerContent}>
      <WorkflowSection
        note="Later, each nurse will be added to the active local shift."
        title="Add nurse"
      >
        <PlaceholderInput label="Nurse name" placeholder="Taylor" />
        <SegmentedPlaceholder options={["RN", "LPN"]} />
        <SegmentedPlaceholder
          options={["New grad", "Mid", "Experienced"]}
          selectedIndex={2}
        />
        <PlaceholderButton label="Add nurse" />
      </WorkflowSection>

      <View style={styles.shiftNursesHeader}>
        <View style={styles.shiftNursesTitleGroup}>
          <Text style={styles.shiftNursesTitle}>Shift nurses</Text>
          <Text style={styles.shiftNursesNote}>
            Max load is a hard cap for assignment in later tasks.
          </Text>
        </View>

        <SummaryTileGrid>
          <SummaryTile value="2" label="Nurses" />
          <SummaryTile value="11" label="Total capacity" />
        </SummaryTileGrid>
      </View>
    </View>
  );
}

function NursePreviewRow({ nurse }: { nurse: PreviewNurse }) {
  return (
    <View style={styles.nurseRow}>
      <View style={styles.nurseInfo}>
        <Text style={styles.nurseName}>{nurse.name}</Text>
        <Text style={styles.nurseMeta}>
          {nurse.license} - {nurse.experience}
        </Text>
      </View>
      <View style={styles.maxLoad}>
        <Text style={styles.maxLoadLabel}>Max load</Text>
        <NumberStepperPlaceholder value={nurse.maxLoad} />
      </View>
    </View>
  );
}

function renderNursePreviewItem({ item }: { item: PreviewNurse }) {
  return <NursePreviewRow nurse={item} />;
}

function getPreviewNurseKey(nurse: PreviewNurse) {
  return `${nurse.name}-${nurse.license}`;
}

export default function NursesScreen() {
  return (
    <WorkflowListScreen
      activeStep="Nurses"
      data={previewNurses}
      flow={shiftSetupFlow}
      headerActionLabel="Floors"
      helperText="Static nurse setup only. Nurse rows are sample data for now."
      keyExtractor={getPreviewNurseKey}
      listHeader={<NursesListHeader />}
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/patients-and-acuity")}
      primaryLabel="Continue"
      renderItem={renderNursePreviewItem}
      subtitle="Step 2 of 3"
      title="Nurses"
    />
  );
}

const styles = StyleSheet.create({
  headerContent: {
    gap: spacing.cardGap,
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
  shiftNursesNote: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
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
