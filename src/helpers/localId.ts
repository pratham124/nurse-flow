import type { LocalId } from "../types/models";

let nextLocalIdNumber = 1;

export function createLocalId(prefix = "local"): LocalId {
  const safePrefix = prefix.trim() || "local";
  const id = `${safePrefix}-${nextLocalIdNumber}`;

  nextLocalIdNumber += 1;

  return id;
}
