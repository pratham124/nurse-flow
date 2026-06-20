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
import { useServerWorkspace } from "./ServerWorkspaceContext";
import type {
  FloorTemplate,
  SimulatedSessionState,
} from "../types/models";

const chargeNurseSessionState: SimulatedSessionState = {
  role: "charge",
};

type WorkflowDraftContextValue = {
  draftFloorTemplate?: FloorTemplate;
  resetWorkflowDraft: () => void;
  setDraftFloorTemplate: Dispatch<SetStateAction<FloorTemplate | undefined>>;
  setSimulatedSessionState: Dispatch<SetStateAction<SimulatedSessionState>>;
  simulatedSessionState: SimulatedSessionState;
};

type WorkflowDraftProviderProps = PropsWithChildren;

const WorkflowDraftContext = createContext<
  WorkflowDraftContextValue | undefined
>(undefined);

export function WorkflowDraftProvider({
  children,
}: WorkflowDraftProviderProps) {
  const { authState } = useAuthSession();
  const { activeShift } = useServerWorkspace();
  const [draftFloorTemplate, setDraftFloorTemplate] =
    useState<FloorTemplate>();
  const [simulatedSessionState, setSimulatedSessionState] =
    useState<SimulatedSessionState>(chargeNurseSessionState);

  function resetWorkflowDraft() {
    setDraftFloorTemplate(undefined);
  }

  useEffect(() => {
    if (authState.status === "signed_in") {
      return;
    }

    setDraftFloorTemplate(undefined);
    setSimulatedSessionState(chargeNurseSessionState);
  }, [authState.status]);

  useEffect(() => {
    if (simulatedSessionState.role === "charge") {
      return;
    }

    if (!activeShift || !activeShift.nurses.length) {
      setSimulatedSessionState(chargeNurseSessionState);
      return;
    }

    const selectedNurseId = simulatedSessionState.selectedNurseId;

    if (
      selectedNurseId &&
      !activeShift.nurses.some((nurse) => nurse.id === selectedNurseId)
    ) {
      setSimulatedSessionState({ role: "regular_nurse" });
    }
  }, [activeShift, simulatedSessionState]);

  const value = useMemo(
    () => ({
      draftFloorTemplate,
      resetWorkflowDraft,
      setDraftFloorTemplate,
      setSimulatedSessionState,
      simulatedSessionState,
    }),
    [draftFloorTemplate, simulatedSessionState],
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
