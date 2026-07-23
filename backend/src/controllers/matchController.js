const PYTHON_MATCHER_URL =
  process.env.PYTHON_MATCHER_URL || "http://127.0.0.1:8001/score";
const {
  buildShelterLabel,
} = require("../utils/animalIdentity");

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

    const pythonResponse = await fetch(PYTHON_MATCHER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        preferences,
        animals,
        top_k: 5,
      }),
    });

    if (!pythonResponse.ok) {
      const text = await pythonResponse.text();
      throw new Error(`Python matcher failed: ${text}`);
    }

    const result = await pythonResponse.json();

    return res.status(200).json(result);
  } catch (error) {
    console.error("[matchPets]", error);
    return res.status(500).json({
      message: "Failed to match pets.",
      error: error.message,
    });
  }
};

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
