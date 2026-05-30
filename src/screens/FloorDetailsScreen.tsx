import { useEffect, useState } from "react";
import { router } from "expo-router";

import {
  PlaceholderInput,
  WorkflowSection,
  WorkflowScreen,
} from "../components/workflow";
import { createLocalId } from "../helpers/localId";
import { useLocalState } from "../store/LocalStateContext";

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
      onHeaderActionPress={() => router.push("/")}
      onPrimaryPress={handleContinue}
      primaryLabel="Continue"
      subtitle="Step 1 of 4"
      title="Floor details"
    >
      <WorkflowSection title="Floor name">
        <PlaceholderInput
          errorText={floorNameError}
          label="Floor name"
          onChangeText={handleFloorNameChange}
          placeholder="4 North"
          value={floorName}
        />
      </WorkflowSection>
    </WorkflowScreen>
  );
}
