const RAW_QUESTION_KEYS = [
  "energyLevel",
  "exerciseNeeds",
  "independenceLevel",
  "attentionNeeds",
  "playfulness",
  "adaptability",
  "friendlinessToHumans",
  "goodWithKids",
  "goodWithOtherPets",
  "strangerTolerance",
  "noiseLevel",
  "spaceNeeds",
  "climateTolerance",
  "groomingNeeds",
  "trainingDifficulty",
  "healthRiskLevel",
  "affectionLevel",
  "separationAnxiety",
];

// These are the scored animal traits recorded by the behavioral assessment.
// Multiple questionnaire answers are averaged only when they measure a
// defensible shared care dimension. Answers stay on the original 1-5 scale.
const SCORING_DIMENSIONS = [
  { key: "energyLevel", sources: ["energyLevel"] },
  { key: "exerciseNeeds", sources: ["exerciseNeeds"] },
  { key: "independenceLevel", sources: ["independenceLevel"] },
  { key: "attentionNeeds", sources: ["attentionNeeds", "groomingNeeds"] },
  { key: "playfulness", sources: ["playfulness"] },
  { key: "adaptability", sources: ["adaptability"] },
  { key: "friendlinessToHumans", sources: ["friendlinessToHumans"] },
  { key: "goodWithKids", sources: ["goodWithKids"] },
  { key: "goodWithOtherPets", sources: ["goodWithOtherPets"] },
  { key: "strangerTolerance", sources: ["strangerTolerance"] },
  { key: "noiseLevel", sources: ["noiseLevel"] },
  { key: "spaceNeeds", sources: ["spaceNeeds"] },
  { key: "trainingDifficulty", sources: ["trainingDifficulty"] },
  { key: "affectionLevel", sources: ["affectionLevel"] },
  { key: "separationAnxiety", sources: ["separationAnxiety"] },
  { key: "specialNeeds", sources: ["healthRiskLevel"] },
];

const INFORMATIONAL_QUESTIONS = {
  climateTolerance:
    "The animal assessment does not record heat or climate suitability, so using this answer for ranking would fabricate animal data.",
};

function validatePreferences(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "All compatibility preferences are required." };
  }

  const preferences = {};
  for (const key of RAW_QUESTION_KEYS) {
    const value = Number(input[key]);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      return { error: `${key} must be a whole number from 1 to 5.` };
    }
    preferences[key] = value;
  }

  return { preferences };
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildUserProfile(preferences) {
  return Object.fromEntries(
    SCORING_DIMENSIONS.map(({ key, sources }) => [
      key,
      average(sources.map((source) => Number(preferences[source]))),
    ])
  );
}

function buildVector(data) {
  return SCORING_DIMENSIONS.map(({ key }) => {
    const value = Number(data[key]);
    return Number.isFinite(value) ? value : 3;
  });
}

function scoreVectors(user, pet) {
  const magnitude = (values) =>
    Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  const denominator = magnitude(user) * magnitude(pet);
  const cosine = denominator
    ? user.reduce((sum, value, index) => sum + value * pet[index], 0) /
      denominator
    : 0;
  const difference = user.reduce(
    (sum, value, index) => sum + Math.abs(value - pet[index]),
    0
  );
  const finalScore = cosine * (1 - difference / (user.length * 4));

  return {
    matchScore: Math.round(finalScore * 10000) / 10000,
    matchPercent: Math.round(finalScore * 10000) / 100,
  };
}

function scoreMatchesLocally(preferences, animals, topK = 5) {
  const userProfile = buildUserProfile(preferences);
  const userVector = buildVector(userProfile);
  const matches = animals
    .map((animal) => {
      const assessment = animal.behavioralAssessment || {};
      const score = scoreVectors(userVector, buildVector(assessment));
      return {
        id: animal.id,
        petId: animal.petId,
        name: animal.name,
        species: animal.species,
        breed: animal.breed,
        sex: animal.sex,
        size: animal.size,
        status: animal.status,
        photoURL: animal.photoURL,
        photoUrl: animal.photoUrl || animal.photoURL,
        ageEstimate: animal.ageEstimate,
        age: animal.age || animal.ageEstimate,
        allergyFriendly: animal.allergyFriendly,
        specialNeeds: assessment.specialNeeds ?? animal.specialNeeds,
        aggressive: assessment.aggressive ?? animal.aggressive,
        ...assessment,
        ...score,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, topK);

  return { matches };
}

async function scoreMatches(
  preferences,
  animals,
  topK = 5,
  {
    fetchImpl = global.fetch,
    matcherUrl = process.env.PYTHON_MATCHER_URL ||
      "https://animua-matcher-3wy62l2fta-as.a.run.app/score",
    logger = console,
  } = {}
) {
  try {
    const response = await fetchImpl(matcherUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences, animals, top_k: topK }),
    });
    if (!response.ok) throw new Error(`Matcher returned ${response.status}`);
    const rawResult = await response.json();
    const result = typeof rawResult === "string" ? JSON.parse(rawResult) : rawResult;
    if (!result || !Array.isArray(result.matches)) {
      throw new Error("Matcher returned an invalid response payload");
    }
    logger.info("[matchPets] Python matcher used successfully.");
    return result;
  } catch (error) {
    logger.warn(
      `[matchPets] Python matcher unavailable. Using fallback. Reason: ${error.message}`
    );
    return scoreMatchesLocally(preferences, animals, topK);
  }
}

function applyFilters(animals, filters) {
  return animals.filter((animal) => {
    if (!["Ready", "Ready for Adoption"].includes(animal.status)) return false;
    if (
      filters.preferredSpecies !== "Any" &&
      String(animal.species || "").toLowerCase() !==
        filters.preferredSpecies.toLowerCase()
    ) return false;
    if (
      filters.preferredSex !== "Any" &&
      String(animal.sex || "").toLowerCase() !== filters.preferredSex.toLowerCase()
    ) return false;
    if (
      filters.needAllergyFriendly === "yes" &&
      (animal.allergyFriendly ?? animal.flags?.allergyFriendly) !== true
    ) return false;
    if (Number(animal.behavioralAssessment?.aggressive ?? animal.aggressive ?? 0) >= 5) {
      return false;
    }
    return !(
      filters.acceptSpecialNeeds === "no" &&
      Number(
        animal.behavioralAssessment?.specialNeeds ?? animal.specialNeeds ?? 0
      ) >= 4
    );
  });
}

module.exports = {
  RAW_QUESTION_KEYS,
  SCORING_DIMENSIONS,
  INFORMATIONAL_QUESTIONS,
  validatePreferences,
  buildUserProfile,
  buildVector,
  scoreVectors,
  scoreMatchesLocally,
  scoreMatches,
  applyFilters,
};
