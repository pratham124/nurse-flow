import { StyleSheet, Text, View } from "react-native";

import { colors, fontWeight, radius, spacing, textSize } from "../theme/tokens";

export function DummyDataNotice() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dummy data only</Text>
      <Text style={styles.message}>
        NurseFlow is a demo. Do not enter real patient information.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.status.amber50,
    borderRadius: radius.lg,
    gap: spacing.xs,
    padding: spacing.md2,
  },
  title: {
    color: colors.status.amber800,
    fontSize: textSize.md,
    fontWeight: fontWeight.bold,
  },
  message: {
    color: colors.status.amber800,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
});
