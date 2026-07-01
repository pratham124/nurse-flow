import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { useAuthSession } from "../store/AuthSessionContext";
import { useServerWorkspace } from "../store/ServerWorkspaceContext";
import {
  colors,
  fontWeight,
  radius,
  shadows,
  spacing,
  textSize,
} from "../theme/tokens";
import type { JoinedNurseAssignmentView } from "../types/models";

type AssignmentSummaryProps = {
  assignmentView: JoinedNurseAssignmentView;
};

function AssignmentSummary({ assignmentView }: AssignmentSummaryProps) {
  return (
    <View style={styles.assignmentPanel}>
      <Text style={styles.sectionLabel}>Current assignment</Text>
      <Text style={styles.floorName}>{assignmentView.floorName}</Text>

      <View style={styles.statRow}>
        <View style={styles.statTile}>
          <Text style={styles.statValue}>
            {assignmentView.assignedBeds.length}
          </Text>
          <Text style={styles.statLabel}>Beds</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statValue}>
            {assignmentView.breakTimeLabel ?? "None"}
          </Text>
          <Text style={styles.statLabel}>Break</Text>
        </View>
      </View>

      <View style={styles.bedList}>
        {assignmentView.assignedBeds.length ? (
          assignmentView.assignedBeds.map((assignedBed) => (
            <View key={assignedBed.bed.id} style={styles.bedRow}>
              <Text style={styles.bedTitle}>
                Room {assignedBed.room.label} - Bed {assignedBed.bed.label}
              </Text>
              <Text style={styles.bedDetail}>
                {assignedBed.doctorSide.name}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyDetail}>
            No assigned beds are linked yet.
          </Text>
        )}
      </View>

      <View style={styles.requestList}>
        <Text style={styles.sectionLabel}>Request history</Text>
        {assignmentView.requestHistory.length ? (
          assignmentView.requestHistory.map((request) => (
            <View key={request.id} style={styles.requestRow}>
              <Text style={styles.requestTitle}>
                {request.status} {request.type}
              </Text>
              <Text style={styles.bedDetail}>{request.message}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyDetail}>No request history yet.</Text>
        )}
      </View>
    </View>
  );
}

export default function RegularNurseWorkspaceScreen() {
  const { authState } = useAuthSession();
  const { joinedNurseAccessState, retryLoadJoinedNurseAccess } =
    useServerWorkspace();
  const displayName =
    authState.status === "signed_in" ? authState.profile.displayName : "Nurse";

  function handleBackHome() {
    router.replace("/");
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Joined nurse workspace</Text>
        <Text style={styles.title}>{displayName}</Text>

        {joinedNurseAccessState.status === "loading" ||
        joinedNurseAccessState.status === "idle" ? (
          <LoadingState message="Checking shift access" />
        ) : null}

        {joinedNurseAccessState.status === "empty" ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyTitle}>No shift access yet</Text>
            <Text style={styles.message}>
              Enter a nurse code from charge to connect this account to an
              active shift.
            </Text>
          </View>
        ) : null}

        {joinedNurseAccessState.status === "ready" ? (
          <AssignmentSummary
            assignmentView={joinedNurseAccessState.assignmentView}
          />
        ) : null}

        {joinedNurseAccessState.status === "error" ? (
          <ErrorState
            message={joinedNurseAccessState.errorMessage}
            onRetry={retryLoadJoinedNurseAccess}
            title="Shift access could not load"
          />
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={handleBackHome}
          style={({ pressed }) => [
            styles.homeButton,
            pressed && styles.homeButtonPressed,
          ]}
        >
          <Text style={styles.homeButtonText}>Back to home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.neutral.backgroundPrimary,
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xl,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.xl,
    ...shadows.sm,
  },
  assignmentPanel: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.md,
    padding: spacing.lg,
  },
  bedDetail: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  bedList: {
    gap: spacing.sm,
  },
  bedRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.xs,
    padding: spacing.md,
  },
  bedTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  emptyDetail: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  emptyPanel: {
    backgroundColor: colors.neutral.backgroundSecondary,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.lg,
    borderWidth: 0.5,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  emptyTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.bold,
  },
  eyebrow: {
    color: colors.brand.burgundy,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
  },
  title: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.xl,
    fontWeight: fontWeight.heavy,
  },
  message: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.md,
    fontWeight: fontWeight.medium,
    lineHeight: 20,
  },
  floorName: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.lg,
    fontWeight: fontWeight.heavy,
  },
  sectionLabel: {
    color: colors.brand.burgundy,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
  },
  requestList: {
    gap: spacing.sm,
  },
  requestRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.xs,
    padding: spacing.md,
  },
  requestTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
    textTransform: "capitalize",
  },
  statLabel: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.xs,
    fontWeight: fontWeight.semibold,
  },
  statRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statTile: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  statValue: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  homeButton: {
    alignItems: "center",
    backgroundColor: colors.brand.burgundy,
    borderRadius: radius.lg,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  homeButtonPressed: {
    opacity: 0.82,
  },
  homeButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.action,
    fontWeight: fontWeight.semibold,
  },
});
