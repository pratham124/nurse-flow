import { useEffect, useState } from "react";
import { router } from "expo-router";

import {
  PlaceholderInput,
  WorkflowSection,
  WorkflowScreen,
} from "../components/workflow";
import { createLocalId } from "../helpers/localId";
import { useServerWorkspace } from "../store/ServerWorkspaceContext";
import { useWorkflowDraft } from "../store/WorkflowDraftContext";
import type { FloorTemplate, LocalId } from "../types/models";

const requiredFloorNameMessage = "Floor name is required.";
const duplicateFloorNameMessage = "A floor with this name already exists.";

function hasSavedFloorTemplateWithName(
  floorTemplates: FloorTemplate[],
  trimmedFloorName: string,
  currentDraftId?: LocalId,
) {
  return floorTemplates.some(
    (floorTemplate) =>
      floorTemplate.id !== currentDraftId &&
      floorTemplate.name.trim() === trimmedFloorName,
  );
}

export default function FloorDetailsScreen() {
  const { floorTemplates } = useServerWorkspace();
  const { draftFloorTemplate, setDraftFloorTemplate } = useWorkflowDraft();
  const [floorName, setFloorName] = useState(
    draftFloorTemplate?.name ?? "",
  );
  const [floorNameError, setFloorNameError] = useState("");

  useEffect(() => {
    setFloorName(draftFloorTemplate?.name ?? "");
    setFloorNameError("");
  }, [draftFloorTemplate?.id, draftFloorTemplate?.name]);

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

    const currentDraftId = draftFloorTemplate?.id;
    const hasDuplicateFloorName = hasSavedFloorTemplateWithName(
      floorTemplates,
      trimmedFloorName,
      currentDraftId,
    );

    if (hasDuplicateFloorName) {
      setFloorNameError(duplicateFloorNameMessage);
      return;
    }

    const draftId = currentDraftId ?? createLocalId("floor-template");

    setDraftFloorTemplate((currentDraft) => ({
        id: draftId,
        name: trimmedFloorName,
        doctorSides: currentDraft?.doctorSides ?? [],
        rooms: currentDraft?.rooms ?? [],
        beds: currentDraft?.beds ?? [],
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
