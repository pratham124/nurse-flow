import { randomUUID } from "expo-crypto";

import { formatLocalId } from "./localIdCore";

export function createLocalId(prefix = "local"): string {
  return formatLocalId(prefix, randomUUID());
}
