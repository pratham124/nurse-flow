import { useEffect, useState } from "react";

import type { Shift } from "../types/models";

export function useActiveShiftDraft(activeShift?: Shift) {
  const [draftShift, setDraftShift] = useState<Shift | undefined>(activeShift);

  useEffect(() => {
    setDraftShift(activeShift);
  }, [activeShift]);

  return {
    draftShift,
    setDraftShift,
  };
}
