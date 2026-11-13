import assert from "node:assert/strict";
import test from "node:test";

import {
  buildNurseRoomsView,
  keepRangesTogether,
} from "../src/utils/nurseRoomRanges.ts";

// Builds a small shift. Each room is [label, doctorSideId, bedCount].
// Each owner is a string like "n1" or a list of strings (one per bed).
// A missing owner (undefined) means the bed has no assignment.
function createShift({ rooms, owners, nurses, admittingDoctorSideId = "sask" }) {
  const shiftRooms = rooms.map(([label, doctorSideId, bedCount]) => ({
    id: `room-${label}`,
    doctorSideId,
    label,
    bedCount,
  }));
  const beds = rooms.flatMap(([label, , bedCount]) =>
    Array.from({ length: bedCount }, (_, index) => ({
      id: `bed-${label}-${index + 1}`,
      roomId: `room-${label}`,
      label: `${label}-${index + 1}`,
      bedNumber: index + 1,
    })),
  );
  const bedAssignments = Object.entries(owners).flatMap(([label, ownerList]) =>
    [].concat(ownerList).flatMap((nurseId, index) =>
      nurseId
        ? [
            {
              id: `assignment-${label}-${index + 1}`,
              bedId: `bed-${label}-${index + 1}`,
              nurseId,
            },
          ]
        : [],
    ),
  );

  return {
    id: "shift-1",
    floorTemplateId: "template-1",
    floorName: "Test floor",
    status: "assigned",
    admittingDoctorSideId,
    doctorSides: [
      { id: "sask", name: "SASK" },
      { id: "ab", name: "AB" },
    ],
    rooms: shiftRooms,
    beds,
    sideLoadLimits: {
      admitting: { min: 0, max: 10 },
      nonAdmitting: { min: 0, max: 10 },
    },
    nurses: nurses.map((id) => ({
      id,
      name: id,
      licenseType: id.startsWith("rn") ? "RN" : "LPN",
      experienceLevel: "mid",
      maxPatientLoad: 6,
    })),
    bedStates: [],
    assignmentResult: {
      id: "result-1",
      generatedTeams: [],
      roomCoverage: [],
      bedAssignments,
    },
    flags: [],
  };
}

// Finds one nurse's row anywhere in the view.
function findRow(view, nurseId) {
  const allRows = [
    ...view.sides.flatMap((side) => side.nurses),
    ...view.nursesWithoutPatients,
  ];

  return allRows.find((row) => row.id === nurseId);
}

test("joins consecutive rooms into one range", () => {
  const shift = createShift({
    rooms: [
      ["310", "sask", 1],
      ["311", "sask", 1],
      ["312", "sask", 1],
      ["313", "sask", 1],
    ],
    owners: { 310: "n1", 311: "n1", 312: "n1", 313: "n1" },
    nurses: ["n1"],
  });
  const row = findRow(buildNurseRoomsView(shift), "n1");

  assert.equal(row.rangeText, "310 – 313");
  assert.equal(row.rangeAccessibilityText, "rooms 310 to 313");
  assert.equal(row.currentLoad, 4);
  assert.equal(row.maxLoad, 6);
});

test("another nurse's room splits the range", () => {
  const shift = createShift({
    rooms: ["302", "303", "304", "305", "309"].map((label) => [label, "sask", 1]),
    owners: { 302: "n1", 303: "n1", 304: "n1", 305: "n2", 309: "n1" },
    nurses: ["n1", "n2"],
  });
  const view = buildNurseRoomsView(shift);

  assert.equal(findRow(view, "n1").rangeText, "302 – 304, 309");
  assert.deepEqual(findRow(view, "n1").ranges, ["302 – 304", "309"]);
  assert.equal(
    findRow(view, "n1").rangeAccessibilityText,
    "rooms 302 to 304, 309",
  );
  assert.equal(findRow(view, "n2").rangeText, "305");
  assert.equal(findRow(view, "n2").rangeAccessibilityText, "room 305");
});

test("an empty room in between does not break the range", () => {
  const shift = createShift({
    rooms: ["310", "311", "312"].map((label) => [label, "sask", 1]),
    // Room 311 has a bed but nobody is assigned to it.
    owners: { 310: "n1", 312: "n1" },
    nurses: ["n1"],
  });

  assert.equal(findRow(buildNurseRoomsView(shift), "n1").rangeText, "310 – 312");
});

test("split rooms at both ends are shown with bed labels", () => {
  const shift = createShift({
    rooms: ["310", "311", "312", "313", "314", "315", "316", "317"].map(
      (label) => [label, "sask", 2],
    ),
    owners: {
      310: ["n0", "n1"],
      311: "n1",
      312: "n1",
      313: ["n1", "n2"],
      314: "n2",
      315: "n2",
      316: "n2",
      317: "n2",
    },
    nurses: ["n0", "n1", "n2"],
  });
  const view = buildNurseRoomsView(shift);

  // n1 owns bed 2 of 310 through bed 1 of 313.
  assert.equal(findRow(view, "n1").rangeText, "310-2 – 313-1");
  assert.equal(
    findRow(view, "n1").rangeAccessibilityText,
    "rooms 310 bed 2 to 313 bed 1",
  );
  assert.equal(findRow(view, "n2").rangeText, "313-2 – 317");
  assert.equal(
    findRow(view, "n2").rangeAccessibilityText,
    "rooms 313 bed 2 to 317",
  );
});

test("whiteboard example: 310 – 313-1 and 313-2 – 317", () => {
  const shift = createShift({
    rooms: ["310", "311", "312", "313", "314", "315", "316", "317"].map(
      (label) => [label, "sask", 2],
    ),
    owners: {
      310: "martina",
      311: "martina",
      312: "martina",
      313: ["martina", "hannah"],
      314: "hannah",
      315: "hannah",
      316: "hannah",
      317: "hannah",
    },
    nurses: ["martina", "hannah"],
  });
  const view = buildNurseRoomsView(shift);

  assert.equal(findRow(view, "martina").rangeText, "310 – 313-1");
  assert.equal(findRow(view, "hannah").rangeText, "313-2 – 317");
  assert.equal(
    findRow(view, "martina").rangeAccessibilityText,
    "rooms 310 to 313 bed 1",
  );
});

test("whiteboard example: 310-1 – 313-1 when both end rooms are shared", () => {
  const shift = createShift({
    rooms: ["309", "310", "311", "312", "313"].map((label) => [label, "sask", 2]),
    owners: {
      309: "other",
      310: ["martina", "other"],
      311: "martina",
      312: "martina",
      313: ["martina", "hannah"],
    },
    nurses: ["martina", "hannah", "other"],
  });

  assert.equal(
    findRow(buildNurseRoomsView(shift), "martina").rangeText,
    "310-1 – 313-1",
  );
});

test("a range follows floor order across the room list, like 330 – 301-2", () => {
  const shift = createShift({
    rooms: ["329", "330", "331", "300", "301", "302"].map((label) => [
      label,
      "ab",
      2,
    ]),
    owners: {
      329: "other",
      330: "elaiza",
      331: "elaiza",
      300: "elaiza",
      301: ["elaiza", "melissa"],
      302: "melissa",
    },
    nurses: ["elaiza", "melissa", "other"],
  });
  const view = buildNurseRoomsView(shift);

  assert.equal(findRow(view, "elaiza").rangeText, "330 – 301-1");
  assert.equal(findRow(view, "melissa").rangeText, "301-2 – 302");
});

test("wrap example: 330 – 301-2 when the nurse owns bed 2 of 301", () => {
  const shift = createShift({
    rooms: ["330", "331", "300", "301"].map((label) => [label, "ab", 2]),
    owners: {
      330: "elaiza",
      331: "elaiza",
      300: "elaiza",
      301: ["other", "elaiza"],
    },
    nurses: ["elaiza", "other"],
  });

  assert.equal(findRow(buildNurseRoomsView(shift), "elaiza").rangeText, "330 – 301-2");
});

test("a split room in the middle ends the range and starts a new one", () => {
  const shift = createShift({
    rooms: ["310", "311", "312", "313"].map((label) => [label, "sask", 2]),
    owners: {
      310: "n1",
      311: ["n1", "n2"],
      312: "n1",
      313: "n1",
    },
    nurses: ["n1", "n2"],
  });
  const row = findRow(buildNurseRoomsView(shift), "n1");

  assert.equal(row.rangeText, "310 – 311-1, 312 – 313");
  assert.equal(row.rangeAccessibilityText, "rooms 310 to 311 bed 1, 312 to 313");
});

test("a nurse with several beds in one split room lists them all", () => {
  const shift = createShift({
    rooms: [["313", "sask", 4]],
    owners: { 313: ["n1", "n2", "n1", "n2"] },
    nurses: ["n1", "n2"],
  });
  const row = findRow(buildNurseRoomsView(shift), "n1");

  assert.equal(row.rangeText, "313-1,3");
  assert.equal(row.rangeAccessibilityText, "room 313 beds 1 and 3");
  assert.equal(row.currentLoad, 2);
});

test("bed numbers with two digits keep both digits", () => {
  const shift = createShift({
    rooms: [["313", "sask", 11]],
    owners: { 313: ["n2", "n2", "n2", "n2", "n2", "n2", "n2", "n2", "n2", "n2", "n1"] },
    nurses: ["n1", "n2"],
  });

  assert.equal(findRow(buildNurseRoomsView(shift), "n1").rangeText, "313-11");
});

test("a nurse with no beds has no ranges and is listed last", () => {
  const shift = createShift({
    rooms: [["310", "sask", 1]],
    owners: { 310: "n1" },
    nurses: ["idle-b", "n1", "idle-a"],
  });
  const view = buildNurseRoomsView(shift);

  assert.deepEqual(
    view.nursesWithoutPatients.map((row) => row.id),
    ["idle-b", "idle-a"],
  );
  assert.equal(view.nursesWithoutPatients[0].rangeText, "");
  assert.equal(view.nursesWithoutPatients[0].rangeAccessibilityText, "no rooms");
  assert.equal(view.nursesWithoutPatients[0].currentLoad, 0);
  assert.deepEqual(
    view.sides[0].nurses.map((row) => row.id),
    ["n1"],
  );
});

test("a nurse with no assignment result is listed under no patients", () => {
  const shift = createShift({
    rooms: [["310", "sask", 1]],
    owners: {},
    nurses: ["n1"],
  });

  delete shift.assignmentResult;

  const view = buildNurseRoomsView(shift);

  assert.deepEqual(
    view.nursesWithoutPatients.map((row) => row.id),
    ["n1"],
  );
});

test("groups nurses under the side where most of their beds are", () => {
  const shift = createShift({
    rooms: [
      ["310", "sask", 1],
      ["311", "sask", 1],
      ["330", "ab", 1],
    ],
    owners: { 310: "n1", 311: "n1", 330: "n1" },
    nurses: ["n1"],
  });
  const view = buildNurseRoomsView(shift);

  assert.equal(view.sides[0].nurses.length, 1);
  assert.equal(view.sides[1].nurses.length, 0);
  // The range still covers the bed on the other side (no room between).
  assert.equal(findRow(view, "n1").rangeText, "310 – 330");
  assert.equal(view.sides[0].admitting, true);
  assert.equal(view.sides[1].admitting, false);
});

test("a tie between sides goes to the side listed first", () => {
  const shift = createShift({
    rooms: [
      ["310", "sask", 1],
      ["330", "ab", 1],
    ],
    owners: { 310: "n1", 330: "n1" },
    nurses: ["n1"],
  });
  const view = buildNurseRoomsView(shift);

  assert.deepEqual(
    view.sides.map((side) => side.nurses.map((row) => row.id)),
    [["n1"], []],
  );
});

test("marks the admitting side from the shift", () => {
  const shift = createShift({
    rooms: [
      ["310", "sask", 1],
      ["330", "ab", 1],
    ],
    owners: { 310: "n1", 330: "n2" },
    nurses: ["n1", "n2"],
    admittingDoctorSideId: "ab",
  });
  const view = buildNurseRoomsView(shift);

  assert.deepEqual(
    view.sides.map((side) => [side.name, side.admitting]),
    [
      ["SASK", false],
      ["AB", true],
    ],
  );
});

test("orders nurses on a side by their first bed on the floor", () => {
  const shift = createShift({
    rooms: ["310", "311", "312", "313"].map((label) => [label, "sask", 1]),
    // shift.nurses lists n3 first, but n1 has the earliest bed.
    owners: { 310: "n1", 311: "n2", 312: "n3", 313: "n3" },
    nurses: ["n3", "n2", "n1"],
  });
  const view = buildNurseRoomsView(shift);

  assert.deepEqual(
    view.sides[0].nurses.map((row) => row.id),
    ["n1", "n2", "n3"],
  );
});

test("prints the whiteboard from the feature request", () => {
  // Floor order: SASK 310-321, then AB 323-325, 330, 331, 300-309 (wraps).
  const saskLabels = ["310", "311", "312", "313", "314", "315", "316", "317", "318", "319", "320", "321"];
  const abLabels = ["323", "324", "325", "330", "331", "300", "301", "302", "303", "304", "305", "306", "307", "308", "309"];
  const shift = createShift({
    rooms: [
      ...saskLabels.map((label) => [label, "sask", 2]),
      ...abLabels.map((label) => [label, "ab", 2]),
    ],
    owners: {
      310: ["martina", "martina"],
      311: ["martina", "martina"],
      312: ["martina", "martina"],
      313: ["martina", "hannah"],
      314: ["hannah", "hannah"],
      315: ["hannah", "hannah"],
      316: ["hannah", "hannah"],
      317: ["hannah", "hannah"],
      318: ["bryanna", "bryanna"],
      319: ["bryanna", "bryanna"],
      320: ["bryanna", "bryanna"],
      321: ["bryanna", "bryanna"],
      323: ["christy", "christy"],
      324: ["christy", "christy"],
      325: ["christy", "christy"],
      330: ["elaiza", "elaiza"],
      331: ["elaiza", "elaiza"],
      300: ["elaiza", "elaiza"],
      301: ["elaiza", "melissa"],
      302: ["melissa", "melissa"],
      303: ["melissa", "melissa"],
      304: ["melissa", "melissa"],
      305: ["melissa", "melissa"],
      306: ["melissa", "melissa"],
      307: ["melissa", "melissa"],
      308: ["melissa", "melissa"],
      309: ["melissa", "melissa"],
    },
    nurses: ["martina", "hannah", "bryanna", "christy", "elaiza", "melissa", "idle"],
  });
  const view = buildNurseRoomsView(shift);
  const printed = view.sides.flatMap((side) => [
    side.name,
    ...side.nurses.map((row) => `${row.name} ${row.rangeText}`),
  ]);

  assert.deepEqual(printed, [
    "SASK",
    "martina 310 – 313-1",
    "hannah 313-2 – 317",
    "bryanna 318 – 321",
    "AB",
    "christy 323 – 325",
    "elaiza 330 – 301-1",
    "melissa 301-2 – 309",
  ]);
  assert.deepEqual(
    view.nursesWithoutPatients.map((row) => row.name),
    ["idle"],
  );
});

test("keepRangesTogether only stops line breaks inside a range", () => {
  assert.equal(
    keepRangesTogether("302 \u2013 304, 309"),
    "302\u00a0\u2013\u00a0304, 309",
  );
});
