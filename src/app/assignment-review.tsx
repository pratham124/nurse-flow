import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  WorkflowSection,
  WorkflowScreen,
  SummaryChip,
} from "../components/workflow";
import { assignmentFlow } from "../constants/workflowFlows";
import { colors, spacing, textSize } from "../theme/tokens";

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
        <View style={styles.summaryRow}>
          <SummaryChip label="2/3 occupied" />
          <SummaryChip label="2 nurses" />
          <SummaryChip label="11 capacity" />
          <SummaryChip label="AB admitting" />
        </View>
      </WorkflowSection>

      <WorkflowSection
        note="Later, these rows will become real blockers before assignment can run."
        title="Readiness checklist"
      >
        {checklistItems.map((item) => (
          <View key={item} style={styles.checkRow}>
            <Text style={styles.checkMark}>OK</Text>
            <Text style={styles.checkText}>{item}</Text>
          </View>
        ))}
      </WorkflowSection>

      <WorkflowSection title="Nurse capacity">
        <PreviewRow label="Taylor" detail="RN, experienced - 0/5 assigned" />
        <PreviewRow label="Sam" detail="LPN, mid - 0/6 assigned" />
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

function PreviewRow({ label, detail }: { label: string; detail: string }) {
  return (
    <View style={styles.previewRow}>
      <Text style={styles.previewLabel}>{label}</Text>
      <Text style={styles.previewDetail}>{detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  checkRow: {
    alignItems: "center",
    borderTopColor: colors.neutral.border,
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  checkMark: {
    color: colors.acuity.green,
    fontSize: textSize.sm,
    fontWeight: "700",
    minWidth: 28,
  },
  checkText: {
    color: colors.neutral.text,
    flex: 1,
    fontSize: textSize.md,
  },
  previewRow: {
    borderTopColor: colors.neutral.border,
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  previewLabel: {
    color: colors.neutral.text,
    fontSize: textSize.md,
    fontWeight: "700",
  },
  previewDetail: {
    color: colors.neutral.mutedText,
    fontSize: textSize.sm,
  },
  warningRow: {
    backgroundColor: colors.brand.warmGold,
    gap: spacing.xs,
    padding: spacing.md,
  },
  warningLabel: {
    color: colors.neutral.text,
    fontSize: textSize.sm,
    fontWeight: "700",
  },
  warningText: {
    color: colors.neutral.text,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
});
