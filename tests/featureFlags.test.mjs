import assert from "node:assert/strict";
import test from "node:test";

import {
  isNotificationsEnabled,
  notificationsEnabled,
} from "../src/config/featureFlags.ts";

test("notifications are off unless the value is exactly true", () => {
  assert.equal(isNotificationsEnabled(undefined), false);
  for (const value of ["", "false", "TRUE", "1", " true", "yes"]) {
    assert.equal(isNotificationsEnabled(value), false);
  }
  assert.equal(isNotificationsEnabled("true"), true);
});

test("the default build has notifications disabled", () => {
  assert.equal(notificationsEnabled, false);
});
