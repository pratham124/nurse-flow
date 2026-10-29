import assert from "node:assert/strict";
import test from "node:test";

import {
  patientInitialsMaxLength,
  shortenPatientInitials,
} from "../src/utils/patientInitials.ts";

test("patient initials are limited to two characters", () => {
  assert.equal(patientInitialsMaxLength, 2);
});

test("short initials are only trimmed", () => {
  assert.equal(shortenPatientInitials(" AB "), "AB");
  assert.equal(shortenPatientInitials("A"), "A");
  assert.equal(shortenPatientInitials("   "), "");
});

test("longer carry-over initials keep their first two characters", () => {
  assert.equal(shortenPatientInitials(" J.S. "), "J.");
  assert.equal(shortenPatientInitials("ABCD"), "AB");
});

test("characters are counted like the server counts them, not by UTF-16 units", () => {
  assert.equal(shortenPatientInitials("ÉÖÜ"), "ÉÖ");
  assert.equal(shortenPatientInitials("😀😃😄"), "😀😃");
});
