import { ReactNode, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors, radius, textSize } from "../../theme/tokens";

const defaultActionWidth = 96;

type SwipeRevealActionProps = {
  actionLabel: string;
  accessibilityLabel: string;
  children: ReactNode;
  onActionPress: () => void;
  actionWidth?: number;
};

export function SwipeRevealAction({
  actionLabel,
  accessibilityLabel,
  children,
  onActionPress,
  actionWidth = defaultActionWidth,
}: SwipeRevealActionProps) {
  const rowTranslateX = useRef(new Animated.Value(0)).current;
  const [isActionRevealed, setIsActionRevealed] = useState(false);

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

      return isHorizontalSwipe && (gestureState.dx < 0 || isActionRevealed);
    },
    onPanResponderMove: (_, gestureState) => {
      const startingPoint = isActionRevealed ? -actionWidth : 0;
      const nextTranslateX = Math.max(
        -actionWidth,
        Math.min(0, startingPoint + gestureState.dx),
      );

      rowTranslateX.setValue(nextTranslateX);
    },
    onPanResponderRelease: (_, gestureState) => {
      const startingPoint = isActionRevealed ? -actionWidth : 0;
      const endingPoint = startingPoint + gestureState.dx;
      const shouldRevealAction = endingPoint < -actionWidth / 2;

      animateRow(shouldRevealAction ? -actionWidth : 0);
    },
    onPanResponderTerminate: () => {
      animateRow(isActionRevealed ? -actionWidth : 0);
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.actionPane}>
        <Pressable
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          disabled={!isActionRevealed}
          onPress={onActionPress}
          style={[styles.actionButton, { width: actionWidth }]}
        >
          <Text style={styles.actionButtonText}>{actionLabel}</Text>
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
  },
  actionPane: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "flex-end",
    backgroundColor: colors.status.red50,
  },
  actionButton: {
    alignItems: "center",
    backgroundColor: colors.status.red700,
    height: "100%",
    justifyContent: "center",
  },
  actionButtonText: {
    color: colors.neutral.surface,
    fontSize: textSize.sm,
    fontWeight: "600",
  },
  content: {
    borderRadius: radius.xl,
  },
});
