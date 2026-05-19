import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  CheckCircleIcon,
  ScrollableList,
  SummaryTile,
  SummaryTileGrid,
  WorkflowSection,
  WorkflowScreen,
} from "../components/workflow";
import { assignmentFlow } from "../utils/workflowFlows";
import { colors, radius, spacing, textSize } from "../theme/tokens";

const checklistItems = [
  "Admitting side selected",
  "2 nurses have max loads",
  "2 occupied beds have acuity",
  "RN coverage available for red beds",
];

const redBeds = ["102-1"];

export default function AssignmentReviewScreen() {
  return (
    <WorkflowScreen
      activeStep="Assign"
      headerActionLabel="Floors"
      helperText="Static assignment review only. The local algorithm is added later."
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/floor-board")}
      primaryLabel="Run local assignment"
      flow={assignmentFlow}
      subtitle="Static readiness preview"
      title="Assignment review"
    >
      <WorkflowSection
        note="These counts are placeholders until census and nurse state exist."
        title="Shift summary"
      >
        <SummaryTileGrid>
          <SummaryTile value="2/3" label="Occupied" />
          <SummaryTile value="2" label="Nurses" />
          <SummaryTile value="11" label="Capacity" />
          <SummaryTile value="AB" label="Admitting" />
        </SummaryTileGrid>
      </WorkflowSection>

      <WorkflowSection
        note="Later, these rows will become real blockers before assignment can run."
        title="Readiness checklist"
      >
        <ScrollableList maxHeight={260}>
          {checklistItems.map((item) => (
            <View key={item} style={styles.checkRow}>
              <View style={styles.checkBadge}>
                <CheckCircleIcon />
              </View>
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
        </ScrollableList>
      </WorkflowSection>

      <WorkflowSection title="Nurse capacity">
        <ScrollableList maxHeight={260}>
          <PreviewRow label="Taylor" detail="RN, experienced - 0/5 assigned" />
          <PreviewRow
            divided
            label="Sam"
            detail="LPN, mid - 0/6 assigned"
          />
        </ScrollableList>
      </WorkflowSection>

      <WorkflowSection
        note="Red beds need RN coverage during the real assignment task."
        title="Red bed risk"
      >
        {redBeds.map((bed) => (
          <View key={bed} style={styles.warningRow}>
            <Text style={styles.warningLabel}>RN required</Text>
            <Text style={styles.warningText}>Bed {bed} is marked red.</Text>
          </View>
        ))}
      </WorkflowSection>
    </WorkflowScreen>
  );
}

function PreviewRow({
  label,
  detail,
  divided = false,
}: {
  label: string;
  detail: string;
  divided?: boolean;
}) {
  return (
    <View style={[styles.previewRow, divided ? styles.dividedRow : null]}>
      <Text style={styles.previewLabel}>{label}</Text>
      <Text style={styles.previewDetail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  checkRow: {
    alignItems: "center",
    borderLeftColor: colors.status.greenBorder,
    borderLeftWidth: 2,
    flexDirection: "row",
    gap: 10,
    paddingLeft: 10,
    paddingVertical: spacing.md,
  },
  checkBadge: {
    alignItems: "center",
    height: 18,
    justifyContent: "center",
    width: 18,
  },
  checkText: {
    color: colors.neutral.textPrimary,
    flex: 1,
    fontSize: textSize.md,
  },
  previewRow: {
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  previewLabel: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: "500",
  },
  previewDetail: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
  },
  warningRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  dividedRow: {
    borderTopColor: colors.neutral.borderTertiary,
    borderTopWidth: 0.5,
  },
  warningLabel: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.sm,
    fontWeight: "500",
  },
  warningText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
});
