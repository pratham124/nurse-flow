import { ReactNode, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors, radius, textSize, fontWeight, shadows } from "../../theme/tokens";

const defaultActionWidth = 96;

type SwipeRevealActionProps = {
  actionLabel: string;
  accessibilityLabel: string;
  children: ReactNode;
  onActionPress: () => void;
  actionWidth?: number;
  actionIcon?: ReactNode;
  actionSide?: "left" | "right";
};

export function SwipeRevealAction({
  actionLabel,
  accessibilityLabel,
  children,
  onActionPress,
  actionWidth = defaultActionWidth,
  actionIcon,
  actionSide = "right",
}: SwipeRevealActionProps) {
  const rowTranslateX = useRef(new Animated.Value(0)).current;
  const [isActionRevealed, setIsActionRevealed] = useState(false);
  const revealDirection = actionSide === "left" ? 1 : -1;
  const revealedTranslateX = actionWidth * revealDirection;

  function animateRow(toValue: number) {
    Animated.spring(rowTranslateX, {
      bounciness: 0,
      speed: 18,
      toValue,
      useNativeDriver: true,
    }).start(() => {
      setIsActionRevealed(toValue !== 0);
    });
  }

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      const isHorizontalSwipe =
        Math.abs(gestureState.dx) > 8 &&
        Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      const isRevealSwipe =
        actionSide === "left" ? gestureState.dx > 0 : gestureState.dx < 0;

      return isHorizontalSwipe && (isRevealSwipe || isActionRevealed);
    },
    onPanResponderMove: (_, gestureState) => {
      const startingPoint = isActionRevealed ? revealedTranslateX : 0;
      const rawTranslateX = startingPoint + gestureState.dx;
      const nextTranslateX =
        actionSide === "left"
          ? Math.max(0, Math.min(actionWidth, rawTranslateX))
          : Math.max(-actionWidth, Math.min(0, rawTranslateX));

      rowTranslateX.setValue(nextTranslateX);
    },
    onPanResponderRelease: (_, gestureState) => {
      const startingPoint = isActionRevealed ? revealedTranslateX : 0;
      const endingPoint = startingPoint + gestureState.dx;
      const shouldRevealAction =
        actionSide === "left"
          ? endingPoint > actionWidth / 2
          : endingPoint < -actionWidth / 2;

      animateRow(shouldRevealAction ? revealedTranslateX : 0);
    },
    onPanResponderTerminate: () => {
      animateRow(isActionRevealed ? revealedTranslateX : 0);
    },
  });

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.actionPane,
          actionSide === "left" ? styles.leftActionPane : styles.rightActionPane,
        ]}
      >
        <Pressable
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          disabled={!isActionRevealed}
          onPress={onActionPress}
          style={({ pressed }) => [
            styles.actionButton,
            { width: actionWidth },
            pressed ? styles.actionButtonPressed : null,
          ]}
        >
          {actionIcon ? (
            actionIcon
          ) : (
            <Text style={styles.actionButtonText}>{actionLabel}</Text>
          )}
        </Pressable>
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.content,
          {
            transform: [{ translateX: rowTranslateX }],
          },
        ]}
      >
        {children}
      </Animated.View>
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.status.red50,
  },
  leftActionPane: {
    alignItems: "flex-start",
  },
  rightActionPane: {
    alignItems: "flex-end",
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: colors.status.red700,
    height: "100%",
    justifyContent: "center",
  },
  actionButtonPressed: {
    backgroundColor: colors.status.red800,
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

