import { useState } from "react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  FilterChip,
  FilterChipRow,
  SeverityBadge,
  SummaryChip,
  SummaryTile,
  SummaryTileGrid,
  WorkflowListScreen,
  WorkflowSection,
} from "../components/workflow";
import { useLocalState } from "../store/LocalStateContext";
import { colors, radius, spacing, textSize, fontWeight, shadows } from "../theme/tokens";
import type { Flag, FlagSeverity, NurseRequest, Shift } from "../types/models";
import { getShiftNurseRequests } from "../utils/nurseRequests";
import { assignmentFlow } from "../utils/workflowFlows";

const flagFilters = ["All", "Critical", "Warning", "Info"] as const;
const requestFilters = ["All", "Issues", "Swaps"] as const;

type FlagFilter = (typeof flagFilters)[number];
type RequestFilter = (typeof requestFilters)[number];

type FlagRowViewModel = {
  id: string;
  message: string;
  severity: FlagSeverity;
  severityLabel: string;
  target: string;
};

type NurseRequestRowViewModel = {
  bedContext: string;
  createdAtText: string;
  id: string;
  message: string;
  requestType: NurseRequest["type"];
  requesterName: string;
  statusLabel: string;
  typeLabel: string;
};

type FlagsListHeaderProps = {
  criticalCount: number;
  infoCount: number;
  requestCount: number;
  onFilterPress: (filter: FlagFilter) => void;
  onRequestFilterPress: (filter: RequestFilter) => void;
  selectedFilter: FlagFilter;
  selectedRequestFilter: RequestFilter;
  warningCount: number;
};

type FlagRowProps = {
  flag: FlagRowViewModel;
};

type EmptyFlagRowProps = {
  message: string;
};

type SectionHeaderRowProps = {
  subtitle?: string;
  title: string;
};

type NurseRequestRowProps = {
  request: NurseRequestRowViewModel;
};

type FlagListItem =
  | { type: "section"; id: string; subtitle?: string; title: string }
  | { type: "flag"; flag: FlagRowViewModel }
  | { type: "request"; request: NurseRequestRowViewModel }
  | { type: "empty"; id: string; message: string };

function FlagsListHeader({
  criticalCount,
  infoCount,
  requestCount,
  onFilterPress,
  onRequestFilterPress,
  selectedFilter,
  selectedRequestFilter,
  warningCount,
}: FlagsListHeaderProps) {
  return (
    <View style={styles.headerContent}>
      <WorkflowSection title="Flag summary">
        <SummaryTileGrid>
          <SummaryTile value={criticalCount.toString()} label="Critical" />
          <SummaryTile value={warningCount.toString()} label="Warning" />
          <SummaryTile value={infoCount.toString()} label="Info" />
          <SummaryTile value={requestCount.toString()} label="Requests" />
        </SummaryTileGrid>
      </WorkflowSection>

      <WorkflowSection title="Assignment filters">
        <FilterChipRow>
          {flagFilters.map((filter) => (
            <FilterChip
              key={filter}
              label={filter}
              onPress={() => onFilterPress(filter)}
              selected={filter === selectedFilter}
            />
          ))}
        </FilterChipRow>
      </WorkflowSection>

      <WorkflowSection title="Local request filters">
        <FilterChipRow>
          {requestFilters.map((filter) => (
            <FilterChip
              key={filter}
              label={filter}
              onPress={() => onRequestFilterPress(filter)}
              selected={filter === selectedRequestFilter}
            />
          ))}
        </FilterChipRow>
      </WorkflowSection>
    </View>
  );
}

function getSeverityLabel(severity: FlagSeverity) {
  if (severity === "critical") {
    return "Critical";
  }

  if (severity === "warning") {
    return "Warning";
  }

  return "Info";
}

function getFlagTarget(activeShift: Shift, flag: Flag) {
  if (flag.bedId) {
    const bed = activeShift.beds.find((shiftBed) => shiftBed.id === flag.bedId);
    const room = activeShift.rooms.find(
      (shiftRoom) => shiftRoom.id === (flag.roomId ?? bed?.roomId),
    );

    return room && bed
      ? `Bed ${bed.label} / Room ${room.label}`
      : bed
        ? `Bed ${bed.label}`
        : "Bed";
  }

  if (flag.roomId) {
    const room = activeShift.rooms.find(
      (shiftRoom) => shiftRoom.id === flag.roomId,
    );

    return room ? `Room ${room.label}` : "Room";
  }

  if (flag.nurseId) {
    const nurse = activeShift.nurses.find(
      (shiftNurse) => shiftNurse.id === flag.nurseId,
    );

    return nurse?.name ?? "Nurse";
  }

  if (flag.teamId) {
    const team = activeShift.assignmentResult?.generatedTeams.find(
      (generatedTeam) => generatedTeam.id === flag.teamId,
    );

    return team?.label ?? "Team";
  }

  return "Floor";
}

function getFlagRows(activeShift?: Shift): FlagRowViewModel[] {
  if (!activeShift) {
    return [];
  }

  return activeShift.flags.map((flag) => ({
    id: flag.id,
    message: flag.message,
    severity: flag.severity,
    severityLabel: getSeverityLabel(flag.severity),
    target: getFlagTarget(activeShift, flag),
  }));
}

function getRequestTypeLabel(request: NurseRequest) {
  return request.type === "swap" ? "Mock swap" : "Mock issue";
}

function getRequestStatusLabel(request: NurseRequest) {
  return request.status.charAt(0).toUpperCase() + request.status.slice(1);
}

function getRequestCreatedText(request: NurseRequest) {
  return new Date(request.createdAt).toLocaleString();
}

function getRequestBedContext(activeShift: Shift, request: NurseRequest) {
  if (!request.sourceBedId) {
    return request.type === "swap" ? "Bed no longer available" : "No bed context";
  }

  const bed = activeShift.beds.find(
    (shiftBed) => shiftBed.id === request.sourceBedId,
  );

  if (!bed) {
    return "Bed no longer available";
  }

  const room = activeShift.rooms.find(
    (shiftRoom) => shiftRoom.id === bed.roomId,
  );

  return room
    ? `Room ${room.label} - Bed ${bed.label}`
    : `Bed ${bed.label}`;
}

function getNurseRequestRows(activeShift?: Shift): NurseRequestRowViewModel[] {
  if (!activeShift) {
    return [];
  }

  return getShiftNurseRequests(activeShift).map((request) => ({
    bedContext: getRequestBedContext(activeShift, request),
    createdAtText: getRequestCreatedText(request),
    id: request.id,
    message: request.message,
    requestType: request.type,
    requesterName: request.requestingNurseName,
    statusLabel: getRequestStatusLabel(request),
    typeLabel: getRequestTypeLabel(request),
  }));
}

function filterFlagRows(
  flags: FlagRowViewModel[],
  selectedFilter: FlagFilter,
) {
  if (selectedFilter === "All") {
    return flags;
  }

  return flags.filter((flag) => flag.severityLabel === selectedFilter);
}

function filterNurseRequestRows(
  requests: NurseRequestRowViewModel[],
  selectedRequestFilter: RequestFilter,
) {
  if (selectedRequestFilter === "All") {
    return requests;
  }

  const requestType = selectedRequestFilter === "Issues" ? "issue" : "swap";

  return requests.filter((request) => request.requestType === requestType);
}

function getEmptyRequestMessage(selectedRequestFilter: RequestFilter) {
  if (selectedRequestFilter === "Issues") {
    return "No local issue requests yet.";
  }

  if (selectedRequestFilter === "Swaps") {
    return "No local swap requests yet.";
  }

  return "No local requests yet.";
}

function getFlagListItems(
  flags: FlagRowViewModel[],
  requests: NurseRequestRowViewModel[],
  selectedFilter: FlagFilter,
  selectedRequestFilter: RequestFilter,
): FlagListItem[] {
  if (
    !flags.length &&
    !requests.length &&
    selectedFilter === "All" &&
    selectedRequestFilter === "All"
  ) {
    return [
      {
        id: "empty-flags-and-requests",
        message: "No flags or local requests yet",
        type: "empty",
      },
    ];
  }

  return [
    {
      id: "assignment-flags-section",
      subtitle: "Generated by the local assignment rules.",
      title: "Assignment flags",
      type: "section",
    },
    ...(
      flags.length
        ? flags.map((flag) => ({ flag, type: "flag" as const }))
        : [
            {
              id: "empty-assignment-flags",
              message:
                selectedFilter === "All"
                  ? "No assignment flags."
                  : `No ${selectedFilter.toLowerCase()} flags.`,
              type: "empty" as const,
            },
          ]
    ),
    {
      id: "local-requests-section",
      subtitle: "Mock nurse requests saved on this active shift.",
      title: "Local nurse requests",
      type: "section",
    },
    ...requests.map((request) => ({ request, type: "request" as const })),
    ...(
      requests.length
        ? []
        : [
            {
              id: "empty-local-requests",
              message: getEmptyRequestMessage(selectedRequestFilter),
              type: "empty" as const,
            },
          ]
    ),
  ];
}

function getFlagItemKey(item: FlagListItem) {
  if (item.type === "flag") {
    return `flag-${item.flag.id}`;
  }

  if (item.type === "request") {
    return `request-${item.request.id}`;
  }

  return item.id;
}

function renderFlagItem({ item }: { item: FlagListItem }) {
  if (item.type === "section") {
    return <SectionHeaderRow subtitle={item.subtitle} title={item.title} />;
  }

  if (item.type === "empty") {
    return <EmptyFlagRow message={item.message} />;
  }

  if (item.type === "request") {
    return <NurseRequestRow request={item.request} />;
  }

  return <FlagRow flag={item.flag} />;
}

export default function FlagsScreen() {
  const { localState } = useLocalState();
  const [selectedFilter, setSelectedFilter] = useState<FlagFilter>("All");
  const [selectedRequestFilter, setSelectedRequestFilter] =
    useState<RequestFilter>("All");
  const flags = getFlagRows(localState.activeShift);
  const requests = getNurseRequestRows(localState.activeShift);
  const filteredFlags = filterFlagRows(flags, selectedFilter);
  const filteredRequests = filterNurseRequestRows(
    requests,
    selectedRequestFilter,
  );
  const criticalCount = flags.filter(
    (flag) => flag.severity === "critical",
  ).length;
  const warningCount = flags.filter(
    (flag) => flag.severity === "warning",
  ).length;
  const infoCount = flags.filter((flag) => flag.severity === "info").length;

  return (
    <WorkflowListScreen
      activeStep="Flags"
      data={getFlagListItems(
        filteredFlags,
        filteredRequests,
        selectedFilter,
        selectedRequestFilter,
      )}
      flow={assignmentFlow}
      headerActionLabel="Floors"
      keyExtractor={getFlagItemKey}
      listHeader={
        <FlagsListHeader
          criticalCount={criticalCount}
          infoCount={infoCount}
          requestCount={requests.length}
          onFilterPress={setSelectedFilter}
          onRequestFilterPress={setSelectedRequestFilter}
          selectedFilter={selectedFilter}
          selectedRequestFilter={selectedRequestFilter}
          warningCount={warningCount}
        />
      }
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/floor-board")}
      primaryLabel="Return to board"
      renderItem={renderFlagItem}
      subtitle=""
      title="Flags and requests"
    />
  );
}

function FlagRow({ flag }: FlagRowProps) {
  const emojiLabel = flag.severity === "critical"
    ? `🚨 ${flag.severityLabel}`
    : flag.severity === "warning"
      ? `⚠️ ${flag.severityLabel}`
      : `ℹ️ ${flag.severityLabel}`;

  return (
    <View
      style={[
        styles.flagRow,
        severityAccentStyles[flag.severity],
        severityBackgroundStyles[flag.severity],
      ]}
    >
      <View style={styles.flagTopRow}>
        <SeverityBadge label={emojiLabel} tone={flag.severity} />
        <Text style={styles.target}>{flag.target}</Text>
      </View>
      <Text style={styles.message}>{flag.message}</Text>
    </View>
  );
}

function SectionHeaderRow({ subtitle, title }: SectionHeaderRowProps) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      {subtitle ? (
        <Text style={styles.sectionHeaderSubtitle}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

function NurseRequestRow({ request }: NurseRequestRowProps) {
  return (
    <View style={styles.requestRow}>
      <View style={styles.requestTopRow}>
        <View style={styles.requestChipRow}>
          <SummaryChip label={request.typeLabel} />
          <SummaryChip label={request.statusLabel} />
          <SummaryChip label="Local only" />
        </View>
        <Text style={styles.requestTime}>{request.createdAtText}</Text>
      </View>
      <Text style={styles.requestRequester}>{request.requesterName}</Text>
      <Text style={styles.requestTarget}>{request.bedContext}</Text>
      <Text style={styles.message}>{request.message}</Text>
    </View>
  );
}

function EmptyFlagRow({ message }: EmptyFlagRowProps) {
  return (
    <View style={styles.emptyFlagRow}>
      <Text style={styles.emptyFlagTitle}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContent: {
    gap: spacing.cardGap,
  },
  sectionHeaderRow: {
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.sm,
  },
  sectionHeaderTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  sectionHeaderSubtitle: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },
  flagRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderLeftWidth: 4,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  flagTopRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  target: {
    color: colors.neutral.textPrimary,
    flexShrink: 1,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  message: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
    fontWeight: fontWeight.medium,
  },
  requestRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderLeftColor: colors.status.blue800,
    borderLeftWidth: 4,
    borderRadius: radius.md,
    borderWidth: 0.5,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  requestTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  requestChipRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  requestTime: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.xs,
    fontWeight: fontWeight.medium,
    lineHeight: 16,
    textAlign: "right",
  },
  requestRequester: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
    lineHeight: 20,
  },
  requestTarget: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },
  emptyFlagRow: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.md,
    borderWidth: 0.5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...shadows.sm,
  },
  emptyFlagTitle: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
    fontWeight: fontWeight.medium,
  },
});

const severityAccentStyles = StyleSheet.create({
  critical: {
    borderLeftColor: colors.status.red800,
  },
  info: {
    borderLeftColor: colors.status.blue800,
  },
  warning: {
    borderLeftColor: colors.status.amber800,
  },
});

const severityBackgroundStyles = StyleSheet.create({
  critical: {
    backgroundColor: colors.status.red50,
  },
  warning: {
    backgroundColor: colors.status.amber50,
  },
  info: {
    backgroundColor: colors.status.blue50,
  },
});
