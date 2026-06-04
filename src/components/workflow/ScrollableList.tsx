import { ReactNode } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { spacing } from "../../theme/tokens";

type ScrollableListProps = {
  children: ReactNode;
  maxHeight?: number;
};

export function ScrollableList({
  children,
  maxHeight = 320,
}: ScrollableListProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      style={[styles.container, { maxHeight }]}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  content: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
});
