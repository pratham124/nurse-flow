import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, fontWeight, radius, shadows, spacing, textSize } from "../../theme/tokens";

type BoardSubTab = "board" | "flags" | "invites";

type BoardSubTabBarProps = {
  activeTab: BoardSubTab;
};

type BoardSubTabItem = {
  label: string;
  route: "/floor-board" | "/flags" | "/nurse-invites";
  tab: BoardSubTab;
};

type BoardSubTabButtonProps = {
  active: boolean;
  item: BoardSubTabItem;
};

const boardSubTabs: BoardSubTabItem[] = [
  { label: "Board", route: "/floor-board", tab: "board" },
  { label: "Flags", route: "/flags", tab: "flags" },
  { label: "Invites", route: "/nurse-invites", tab: "invites" },
];

export function BoardSubTabBar({ activeTab }: BoardSubTabBarProps) {
  return (
    <View style={styles.tabBar}>
      {boardSubTabs.map((item) => (
        <BoardSubTabButton
          active={item.tab === activeTab}
          item={item}
          key={item.tab}
        />
      ))}
    </View>
  );
}

function BoardSubTabButton({ active, item }: BoardSubTabButtonProps) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={() => router.push(item.route)}
      style={({ pressed }) => [
        styles.tabButton,
        active ? styles.activeTabButton : null,
        pressed ? styles.pressedTabButton : null,
      ]}
    >
      <BoardSubTabIcon active={active} tab={item.tab} />
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

  if (tab === "flags") {
    return (
      <View style={styles.flagIcon}>
        <View style={[styles.flagPole, { backgroundColor: iconColor }]} />
        <View
          style={[
            styles.flagPanel,
            { backgroundColor: active ? colors.brand.burgundy10 : "transparent", borderColor: iconColor },
          ]}
        />
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
          { backgroundColor: active ? colors.brand.burgundy10 : "transparent", borderColor: iconColor },
        ]}
      />
      <View style={[styles.boardLine, { backgroundColor: iconColor }]} />
      <View style={[styles.boardLine, { backgroundColor: iconColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    alignSelf: "center",
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
    minWidth: 72,
    paddingHorizontal: spacing.sm,
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
    fontSize: textSize.sm,
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
