import { useEffect, useState } from "react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  PlaceholderInput,
  WorkflowSection,
  WorkflowScreen,
} from "../components/workflow";
import { createLocalId } from "../helpers/localId";
import { useLocalState } from "../store/LocalStateContext";
import { colors, radius, spacing, textSize } from "../theme/tokens";

const requiredFloorNameMessage = "Floor name is required.";
const duplicateFloorNameMessage = "A floor with this name already exists.";

export default function FloorDetailsScreen() {
  const { localState, setLocalState } = useLocalState();
  const [floorName, setFloorName] = useState(
    localState.draftFloorTemplate?.name ?? "",
  );
  const [floorNameError, setFloorNameError] = useState("");

  useEffect(() => {
    setFloorName(localState.draftFloorTemplate?.name ?? "");
    setFloorNameError("");
  }, [localState.draftFloorTemplate?.id, localState.draftFloorTemplate?.name]);

  function handleFloorNameChange(text: string) {
    setFloorName(text);

    if (floorNameError) {
      setFloorNameError("");
    }
  }

  function handleContinue() {
    const trimmedFloorName = floorName.trim();

    if (!trimmedFloorName) {
      setFloorNameError(requiredFloorNameMessage);
      return;
    }

    const hasDuplicateFloorName = localState.floorTemplates.some(
      (floorTemplate) => floorTemplate.name.trim() === trimmedFloorName,
    );

    if (hasDuplicateFloorName) {
      setFloorNameError(duplicateFloorNameMessage);
      return;
    }

    const draftId =
      localState.draftFloorTemplate?.id ?? createLocalId("floor-template");

    setLocalState((currentState) => ({
      ...currentState,
      draftFloorTemplate: {
        id: draftId,
        name: trimmedFloorName,
        doctorSides: currentState.draftFloorTemplate?.doctorSides ?? [],
        rooms: currentState.draftFloorTemplate?.rooms ?? [],
        beds: currentState.draftFloorTemplate?.beds ?? [],
      },
    }));

    router.push("/rooms-and-beds");
  }

  return (
    <WorkflowScreen
      activeStep="Floor"
      headerActionLabel="Floors"
      helperText="The floor name is saved locally for this in-progress template."
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={handleContinue}
      primaryLabel="Continue"
      subtitle="Step 1 of 4"
      title="Floor details"
    >
      <WorkflowSection
        note="Start with the floor name charge nurses recognize on shift."
        title="Floor name"
      >
        <PlaceholderInput
          errorText={floorNameError}
          helperText="Example: 4 North, 2 East, Cardiac Stepdown"
          label="Floor name"
          onChangeText={handleFloorNameChange}
          placeholder="4 North"
          value={floorName}
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
    backgroundColor: colors.neutral.backgroundSecondary,
    borderRadius: radius.xl,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  calloutTitle: {
    color: colors.neutral.textPrimary,
    fontSize: textSize.md,
    fontWeight: "500",
  },
  calloutText: {
    color: colors.neutral.textSecondary,
    fontSize: textSize.sm,
    lineHeight: 18,
  },
});
