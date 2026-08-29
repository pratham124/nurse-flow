import { randomUUID } from "expo-crypto";

export function createLocalId(prefix = "local"): string {
  const safePrefix = prefix.trim() || "local";

  return `${safePrefix}-${randomUUID()}`;
}
