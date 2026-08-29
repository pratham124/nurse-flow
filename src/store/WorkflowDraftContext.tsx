import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from "react";

import { useAuthSession } from "./AuthSessionContext";
import type { FloorTemplate } from "../types/models";

type WorkflowDraftContextValue = {
  draftFloorTemplate?: FloorTemplate;
  resetWorkflowDraft: () => void;
  setDraftFloorTemplate: Dispatch<SetStateAction<FloorTemplate | undefined>>;
};

type WorkflowDraftProviderProps = PropsWithChildren;

const WorkflowDraftContext = createContext<
  WorkflowDraftContextValue | undefined
>(undefined);

export function WorkflowDraftProvider({
  children,
}: WorkflowDraftProviderProps) {
  const { authState } = useAuthSession();
  const [draftFloorTemplate, setDraftFloorTemplate] =
    useState<FloorTemplate>();

  function resetWorkflowDraft() {
    setDraftFloorTemplate(undefined);
  }

  useEffect(() => {
    if (authState.status !== "signed_in") {
      setDraftFloorTemplate(undefined);
    }
  }, [authState.status]);

  const value = useMemo(
    () => ({
      draftFloorTemplate,
      resetWorkflowDraft,
      setDraftFloorTemplate,
    }),
    [draftFloorTemplate],
  );

  return (
    <WorkflowDraftContext.Provider value={value}>
      {children}
    </WorkflowDraftContext.Provider>
  );
}

export function useWorkflowDraft() {
  const context = useContext(WorkflowDraftContext);

  if (!context) {
    throw new Error(
      "useWorkflowDraft must be used inside WorkflowDraftProvider.",
    );
  }

  return context;
}
