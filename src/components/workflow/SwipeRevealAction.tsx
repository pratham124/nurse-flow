import { ReactNode, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

import { colors, radius, textSize, fontWeight, shadows } from "../../theme/tokens";

const defaultActionWidth = 96;

export type SwipeRevealActionProps = {
  actionLabel: string;
  accessibilityLabel: string;
  children: ReactNode;
  onActionPress: () => void;
  actionWidth?: number;
  actionIcon?: ReactNode;
  actionSide?: "left" | "right";
  actionTone?: "brand" | "danger" | "delete";
  enableAccessibilityReveal?: boolean;
};

// Uses React Native Gesture Handler instead of PanResponder because its swipe
// is a native gesture: it cooperates with the iOS ScrollView and the back
// swipe instead of fighting them for the touch. Reanimated animations follow
// the system Reduce Motion setting on their own.
export function SwipeRevealAction({
  actionLabel,
  accessibilityLabel,
  children,
  onActionPress,
  actionWidth = defaultActionWidth,
  actionIcon,
  actionSide = "right",
  actionTone = "danger",
  enableAccessibilityReveal = false,
}: SwipeRevealActionProps) {
  const swipeableRef = useRef<SwipeableMethods | null>(null);

  function handleActionPress() {
    swipeableRef.current?.close();
    onActionPress();
  }

  function renderAction() {
    return (
      <View style={styles.actionPane}>
        <Pressable
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          onPress={handleActionPress}
          style={({ pressed }) => [
            styles.actionButton,
            actionTone === "brand" ? styles.brandActionButton : null,
            actionTone === "delete" ? styles.deleteActionButton : null,
            { width: actionWidth },
            pressed
              ? actionTone === "brand"
                ? styles.brandActionButtonPressed
                : actionTone === "delete"
                  ? styles.deleteActionButtonPressed
                  : styles.actionButtonPressed
              : null,
          ]}
        >
          {actionIcon ? (
            actionIcon
          ) : (
            <Text style={styles.actionButtonText}>{actionLabel}</Text>
          )}
        </Pressable>
      </View>
    );
  }

  const isLeft = actionSide === "left";

  return (
    <View style={styles.container}>
      <ReanimatedSwipeable
        ref={swipeableRef}
        friction={1}
        leftThreshold={isLeft ? actionWidth / 2 : undefined}
        overshootLeft={false}
        overshootRight={false}
        renderLeftActions={isLeft ? renderAction : undefined}
        renderRightActions={isLeft ? undefined : renderAction}
        rightThreshold={isLeft ? undefined : actionWidth / 2}
      >
        <View
          accessibilityActions={
            enableAccessibilityReveal
              ? [{ label: `Reveal ${actionLabel}`, name: "revealAction" }]
              : undefined
          }
          accessibilityHint={
            enableAccessibilityReveal
              ? `Use the Reveal ${actionLabel} action to show the button.`
              : undefined
          }
          accessibilityLabel={
            enableAccessibilityReveal ? accessibilityLabel : undefined
          }
          accessible={enableAccessibilityReveal}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "revealAction") {
              if (isLeft) {
                swipeableRef.current?.openLeft();
              } else {
                swipeableRef.current?.openRight();
              }
            }
          }}
          style={styles.content}
        >
          {children}
        </View>
      </ReanimatedSwipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.borderTertiary,
    borderWidth: 0.5,
    ...shadows.sm,
  },
  actionPane: {
    backgroundColor: colors.status.red50,
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: colors.status.red700,
    flex: 1,
    justifyContent: "center",
  },
  actionButtonPressed: {
    backgroundColor: colors.status.red800,
  },
  brandActionButton: {
    backgroundColor: colors.brand.burgundy,
  },
  brandActionButtonPressed: {
    backgroundColor: colors.brand.burgundyLight,
  },
  deleteActionButton: {
    backgroundColor: colors.brand.burgundyLight,
  },
  deleteActionButtonPressed: {
    backgroundColor: colors.brand.burgundy,
  },
  actionButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.sm,
    fontWeight: fontWeight.bold,
  },
  content: {
    backgroundColor: colors.neutral.surface,
  },
});

