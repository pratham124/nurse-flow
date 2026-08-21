import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const fixtureUrl = new URL("./fixtures/phase9OptimizerFixtures.json", import.meta.url);
const fixtureCatalog = JSON.parse(await readFile(fixtureUrl, "utf8"));

const acuityWeights = { green: 1, yellow: 2, red: 3 };
const redOwnerRanks = { experienced: 0, mid: 1, new_grad: 2 };
const requiredFixtureIds = [
  "empty-census",
  "one-nurse",
  "rn-lpn-mix",
  "red-bed-eligibility",
  "exact-capacity",
  "understaffed",
  "split-room",
  "both-doctor-sides",
  "active-side-guidance",
  "stable-ties",
  "greedy-room-capacity-failure",
];

function getGap(values) {
  return values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);
}

function getTeamCount(nurseCount) {
  return nurseCount === 1 ? 1 : Math.max(2, Math.ceil(nurseCount / 4));
}

function validateDecisions(fixture, decisions) {
  const { input } = fixture;
  const nurseById = new Map(input.nurses.map((nurse) => [nurse.id, nurse]));
  const roomById = new Map(input.rooms.map((room) => [room.id, room]));
  const bedById = new Map(input.occupiedBeds.map((bed) => [bed.id, bed]));
  const teamByNurseId = new Map();
  const teamLabels = Object.keys(decisions.teams);

  assert.equal(teamLabels.length, getTeamCount(input.nurses.length));
  assert.deepEqual(
    teamLabels,
    Array.from({ length: teamLabels.length }, (_, index) =>
      `Team ${String.fromCharCode(65 + index)}`,
    ),
  );

  for (const [teamLabel, nurseIds] of Object.entries(decisions.teams)) {
    for (const nurseId of nurseIds) {
      assert.ok(nurseById.has(nurseId), `${fixture.id}: unknown nurse ${nurseId}`);
      assert.ok(!teamByNurseId.has(nurseId), `${fixture.id}: duplicate nurse ${nurseId}`);
      teamByNurseId.set(nurseId, teamLabel);
    }
  }

  assert.equal(teamByNurseId.size, input.nurses.length);
  const teamSizes = Object.values(decisions.teams).map((nurseIds) => nurseIds.length);
  assert.ok(getGap(teamSizes) <= 1, `${fixture.id}: team sizes differ by more than one`);

  assert.deepEqual(Object.keys(decisions.roomTeams), input.rooms.map((room) => room.id));
  assert.deepEqual(
    Object.keys(decisions.bedOwners),
    input.occupiedBeds.map((bed) => bed.id),
  );

  const patientCountByNurseId = new Map(input.nurses.map((nurse) => [nurse.id, 0]));
  const acuityLoadByNurseId = new Map(input.nurses.map((nurse) => [nurse.id, 0]));

  for (const room of input.rooms) {
    const roomBeds = input.occupiedBeds.filter((bed) => bed.roomId === room.id);
    const roomTeamLabel = decisions.roomTeams[room.id];

    if (roomBeds.length === 0) {
      assert.equal(roomTeamLabel, null, `${fixture.id}: empty room ${room.id} has a team`);
    } else {
      assert.ok(teamLabels.includes(roomTeamLabel), `${fixture.id}: occupied room ${room.id} has no team`);
    }
  }

  let unassignedCount = 0;
  let redBedOwnerRankSum = 0;

  for (const [bedId, nurseId] of Object.entries(decisions.bedOwners)) {
    const bed = bedById.get(bedId);
    assert.ok(bed, `${fixture.id}: unknown bed ${bedId}`);

    if (nurseId === null) {
      unassignedCount += 1;
      if (bed.acuity === "red") redBedOwnerRankSum += 3;
      continue;
    }

    const nurse = nurseById.get(nurseId);
    assert.ok(nurse, `${fixture.id}: unknown owner ${nurseId}`);
    assert.equal(
      teamByNurseId.get(nurseId),
      decisions.roomTeams[bed.roomId],
      `${fixture.id}: ${nurseId} does not cover ${bed.roomId}`,
    );
    assert.ok(
      (patientCountByNurseId.get(nurseId) ?? 0) < nurse.maxPatientLoad,
      `${fixture.id}: ${nurseId} exceeds max load`,
    );

    patientCountByNurseId.set(nurseId, (patientCountByNurseId.get(nurseId) ?? 0) + 1);
    acuityLoadByNurseId.set(
      nurseId,
      (acuityLoadByNurseId.get(nurseId) ?? 0) + acuityWeights[bed.acuity],
    );

    if (bed.acuity === "red") {
      assert.equal(nurse.licenseType, "RN", `${fixture.id}: red bed owned by an LPN`);
      redBedOwnerRankSum += redOwnerRanks[nurse.experienceLevel];
    }
  }

  const guidanceExcesses = input.nurses.map((nurse) => {
    const nurseTeam = teamByNurseId.get(nurse.id);
    const coversAdmittingSide = input.rooms.some(
      (room) =>
        room.doctorSideId === input.admittingDoctorSideId &&
        decisions.roomTeams[room.id] === nurseTeam,
    );
    const maximum = coversAdmittingSide
      ? input.sideLoadLimits.admitting.max
      : input.sideLoadLimits.nonAdmitting.max;
    return Math.max(0, (patientCountByNurseId.get(nurse.id) ?? 0) - maximum);
  });

  const teamAcuityLoads = teamLabels.map((teamLabel) =>
    decisions.teams[teamLabel].reduce(
      (total, nurseId) => total + (acuityLoadByNurseId.get(nurseId) ?? 0),
      0,
    ),
  );
  const teamPatientCounts = teamLabels.map((teamLabel) =>
    decisions.teams[teamLabel].reduce(
      (total, nurseId) => total + (patientCountByNurseId.get(nurseId) ?? 0),
      0,
    ),
  );
  const teamRnCounts = teamLabels.map(
    (teamLabel) =>
      decisions.teams[teamLabel].filter(
        (nurseId) => nurseById.get(nurseId).licenseType === "RN",
      ).length,
  );
  const experienceDistributionGap = ["experienced", "mid", "new_grad"].reduce(
    (total, experienceLevel) =>
      total +
      getGap(
        teamLabels.map(
          (teamLabel) =>
            decisions.teams[teamLabel].filter(
              (nurseId) => nurseById.get(nurseId).experienceLevel === experienceLevel,
            ).length,
        ),
      ),
    0,
  );
  const teamCapacities = teamLabels.map((teamLabel) =>
    decisions.teams[teamLabel].reduce(
      (total, nurseId) => total + nurseById.get(nurseId).maxPatientLoad,
      0,
    ),
  );

  return {
    unassignedCount,
    maxNurseAcuityLoad: Math.max(0, ...acuityLoadByNurseId.values()),
    maxNursePatientCount: Math.max(0, ...patientCountByNurseId.values()),
    redBedOwnerRankSum,
    sideGuidanceTotalExcess: guidanceExcesses.reduce((total, excess) => total + excess, 0),
    sideGuidanceNurseCount: guidanceExcesses.filter((excess) => excess > 0).length,
    teamWeightedAcuityGap: getGap(teamAcuityLoads),
    teamPatientCountGap: getGap(teamPatientCounts),
    teamRnCountGap: getGap(teamRnCounts),
    teamExperienceDistributionGap: experienceDistributionGap,
    teamCapacityGap: getGap(teamCapacities),
  };
}

test("catalog contains every Phase 9 Task 1.1 scenario exactly once", () => {
  assert.equal(fixtureCatalog.schemaVersion, 1);
  assert.deepEqual(
    fixtureCatalog.fixtures.map((fixture) => fixture.id),
    requiredFixtureIds,
  );
  assert.equal(new Set(requiredFixtureIds).size, requiredFixtureIds.length);
});

for (const fixture of fixtureCatalog.fixtures) {
  test(`${fixture.id} expected decisions match the stated objectives`, () => {
    assert.equal(fixture.input.doctorSides.length, 2);
    assert.ok(fixture.input.doctorSides.includes(fixture.input.admittingDoctorSideId));
    assert.equal(new Set(fixture.input.doctorSides).size, fixture.input.doctorSides.length);
    for (const range of Object.values(fixture.input.sideLoadLimits)) {
      assert.ok(Number.isInteger(range.min) && range.min >= 1);
      assert.ok(Number.isInteger(range.max) && range.max >= range.min);
    }
    assert.equal(new Set(fixture.input.rooms.map((room) => room.id)).size, fixture.input.rooms.length);
    assert.equal(new Set(fixture.input.occupiedBeds.map((bed) => bed.id)).size, fixture.input.occupiedBeds.length);
    assert.equal(new Set(fixture.input.nurses.map((nurse) => nurse.id)).size, fixture.input.nurses.length);

    for (const room of fixture.input.rooms) {
      assert.ok(fixture.input.doctorSides.includes(room.doctorSideId));
    }
    for (const bed of fixture.input.occupiedBeds) {
      assert.ok(fixture.input.rooms.some((room) => room.id === bed.roomId));
      assert.ok(Object.hasOwn(acuityWeights, bed.acuity));
    }

    assert.deepEqual(
      validateDecisions(fixture, fixture.expected.decisions),
      fixture.expected.objectives,
    );

    for (const alternative of fixture.expected.allowedEquivalentChoices) {
      assert.ok(alternative.reason.trim().length > 0);
      assert.deepEqual(
        validateDecisions(fixture, alternative.decisions),
        fixture.expected.objectives,
      );
    }
  });
}

test("greedy-failure fixture has a complete valid assignment", () => {
  const fixture = fixtureCatalog.fixtures.find(
    ({ id }) => id === "greedy-room-capacity-failure",
  );

  assert.equal(fixture.expected.objectives.unassignedCount, 0);
  assert.ok(Object.values(fixture.expected.decisions.bedOwners).every(Boolean));
});

test("every expected red-bed owner is an RN", () => {
  for (const fixture of fixtureCatalog.fixtures) {
    const nurseById = new Map(fixture.input.nurses.map((nurse) => [nurse.id, nurse]));

    for (const bed of fixture.input.occupiedBeds.filter(({ acuity }) => acuity === "red")) {
      const ownerId = fixture.expected.decisions.bedOwners[bed.id];
      if (ownerId !== null) assert.equal(nurseById.get(ownerId).licenseType, "RN");
    }
  }
});
