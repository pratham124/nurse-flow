import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  PlaceholderInput,
  SegmentedPlaceholder,
  SummaryTile,
  SummaryTileGrid,
  WorkflowListScreen,
  WorkflowSection,
} from "../components/workflow";
import { useLocalState } from "../store/LocalStateContext";
import { colors, radius, spacing, textSize } from "../theme/tokens";

const previewAssignments = [
  { room: "101", selectedIndex: 0 },
  { room: "102", selectedIndex: 1 },
];

type PreviewAssignment = (typeof previewAssignments)[number];

type AssignmentPreviewRowProps = {
  assignment: PreviewAssignment;
};

function DoctorSidesListHeader() {
  return (
    <View style={styles.headerContent}>
      <WorkflowSection
        note="Phase 1 uses exactly two doctor sides."
        title="Side names"
      >
        <PlaceholderInput label="Doctor side 1" placeholder="AB Side" />
        <PlaceholderInput label="Doctor side 2" placeholder="SK Side" />
      </WorkflowSection>

      <View style={styles.assignmentHeader}>
        <View style={styles.assignmentTitleGroup}>
          <Text style={styles.assignmentTitle}>Room assignments</Text>
          <Text style={styles.assignmentNote}>
            Every room will eventually belong to exactly one side.
          </Text>
        </View>

        <SummaryTileGrid>
          <SummaryTile value="AB Side" label="1 room" />
          <SummaryTile value="SK Side" label="1 room" />
        </SummaryTileGrid>
      </View>
    </View>
  );
}

function AssignmentPreviewRow({
  assignment,
}: AssignmentPreviewRowProps) {
  return (
    <View style={styles.assignmentRow}>
      <View>
        <Text style={styles.roomLabel}>Room {assignment.room}</Text>
        <Text style={styles.roomMeta}>Choose one doctor side</Text>
      </View>
      <SegmentedPlaceholder
        options={["AB Side", "SK Side"]}
        selectedIndex={assignment.selectedIndex}
      />
    </View>
  );
}

function renderAssignmentPreviewItem({ item }: { item: PreviewAssignment }) {
  return <AssignmentPreviewRow assignment={item} />;
}

function getPreviewAssignmentKey(assignment: PreviewAssignment) {
  return assignment.room;
}

export default function DoctorSidesScreen() {
  const { localState } = useLocalState();
  const screenTitle = localState.draftFloorTemplate?.name ?? "Doctor sides";

  return (
    <WorkflowListScreen
      activeStep="Sides"
      data={previewAssignments}
      headerActionLabel="Floors"
      helperText="Static preview only. Side names and room choices are not saved yet."
      keyExtractor={getPreviewAssignmentKey}
      listHeader={<DoctorSidesListHeader />}
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/template-review")}
      primaryLabel="Review"
      renderItem={renderAssignmentPreviewItem}
      subtitle="Step 3 of 4"
      title={screenTitle}
    />
  );
}

const styles = StyleSheet.create({
  headerContent: {
    gap: spacing.cardGap,
  },
  assignmentHeader: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  assignmentTitleGroup: {
    gap: spacing.xs,
  },
  assignmentTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: "500",
  },
  assignmentNote: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
  assignmentRow: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  roomLabel: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: "500",
  },
  roomMeta: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
  },
});
