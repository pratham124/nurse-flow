import { ConfirmationDialog } from "./workflow/ConfirmationDialog";

type LeaveShiftDialogProps = {
  isLeaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  visible: boolean;
};

// Shared by the nurse workspace and Home so both ask the same question.
export function LeaveShiftDialog({
  isLeaving,
  onCancel,
  onConfirm,
  visible,
}: LeaveShiftDialogProps) {
  return (
    <ConfirmationDialog
      cancelDisabled={isLeaving}
      confirmDisabled={isLeaving}
      confirmLabel={isLeaving ? "Leaving..." : "Leave shift"}
      confirmTone="danger"
      message="You will lose access to this shift and its chat. Your charge nurse will need to send you a new code if you want to rejoin."
      onCancel={onCancel}
      onConfirm={onConfirm}
      title="Leave this shift?"
      visible={visible}
    />
  );
}
