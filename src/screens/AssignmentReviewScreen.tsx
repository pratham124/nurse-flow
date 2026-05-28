import { router } from "expo-router";
import { StyleSheet, Text, View, type DimensionValue } from "react-native";

import {
  CheckCircleIcon,
  SummaryTile,
  SummaryTileGrid,
  WorkflowListScreen,
  WorkflowSection,
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

const nurseCapacityRows = [
  {
    assigned: 0,
    detail: "RN, experienced",
    max: 5,
    name: "Taylor",
  },
  {
    assigned: 0,
    detail: "LPN, mid",
    max: 6,
    name: "Sam",
  },
];

type NurseCapacityRow = (typeof nurseCapacityRows)[number];

function AssignmentReviewListHeader() {
  return (
    <View style={styles.headerContent}>
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
        {checklistItems.map((item) => (
          <View key={item} style={styles.checkRow}>
            <View style={styles.checkBadge}>
              <CheckCircleIcon />
            </View>
            <Text style={styles.checkText}>{item}</Text>
          </View>
        ))}
      </WorkflowSection>

      <View style={styles.capacityTitleCard}>
        <Text style={styles.capacityTitle}>Nurse capacity</Text>
      </View>
    </View>
  );
}

function RedBedRiskFooter() {
  return (
    <View style={styles.footerContent}>
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
    </View>
  );
}

function renderNurseCapacityItem({
  item,
}: {
  item: NurseCapacityRow;
}) {
  return (
    <CapacityRow
      assigned={item.assigned}
      detail={item.detail}
      max={item.max}
      name={item.name}
    />
  );
}

function getNurseCapacityKey(nurse: NurseCapacityRow) {
  return nurse.name;
}

export default function AssignmentReviewScreen() {
  return (
    <WorkflowListScreen
      activeStep="Assign"
      data={nurseCapacityRows}
      flow={assignmentFlow}
      headerActionLabel="Floors"
      helperText="Static assignment review only. The local algorithm is added later."
      keyExtractor={getNurseCapacityKey}
      listFooter={<RedBedRiskFooter />}
      listHeader={<AssignmentReviewListHeader />}
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/floor-board")}
      primaryLabel="Run local assignment"
      renderItem={renderNurseCapacityItem}
      subtitle="Static readiness preview"
      title="Assignment review"
    />
  );
}

function CapacityRow({
  assigned,
  detail,
  max,
  name,
}: {
  assigned: number;
  detail: string;
  max: number;
  name: string;
}) {
  const fillPercent: DimensionValue =
    max > 0 ? `${Math.min((assigned / max) * 100, 100)}%` : "0%";

  return (
    <View style={styles.capacityRow}>
      <View style={styles.capacityHeader}>
        <View style={styles.nurseAvatar}>
          <Text style={styles.nurseAvatarText}>{name.charAt(0)}</Text>
        </View>
        <View style={styles.capacityInfo}>
          <Text style={styles.capacityName}>{name}</Text>
          <Text style={styles.capacityDetail}>{detail}</Text>
        </View>
        <View style={styles.loadPill}>
          <Text style={styles.loadPillText}>
            {assigned}/{max}
          </Text>
        </View>
      </View>

      <View style={styles.capacityTrack}>
        <View style={[styles.capacityFill, { width: fillPercent }]} />
      </View>
      <Text style={styles.capacityHint}>
        {max - assigned} open {max - assigned === 1 ? "slot" : "slots"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContent: {
    gap: spacing.cardGap,
  },
  footerContent: {
    paddingTop: spacing.md,
  },
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
  capacityRow: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  capacityTitleCard: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    padding: spacing.lg,
  },
  capacityTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: "500",
  },
  capacityHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  nurseAvatar: {
    alignItems: "center",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: 18,
    borderWidth: 0.5,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  nurseAvatarText: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: "500",
  },
  capacityInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  capacityName: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: "500",
  },
  capacityDetail: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
  },
  loadPill: {
    backgroundColor: colors.status.gray100,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: spacing.xs,
  },
  loadPillText: {
    color: colors.status.gray800,
    fontSize: 13,
    fontWeight: "500",
  },
  capacityTrack: {
    backgroundColor: colors.neutral.surface,
    borderRadius: radius.pill,
    height: 6,
    overflow: "hidden",
  },
  capacityFill: {
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.pill,
    height: "100%",
    minWidth: 0,
  },
  capacityHint: {
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
