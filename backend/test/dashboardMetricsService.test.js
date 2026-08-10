const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getCurrentAnimalProfiles,
} = require("../src/services/dashboardMetricsService");

test("current shelter population uses active animal profiles only", () => {
  const animals = [
    { id: "profiling", status: "Profiling" },
    { id: "quarantine", status: "Quarantine" },
    { id: "ready", status: "Ready" },
    { id: "adopted", status: "Adopted" },
    { id: "archived", status: "Archived" },
  ];

  assert.deepEqual(
    getCurrentAnimalProfiles(animals).map((animal) => animal.id),
    ["profiling", "quarantine", "ready"]
  );
});

test("active intake records are not part of the animal-profile population", () => {
  const animals = [{ id: "animal-1", status: "Profiling" }];
  const activeIntakes = [{ id: "intake-1", status: "Pending" }];

  assert.equal(getCurrentAnimalProfiles(animals).length, 1);
  assert.equal(activeIntakes.length, 1);
});
