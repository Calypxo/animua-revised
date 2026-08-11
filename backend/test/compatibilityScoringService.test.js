const test = require("node:test");
const assert = require("node:assert/strict");

const {
  RAW_QUESTION_KEYS,
  SCORING_DIMENSIONS,
  validatePreferences,
  buildUserProfile,
  scoreMatchesLocally,
  scoreMatches,
  applyFilters,
} = require("../src/services/compatibilityScoringService");

function preferences(value = 3) {
  return Object.fromEntries(RAW_QUESTION_KEYS.map((key) => [key, value]));
}

function assessment(value = 3) {
  return Object.fromEntries(SCORING_DIMENSIONS.map(({ key }) => [key, value]));
}

function animal(id, value = 3, extra = {}) {
  return {
    id,
    name: id,
    status: "Ready for Adoption",
    species: "Dog",
    sex: "Male",
    behavioralAssessment: assessment(value),
    ...extra,
  };
}

test("accepts inclusive minimum and maximum questionnaire values", () => {
  assert.deepEqual(validatePreferences(preferences(1)).preferences, preferences(1));
  assert.deepEqual(validatePreferences(preferences(5)).preferences, preferences(5));
});

test("rejects missing, fractional, and out-of-range answers", () => {
  const missing = preferences();
  delete missing.climateTolerance;
  assert.match(validatePreferences(missing).error, /climateTolerance/);

  const fractional = preferences();
  fractional.energyLevel = 2.5;
  assert.match(validatePreferences(fractional).error, /energyLevel/);

  const outOfRange = preferences();
  outOfRange.exerciseNeeds = 6;
  assert.match(validatePreferences(outOfRange).error, /exerciseNeeds/);
});

test("an exact user-animal profile scores 100 percent", () => {
  const result = scoreMatchesLocally(preferences(4), [animal("exact", 4)], 5);
  assert.equal(result.matches[0].matchScore, 1);
  assert.equal(result.matches[0].matchPercent, 100);
});

test("a clearly poor profile scores below an exact profile", () => {
  const result = scoreMatchesLocally(
    preferences(1),
    [animal("poor", 5), animal("exact", 1)],
    5
  );
  assert.deepEqual(result.matches.map(({ id }) => id), ["exact", "poor"]);
  assert.ok(result.matches[1].matchPercent < result.matches[0].matchPercent);
});

test("multiple animals are ranked by the shared compatibility formula", () => {
  const result = scoreMatchesLocally(
    preferences(4),
    [animal("far", 1), animal("close", 3), animal("exact", 4)],
    3
  );
  assert.deepEqual(result.matches.map(({ id }) => id), ["exact", "close", "far"]);
});

test("daily attention and grooming commitment are averaged deterministically", () => {
  const input = preferences(3);
  input.attentionNeeds = 1;
  input.groomingNeeds = 5;
  input.healthRiskLevel = 4;

  const profile = buildUserProfile(input);
  assert.equal(profile.attentionNeeds, 3);
  assert.equal(profile.specialNeeds, 4);
  assert.equal(profile.climateTolerance, undefined);
});

test("Python transport failure uses the equivalent local ranking", async () => {
  const input = preferences(2);
  const animals = [animal("far", 5), animal("exact", 2), animal("close", 3)];
  const expected = scoreMatchesLocally(input, animals, 3);
  const warnings = [];
  const actual = await scoreMatches(input, animals, 3, {
    fetchImpl: async () => { throw new Error("offline"); },
    logger: { warn: (message) => warnings.push(message) },
  });

  assert.deepEqual(actual, expected);
  assert.deepEqual(actual.matches.map(({ id }) => id), ["exact", "close", "far"]);
  assert.equal(warnings.length, 1);
});

test("eligibility filters run independently before compatibility ranking", () => {
  const exactButExcluded = animal("excluded", 3, {
    species: "Cat",
    allergyFriendly: false,
    behavioralAssessment: { ...assessment(3), aggressive: 5, specialNeeds: 5 },
  });
  const eligiblePoorMatch = animal("eligible", 5, {
    allergyFriendly: true,
    behavioralAssessment: { ...assessment(5), aggressive: 1, specialNeeds: 1 },
  });
  const filters = {
    preferredSpecies: "Dog",
    preferredSex: "Any",
    needAllergyFriendly: "yes",
    acceptAggressive: "no",
    acceptSpecialNeeds: "no",
  };

  const eligible = applyFilters([exactButExcluded, eligiblePoorMatch], filters);
  assert.deepEqual(eligible.map(({ id }) => id), ["eligible"]);
  assert.equal(scoreMatchesLocally(preferences(3), eligible, 5).matches[0].id, "eligible");
});

test("a specific sex preference excludes animals with unknown sex", () => {
  const filters = {
    preferredSpecies: "Any",
    preferredSex: "Male",
    needAllergyFriendly: "no",
    acceptAggressive: "yes",
    acceptSpecialNeeds: "yes",
  };
  const eligible = applyFilters([
    animal("male", 3, { sex: "Male" }),
    animal("female", 3, { sex: "Female" }),
    animal("unknown", 3, { sex: "Unknown" }),
  ], filters);

  assert.deepEqual(eligible.map(({ id }) => id), ["male"]);
});

test("an allergy-friendly requirement accepts only explicitly verified animals", () => {
  const filters = {
    preferredSpecies: "Any",
    preferredSex: "Any",
    needAllergyFriendly: "yes",
    acceptAggressive: "yes",
    acceptSpecialNeeds: "yes",
  };
  const eligible = applyFilters([
    animal("verified", 3, { allergyFriendly: true }),
    animal("legacy-verified", 3, { flags: { allergyFriendly: true } }),
    animal("not-friendly", 3, { allergyFriendly: false }),
    animal("unknown", 3),
  ], filters);

  assert.deepEqual(eligible.map(({ id }) => id), ["verified", "legacy-verified"]);
});

test("severe aggression is always excluded and the special-needs threshold remains explicit", () => {
  const filters = {
    preferredSpecies: "Any",
    preferredSex: "Any",
    needAllergyFriendly: "no",
    acceptAggressive: "yes",
    acceptSpecialNeeds: "no",
  };
  const eligible = applyFilters([
    animal("below-thresholds", 3, {
      behavioralAssessment: { ...assessment(3), aggressive: 4, specialNeeds: 3 },
    }),
    animal("severe-aggression", 3, {
      behavioralAssessment: { ...assessment(3), aggressive: 5, specialNeeds: 3 },
    }),
    animal("significant-special-needs", 3, {
      behavioralAssessment: { ...assessment(3), aggressive: 4, specialNeeds: 4 },
    }),
  ], filters);

  assert.deepEqual(eligible.map(({ id }) => id), ["below-thresholds"]);
});
