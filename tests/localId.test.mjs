import assert from "node:assert/strict";
import test from "node:test";

import { formatLocalId } from "../src/helpers/localIdCore.ts";

test("formats unique values with the requested readable prefix", () => {
  const firstId = formatLocalId(
    "nurse",
    "550e8400-e29b-41d4-a716-446655440000",
  );
  const secondId = formatLocalId(
    "nurse",
    "550e8400-e29b-41d4-a716-446655440001",
  );

  assert.match(firstId, /^nurse-[0-9a-f-]{36}$/i);
  assert.match(secondId, /^nurse-[0-9a-f-]{36}$/i);
  assert.notEqual(firstId, secondId);
});

test("uses the local prefix when the provided prefix is blank", () => {
  assert.equal(
    formatLocalId("   ", "550e8400-e29b-41d4-a716-446655440000"),
    "local-550e8400-e29b-41d4-a716-446655440000",
  );
});
