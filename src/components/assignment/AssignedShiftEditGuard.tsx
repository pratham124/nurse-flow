import { useState } from "react";
import { router } from "expo-router";

import type { Shift } from "../../types/models";
import { useServerWorkspace } from "../../store/ServerWorkspaceContext";
import { ConfirmationDialog } from "../workflow/ConfirmationDialog";

type AssignedShiftEditGuardProps = {
  activeShift?: Shift;
};

export function AssignedShiftEditGuard({
  activeShift,
}: AssignedShiftEditGuardProps) {
  const { resetActiveShiftForEditing } = useServerWorkspace();
  const [errorMessage, setErrorMessage] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const assignmentResultId = activeShift?.assignmentResult?.id;

  async function handleConfirm() {
    if (!assignmentResultId || isResetting) {
      return;
    }

    setErrorMessage("");
    setIsResetting(true);

    try {
      await resetActiveShiftForEditing(assignmentResultId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The shift could not be opened for editing.",
      );
    } finally {
      setIsResetting(false);
    }
  }

  function handleCancel() {
    if (isResetting) {
      return;
    }

    router.replace("/floor-board");
  }

  return (
    <ConfirmationDialog
      cancelDisabled={isResetting}
      confirmDisabled={isResetting}
      confirmLabel={isResetting ? "Preparing edit..." : "Edit active shift"}
      confirmTone="danger"
      message={`Editing clears the current assignment, so you will need to run assignment again. Joined nurses will be disconnected and active join codes will expire.${
        errorMessage ? `\n\n${errorMessage}` : ""
      }`}
      onCancel={handleCancel}
      onConfirm={() => void handleConfirm()}
      title="Edit active shift?"
      visible={Boolean(assignmentResultId)}
    />
  );
}
