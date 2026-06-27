import { useEffect, type PropsWithChildren } from "react";
import { router, useLocalSearchParams, usePathname } from "expo-router";

import {
  SessionLoadingScreen,
  SessionRecoveryScreen,
} from "../screens/SessionGateScreens";
import { useAuthSession } from "../store/AuthSessionContext";
import type { AuthSessionState } from "../types/models";

type SessionGateProps = PropsWithChildren;
type RedirectTarget =
  | "/"
  | "/login"
  | {
      params: {
        code?: string;
        returnTo: string;
      };
      pathname: "/login";
    };

function isAuthRoute(pathname: string) {
  return pathname === "/login" || pathname === "/signup";
}

function isJoinRoute(pathname: string) {
  return pathname === "/join-active-session";
}

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getNextPath(
  authState: AuthSessionState,
  pathname: string,
  code?: string,
): RedirectTarget | undefined {
  if (authState.status === "signed_out") {
    if (isAuthRoute(pathname)) {
      return undefined;
    }

    if (isJoinRoute(pathname)) {
      return {
        pathname: "/login",
        params: {
          code,
          returnTo: pathname,
        },
      };
    }

    return "/login";
  }

  if (authState.status !== "signed_in") {
    return undefined;
  }

  if (isAuthRoute(pathname)) {
    return "/";
  }

  return undefined;
}

export function SessionGate({ children }: SessionGateProps) {
  const { authState } = useAuthSession();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const code = getSingleParam(params.code);
  const nextPath = getNextPath(authState, pathname, code);
  const nextPathname =
    typeof nextPath === "string" ? nextPath : nextPath?.pathname;

  useEffect(() => {
    if (nextPath && pathname !== nextPathname) {
      router.replace(nextPath);
    }
  }, [nextPath, nextPathname, pathname]);

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

  if (nextPath && pathname !== nextPathname) {
    return <SessionLoadingScreen message="Opening workspace" />;
  }

  return children;
}
