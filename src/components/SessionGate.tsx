import { useEffect, type PropsWithChildren } from "react";
import { router, usePathname } from "expo-router";

import {
  SessionLoadingScreen,
  SessionRecoveryScreen,
} from "../screens/SessionGateScreens";
import { useAuthSession } from "../store/AuthSessionContext";
import type { AuthSessionState } from "../types/models";

type SessionGateProps = PropsWithChildren;

function getSignedInPath(role: "charge_nurse" | "regular_nurse") {
  return role === "regular_nurse" ? "/regular-nurse-workspace" : "/";
}

function getNextPath(
  authState: AuthSessionState,
  pathname: string,
) {
  if (authState.status === "signed_out") {
    return "/login";
  }

  if (authState.status !== "signed_in") {
    return undefined;
  }

  const signedInPath = getSignedInPath(authState.profile.role);

  if (pathname === "/login") {
    return signedInPath;
  }

  if (
    authState.profile.role === "regular_nurse" &&
    pathname !== signedInPath
  ) {
    return signedInPath;
  }

  if (
    authState.profile.role === "charge_nurse" &&
    pathname === "/regular-nurse-workspace"
  ) {
    return signedInPath;
  }

  return undefined;
}

export function SessionGate({ children }: SessionGateProps) {
  const { authState } = useAuthSession();
  const pathname = usePathname();
  const nextPath = getNextPath(authState, pathname);

  useEffect(() => {
    if (nextPath && pathname !== nextPath) {
      router.replace(nextPath);
    }
  }, [nextPath, pathname]);

  if (authState.status === "checking") {
    return <SessionLoadingScreen />;
  }

  if (authState.status === "setup_error") {
    return (
      <SessionRecoveryScreen
        message={authState.errorMessage ?? "Backend setup is missing."}
        title="Backend setup needed"
      />
    );
  }

  if (authState.status === "recovery") {
    return (
      <SessionRecoveryScreen
        message={
          authState.errorMessage ??
          "The saved account session could not be restored safely."
        }
        title="Session recovery"
      />
    );
  }

  if (nextPath && pathname !== nextPath) {
    return <SessionLoadingScreen message="Opening workspace" />;
  }

  return children;
}
