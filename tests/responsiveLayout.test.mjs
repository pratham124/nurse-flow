import assert from "node:assert/strict";
import test from "node:test";

import {
  expandedLayoutBreakpoint,
  getResponsiveLayoutMode,
} from "../src/utils/responsiveLayout.ts";

test("keeps widths below the shared breakpoint compact", () => {
  assert.equal(getResponsiveLayoutMode(expandedLayoutBreakpoint - 1), "compact");
});

test("uses the expanded layout at and above the shared breakpoint", () => {
  assert.equal(getResponsiveLayoutMode(expandedLayoutBreakpoint), "expanded");
  assert.equal(getResponsiveLayoutMode(1024), "expanded");
});
