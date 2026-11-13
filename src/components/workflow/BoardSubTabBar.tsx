import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuthSession } from "../../store/AuthSessionContext";
import { useServerWorkspace } from "../../store/ServerWorkspaceContext";
import {
  colors,
  fontWeight,
  radius,
  shadows,
  spacing,
  textSize,
} from "../../theme/tokens";
import { buildChargeChatList } from "../../utils/nurseChats";

type BoardSubTab = "board" | "nurses" | "flags" | "chats" | "invites";

type BoardSubTabBarProps = {
  activeTab: BoardSubTab;
};

type BoardSubTabItem = {
  label: string;
  route:
    "/floor-board" | "/board-nurses" | "/flags" | "/chats" | "/nurse-invites";
  tab: BoardSubTab;
};

type BoardSubTabButtonProps = {
  active: boolean;
  badgeCount: number;
  item: BoardSubTabItem;
};

const boardSubTabs: BoardSubTabItem[] = [
  { label: "Board", route: "/floor-board", tab: "board" },
  { label: "Nurses", route: "/board-nurses", tab: "nurses" },
  { label: "Flags", route: "/flags", tab: "flags" },
  { label: "Chats", route: "/chats", tab: "chats" },
  { label: "Invites", route: "/nurse-invites", tab: "invites" },
];

// Counts the chats waiting on a charge nurse reply, for the Chats tab badge.
function useNeedsReplyCount() {
  const { authState } = useAuthSession();
  const activeShift = useServerWorkspace((state) => state.activeShift);
  const currentProfileId =
    authState.status === "signed_in" ? authState.profile.id : "";

  return buildChargeChatList(
    activeShift?.nurses ?? [],
    activeShift?.nurseRequests,
    currentProfileId,
  ).filter((row) => row.needsReply).length;
}

export function BoardSubTabBar({ activeTab }: BoardSubTabBarProps) {
  const needsReplyCount = useNeedsReplyCount();

  return (
    <View style={styles.tabBar}>
      {boardSubTabs.map((item) => (
        <BoardSubTabButton
          active={item.tab === activeTab}
          badgeCount={item.tab === "chats" ? needsReplyCount : 0}
          item={item}
          key={item.tab}
        />
      ))}
    </View>
  );
}

function BoardSubTabButton({
  active,
  badgeCount,
  item,
}: BoardSubTabButtonProps) {
  return (
    <Pressable
      accessibilityLabel={
        badgeCount > 0
          ? `${item.label}, ${badgeCount} need a reply`
          : item.label
      }
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={() => router.push(item.route)}
      style={({ pressed }) => [
        styles.tabButton,
        active ? styles.activeTabButton : null,
        pressed ? styles.pressedTabButton : null,
      ]}
    >
      <View>
        <BoardSubTabIcon active={active} tab={item.tab} />
        {badgeCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {badgeCount > 9 ? "9+" : badgeCount}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.tabLabel, active ? styles.activeTabLabel : null]}>
        {item.label}
      </Text>
    </Pressable>
  );
}

type BoardSubTabIconProps = {
  active: boolean;
  tab: BoardSubTab;
};

function BoardSubTabIcon({ active, tab }: BoardSubTabIconProps) {
  const iconColor = active
    ? colors.brand.burgundy
    : colors.neutral.textSecondary;

  if (tab === "nurses") {
    return (
      <View style={styles.nursesIcon}>
        <View
          style={[
            styles.nursesHead,
            {
              backgroundColor: active ? colors.brand.burgundy10 : "transparent",
              borderColor: iconColor,
            },
          ]}
        />
        <View
          style={[
            styles.nursesBody,
            {
              backgroundColor: active ? colors.brand.burgundy10 : "transparent",
              borderColor: iconColor,
            },
          ]}
        />
      </View>
    );
  }

  if (tab === "flags") {
    return (
      <View style={styles.flagIcon}>
        <View style={[styles.flagPole, { backgroundColor: iconColor }]} />
        <View
          style={[
            styles.flagPanel,
            {
              backgroundColor: active ? colors.brand.burgundy10 : "transparent",
              borderColor: iconColor,
            },
          ]}
        />
      </View>
    );
  }

  if (tab === "chats") {
    return (
      <View style={styles.chatIcon}>
        <View
          style={[
            styles.chatBubble,
            {
              backgroundColor: active ? colors.brand.burgundy10 : "transparent",
              borderColor: iconColor,
            },
          ]}
        />
        <View style={[styles.chatTail, { backgroundColor: iconColor }]} />
      </View>
    );
  }

  if (tab === "invites") {
    return (
      <View style={styles.inviteIcon}>
        <View
          style={[
            styles.inviteLink,
            styles.inviteLinkTop,
            { borderColor: iconColor },
          ]}
        />
        <View
          style={[
            styles.inviteLink,
            styles.inviteLinkBottom,
            {
              backgroundColor: active ? colors.brand.burgundy10 : "transparent",
              borderColor: iconColor,
            },
          ]}
        />
      </View>
    );
  }

  return (
    <View style={styles.boardIcon}>
      <View
        style={[
          styles.boardHeader,
          {
            backgroundColor: active ? colors.brand.burgundy10 : "transparent",
            borderColor: iconColor,
          },
        ]}
      />
      <View style={[styles.boardLine, { backgroundColor: iconColor }]} />
      <View style={[styles.boardLine, { backgroundColor: iconColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Five tabs must fit a 375pt phone, so the bar spans the width and each tab
  // takes an equal share instead of a fixed minimum width.
  tabBar: {
    alignSelf: "stretch",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderRadius: radius.xxl,
    borderWidth: 0.5,
    flexDirection: "row",
    gap: spacing.xs,
    marginHorizontal: spacing.xl,
    padding: spacing.xs,
    ...shadows.md,
  },
  tabButton: {
    alignItems: "center",
    borderRadius: radius.xl,
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 58,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  activeTabButton: {
    backgroundColor: colors.brand.burgundy10,
  },
  pressedTabButton: {
    opacity: 0.78,
  },
  tabLabel: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.xs,
    fontWeight: fontWeight.semibold,
  },
  activeTabLabel: {
    color: colors.brand.burgundy,
    fontWeight: fontWeight.bold,
  },
  flagIcon: {
    height: 21,
    position: "relative",
    width: 20,
  },
  flagPole: {
    borderRadius: 1,
    height: 20,
    left: 3,
    position: "absolute",
    top: 0,
    width: 2,
  },
  flagPanel: {
    borderBottomRightRadius: 4,
    borderTopRightRadius: 4,
    borderWidth: 1.5,
    height: 12,
    left: 5,
    position: "absolute",
    top: 1,
    width: 13,
  },
  boardIcon: {
    gap: 2,
    height: 20,
    justifyContent: "center",
    width: 20,
  },
  boardHeader: {
    borderRadius: 4,
    borderWidth: 1.5,
    height: 8,
    width: 18,
  },
  boardLine: {
    borderRadius: 1,
    height: 2,
    width: 18,
  },
  nursesIcon: {
    alignItems: "center",
    height: 21,
    width: 20,
  },
  nursesHead: {
    borderRadius: 4.5,
    borderWidth: 1.5,
    height: 9,
    width: 9,
  },
  nursesBody: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1.5,
    height: 9,
    marginTop: 2,
    width: 18,
  },
  chatIcon: {
    height: 21,
    position: "relative",
    width: 20,
  },
  chatBubble: {
    borderRadius: 6,
    borderWidth: 1.5,
    height: 15,
    width: 20,
  },
  chatTail: {
    height: 5,
    left: 4,
    position: "absolute",
    top: 15,
    transform: [{ rotate: "45deg" }],
    width: 2,
  },
  badge: {
    alignItems: "center",
    backgroundColor: colors.status.red700,
    borderRadius: 8,
    height: 16,
    justifyContent: "center",
    minWidth: 16,
    paddingHorizontal: 4,
    position: "absolute",
    right: -10,
    top: -6,
  },
  badgeText: {
    color: colors.neutral.surface,
    fontSize: 10,
    fontWeight: fontWeight.bold,
    lineHeight: 12,
  },
  inviteIcon: {
    height: 21,
    position: "relative",
    width: 22,
  },
  inviteLink: {
    borderRadius: 6,
    borderWidth: 1.5,
    height: 10,
    position: "absolute",
    width: 15,
  },
  inviteLinkTop: {
    left: 1,
    top: 3,
    transform: [{ rotate: "-25deg" }],
  },
  inviteLinkBottom: {
    bottom: 3,
    right: 1,
    transform: [{ rotate: "-25deg" }],
  },
});
