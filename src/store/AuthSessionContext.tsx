import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { Session } from "@supabase/supabase-js";

import { loadUserProfile } from "../services/profileRepository";
import {
  canUseNativeSecureSessionStorage,
  getSupabaseClient,
  getSupabaseConfigStatus,
} from "../services/supabaseClient";
import type { AuthSessionState } from "../types/models";

type AuthSessionContextValue = {
  authState: AuthSessionState;
  refreshSession: () => Promise<void>;
};

type AuthSessionProviderProps = PropsWithChildren;

const checkingAuthState: AuthSessionState = {
  status: "checking",
};

const AuthSessionContext = createContext<AuthSessionContextValue | undefined>(
  undefined,
);

async function getStateForSession(
  session: Session | null,
): Promise<AuthSessionState> {
  if (!session?.user) {
    return { status: "signed_out" };
  }

  const supabase = getSupabaseClient();

  if (!supabase) {
    const configStatus = getSupabaseConfigStatus();

    return {
      errorMessage:
        configStatus.status === "missing_config"
          ? configStatus.message
          : "Supabase client setup could not be completed.",
      status: "setup_error",
    };
  }

  const profile = await loadUserProfile(supabase, session.user.id);

  if (!profile) {
    return {
      errorMessage:
        "This signed-in account does not have a NurseFlow profile yet.",
      status: "recovery",
    };
  }

  return {
    profile,
    status: "signed_in",
  };
}

export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  const [authState, setAuthState] =
    useState<AuthSessionState>(checkingAuthState);
  const supabase = getSupabaseClient();

  const refreshSession = useCallback(async () => {
    const configStatus = getSupabaseConfigStatus();

    if (configStatus.status === "missing_config") {
      setAuthState({
        errorMessage: configStatus.message,
        status: "setup_error",
      });
      return;
    }

    const hasSecureStorage = await canUseNativeSecureSessionStorage();

    if (!hasSecureStorage) {
      setAuthState({
        errorMessage:
          "Secure session storage is not available on this device, so account sessions cannot be restored safely.",
        status: "recovery",
      });
      return;
    }

    const client = getSupabaseClient();

    if (!client) {
      setAuthState({
        errorMessage: "Supabase client setup could not be completed.",
        status: "setup_error",
      });
      return;
    }

    try {
      const { data, error } = await client.auth.getSession();

      if (error) {
        throw error;
      }

      setAuthState(await getStateForSession(data.session));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The saved session could not be read safely.";

      setAuthState({
        errorMessage: message,
        status: "recovery",
      });
    }
  }, []);

  useEffect(() => {
    let shouldUpdateState = true;

    async function loadSession() {
      await refreshSession();
    }

    void loadSession();

    if (!supabase) {
      return () => {
        shouldUpdateState = false;
      };
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void getStateForSession(session)
        .then((nextState) => {
          if (shouldUpdateState) {
            setAuthState(nextState);
          }
        })
        .catch((error: unknown) => {
          if (!shouldUpdateState) {
            return;
          }

          const message =
            error instanceof Error
              ? error.message
              : "The saved session could not be restored.";

          setAuthState({
            errorMessage: message,
            status: "recovery",
          });
        });
    });

    return () => {
      shouldUpdateState = false;
      data.subscription.unsubscribe();
    };
  }, [refreshSession, supabase]);

  const value = useMemo(
    () => ({
      authState,
      refreshSession,
    }),
    [authState, refreshSession],
  );

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error("useAuthSession must be used inside AuthSessionProvider.");
  }

  return context;
}
