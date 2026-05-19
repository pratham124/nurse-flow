import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  PlaceholderInput,
  WorkflowSection,
  WorkflowScreen,
} from "../components/workflow";
import { colors, spacing, textSize } from "../theme/tokens";

export default function FloorDetailsScreen() {
  return (
    <WorkflowScreen
      activeStep="Floor"
      headerActionLabel="Floors"
      helperText="Static setup only. Validation and saving come in later tasks."
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={() => router.push("/rooms-and-beds")}
      primaryLabel="Continue"
      subtitle="Step 1 of 4"
      title="Floor details"
    >
      <WorkflowSection
        note="Start with the floor name charge nurses recognize on shift."
        title="Floor name"
      >
        <PlaceholderInput
          helperText="Example: 4 North, 2 East, Cardiac Stepdown"
          label="Floor name"
          placeholder="4 North"
        />
      </WorkflowSection>

      <View style={styles.callout}>
        <Text style={styles.calloutTitle}>Coming next</Text>
        <Text style={styles.calloutText}>
          The next screen will list rooms and preview generated bed labels.
        </Text>
      </View>
    </WorkflowScreen>
  );
}

const styles = StyleSheet.create({
  callout: {
    backgroundColor: colors.brand.lightBlue,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  calloutTitle: {
    color: colors.neutral.text,
    fontSize: textSize.md,
    fontWeight: "700",
  },
  calloutText: {
    color: colors.neutral.text,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
});
