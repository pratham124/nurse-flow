import { StyleSheet, Text, View } from "react-native";

import { APP_SCREEN_NAMES } from "../constants/screenNames";
import { colors, radius, spacing, textSize } from "../theme/tokens";

export default function Index() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>NurseFlow</Text>
        <Text style={styles.subtitle}>Phase 1 setup scaffold</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Local-only scope</Text>
        <Text style={styles.bodyText}>
          No auth, backend, realtime, invites, notifications, deep links,
          drag-and-drop, offline sync, AI, breaks, sharing, or tablet layout.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Phase 1 screens</Text>
        {APP_SCREEN_NAMES.map((screenName) => (
          <Text key={screenName} style={styles.screenName}>
            {screenName}
          </Text>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Visual tokens</Text>
        <View style={styles.swatchRow}>
          <View style={[styles.swatch, { backgroundColor: colors.brand.burgundy }]} />
          <View style={[styles.swatch, { backgroundColor: colors.brand.softGreen }]} />
          <View style={[styles.swatch, { backgroundColor: colors.brand.warmGold }]} />
          <View style={[styles.swatch, { backgroundColor: colors.brand.lavender }]} />
          <View style={[styles.swatch, { backgroundColor: colors.brand.lightBlue }]} />
        </View>
        <View style={styles.swatchRow}>
          <View style={[styles.acuityDot, { backgroundColor: colors.acuity.green }]} />
          <View style={[styles.acuityDot, { backgroundColor: colors.acuity.yellow }]} />
          <View style={[styles.acuityDot, { backgroundColor: colors.acuity.red }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
    padding: spacing.xl,
    paddingTop: 72,
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  title: {
    color: colors.brand.burgundy,
    fontSize: textSize.xl,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.neutral.mutedText,
    fontSize: textSize.md,
  },
  section: {
    backgroundColor: colors.neutral.surface,
    borderColor: colors.neutral.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  sectionTitle: {
    color: colors.neutral.text,
    fontSize: textSize.lg,
    fontWeight: "700",
  },
  bodyText: {
    color: colors.neutral.mutedText,
    fontSize: textSize.md,
    lineHeight: 22,
  },
  screenName: {
    color: colors.neutral.text,
    fontSize: textSize.md,
  },
  swatchRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  swatch: {
    borderRadius: radius.sm,
    height: 32,
    width: 32,
  },
  acuityDot: {
    borderRadius: 10,
    height: 20,
    width: 20,
  },
});
