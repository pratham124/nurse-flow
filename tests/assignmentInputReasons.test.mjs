import assert from "node:assert/strict";
import test from "node:test";

import { getInvalidInputMessage } from "../src/utils/assignmentInputReasons.ts";

const generic =
  "The server found an invalid assignment setup. Review the nurses, occupied beds, acuity, and load limits before trying again. No assignment was saved.";

test("a too-many-rooms reason names the server limit", () => {
  assert.equal(
    getInvalidInputMessage([{ code: "unsupported_room_count", limit: 40 }]),
    "This floor has more rooms than assignment supports (up to 40). Remove unused rooms from the floor and try again. No assignment was saved.",
  );
});

test("a missing limit drops the number instead of printing undefined", () => {
  assert.equal(
    getInvalidInputMessage([{ code: "unsupported_room_count" }]),
    "This floor has more rooms than assignment supports. Remove unused rooms from the floor and try again. No assignment was saved.",
  );
});

test("several recognized reasons appear in the order received", () => {
  assert.equal(
    getInvalidInputMessage([
      { code: "missing_acuity" },
      { code: "unsupported_nurse_count", limit: 12 },
    ]),
    "Every occupied bed needs an acuity. Set acuity for each patient and try again. There are more nurses on this shift than assignment supports (up to 12). No assignment was saved.",
  );
});

test("unknown or absent reasons fall back to the generic text", () => {
  assert.equal(getInvalidInputMessage(undefined), generic);
  assert.equal(getInvalidInputMessage([]), generic);
  assert.equal(getInvalidInputMessage([{ code: "something_new" }]), generic);
});

test("unknown reasons are skipped when a known one is present", () => {
  assert.equal(
    getInvalidInputMessage([
      { code: "something_new" },
      { code: "unsupported_side_count" },
    ]),
    "Assignment needs exactly two doctor sides on this floor. No assignment was saved.",
  );
});
