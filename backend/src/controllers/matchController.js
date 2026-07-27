const PYTHON_MATCHER_URL =
  process.env.PYTHON_MATCHER_URL || "http://127.0.0.1:8001/score";
const {
  buildShelterLabel,
} = require("../utils/animalIdentity");

const SCORE_KEYS = [
  "energyLevel",
  "exerciseNeeds",
  "independenceLevel",
  "attentionNeeds",
  "playfulness",
  "friendlinessToHumans",
  "goodWithKids",
  "goodWithOtherPets",
  "strangerTolerance",
  "noiseLevel",
];

exports.matchPets = async (req, res) => {
  try {
    const { db } = require("../config/firebase");
    const { preferences, filters = {} } = req.body;

    if (!preferences || typeof preferences !== "object") {
      return res.status(400).json({ message: "Preferences are required." });
    }

    const snapshot = await db.collection("animals").get();

    let animals = snapshot.docs.map((doc) => {
      const data = doc.data();
      const displayLabel = buildShelterLabel(data, doc.id);

      return {
        id: doc.id,
        ...data,
        name: displayLabel,
        displayLabel,
        shelterLabel: displayLabel,
        photoUrl: data.photoURL || data.photoUrl || "",
        age: data.ageEstimate || data.age || "",
      };
    });

    animals = applyFilters(animals, filters);

    if (!animals.length) {
      return res.status(200).json({ matches: [] });
    }

    const result = await scoreMatches(preferences, animals, 5);

    return res.status(200).json(result);
  } catch (error) {
    console.error("[matchPets]", error);
    return res.status(500).json({
      message: "Failed to match pets.",
      error: error.message,
    });
  }
};

async function scoreMatches(preferences, animals, topK) {
  try {
    const pythonResponse = await fetch(PYTHON_MATCHER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        preferences,
        animals,
        top_k: topK,
      }),
    });

    if (!pythonResponse.ok) {
      const text = await pythonResponse.text();
      throw new Error(`Python matcher failed: ${text}`);
    }

    return await pythonResponse.json();
  } catch (error) {
    console.warn(
      `[matchPets] Python matcher unavailable at ${PYTHON_MATCHER_URL}. ` +
        `Using built-in matcher fallback. Reason: ${error.message}`
    );

    return scoreMatchesLocally(preferences, animals, topK);
  }
}

function scoreMatchesLocally(preferences, animals, topK) {
  const userVector = buildVector(preferences, SCORE_KEYS);

  const matches = animals
    .map((animal) => {
      const assessment = animal.behavioralAssessment || {};
      const petVector = buildVector(assessment, SCORE_KEYS);
      const score = scorePet(userVector, petVector);

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

function buildVector(data, keys) {
  return keys.map((key) => safeNum(data[key], 3));
}

function safeNum(value, defaultValue) {
  const number = Number(value);
  return Number.isFinite(number) ? number : defaultValue;
}

function scorePet(userVector, petVector) {
  const cosine = cosineSimilarity(userVector, petVector);
  const diff = userVector.reduce(
    (sum, value, index) => sum + Math.abs(value - petVector[index]),
    0
  );
  const maxDiff = userVector.length * 4;
  const penalty = diff / maxDiff;
  const finalScore = cosine * (1 - penalty);

  return {
    matchScore: round(finalScore, 4),
    matchPercent: round(finalScore * 100, 2),
  };
}

function cosineSimilarity(a, b) {
  const magnitudeA = magnitude(a);
  const magnitudeB = magnitude(b);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct(a, b) / (magnitudeA * magnitudeB);
}

function dotProduct(a, b) {
  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function magnitude(vector) {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function applyFilters(animals, filters = {}) {
  return animals.filter((animal) => {
    const isReady =
      animal.status === "Ready" || animal.status === "Ready for Adoption";

    if (!isReady) return false;

    const speciesMatch =
      !filters.preferredSpecies ||
      filters.preferredSpecies === "Any" ||
      String(animal.species || "").toLowerCase() ===
        String(filters.preferredSpecies).toLowerCase();

    if (!speciesMatch) return false;

    const sexMatch =
      !filters.preferredSex ||
      filters.preferredSex === "Any" ||
      animal.sex === "Unknown" ||
      String(animal.sex || "").toLowerCase() ===
        String(filters.preferredSex).toLowerCase();

    if (!sexMatch) return false;

    if (
      filters.needAllergyFriendly === "yes" &&
      animal.allergyFriendly !== undefined &&
      animal.allergyFriendly !== true
    ) {
      return false;
    }

    const aggressiveValue = Number(
      animal.behavioralAssessment?.aggressive ?? animal.aggressive ?? 0
    );

    if (
      filters.acceptAggressive === "no" &&
      aggressiveValue >= 5
    ) {
      return false;
    }

    const specialNeedsValue = Number(
      animal.behavioralAssessment?.specialNeeds ?? animal.specialNeeds ?? 0
    );

    if (
      filters.acceptSpecialNeeds === "no" &&
      specialNeedsValue >= 4
    ) {
      return false;
    }

    return true;
  });
}
