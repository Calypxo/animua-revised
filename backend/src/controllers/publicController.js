const { db } = require("../config/firebase");

const ANIMAL_COL = "animals";

/**
 * GET /api/public/pets
 * Public-facing list of adoptable animals
 *
 * Optional query params:
 * - species=Dog
 * - sex=Male
 * - search=buddy
 */
exports.getPublicPets = async (req, res) => {
  try {
    const { species, sex, search } = req.query;

    // Current system flow:
    // Only animals already marked "Ready" are shown publicly.
    let query = db.collection(ANIMAL_COL).where("status", "==", "Ready");

    const snapshot = await query.get();

    let pets = snapshot.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        name: data.name || "Unknown",
        species: data.species || "",
        breed: data.breed || "",
        sex: data.sex || "Unknown",
        ageEstimate: data.ageEstimate || "",
        color: data.color || "",
        photoURL: data.photoURL || "",
        source: data.source || "",
        intakeDate: data.intakeDate || "",
        intakeLocation: data.intakeLocation || "",
        initialCondition: data.initialCondition || "",
        behavioralAssessment: data.behavioralAssessment || null,
        status: data.status || "Ready",
      };
    });

    // Optional frontend filters
    if (species) {
      pets = pets.filter((pet) => pet.species === species);
    }

    if (sex) {
      pets = pets.filter((pet) => pet.sex === sex);
    }

    if (search) {
      const q = search.toLowerCase().trim();
      pets = pets.filter((pet) => {
        const name = (pet.name || "").toLowerCase();
        const breed = (pet.breed || "").toLowerCase();
        const speciesName = (pet.species || "").toLowerCase();

        return (
          name.includes(q) ||
          breed.includes(q) ||
          speciesName.includes(q)
        );
      });
    }

    res.status(200).json({
      pets,
      total: pets.length,
    });
  } catch (error) {
    console.error("[getPublicPets]", error.message);
    res.status(500).json({
      message: "Failed to fetch public pets.",
    });
  }
};

/**
 * GET /api/public/pets/:id
 * Public-facing single pet details
 */
exports.getPublicPetById = async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await db.collection(ANIMAL_COL).doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        message: "Pet not found.",
      });
    }

    const data = doc.data();

    // Only allow public access to Ready animals
    if (data.status !== "Ready") {
      return res.status(404).json({
        message: "Pet not found.",
      });
    }

    const pet = {
      id: doc.id,
      name: data.name || "Unknown",
      species: data.species || "",
      breed: data.breed || "",
      sex: data.sex || "Unknown",
      ageEstimate: data.ageEstimate || "",
      color: data.color || "",
      photoURL: data.photoURL || "",
      source: data.source || "",
      intakeDate: data.intakeDate || "",
      intakeLocation: data.intakeLocation || "",
      initialCondition: data.initialCondition || "",
      conditionNotes: data.conditionNotes || "",
      behavioralAssessment: data.behavioralAssessment || null,
      status: data.status || "Ready",
    };

    res.status(200).json({ pet });
  } catch (error) {
    console.error("[getPublicPetById]", error.message);
    res.status(500).json({
      message: "Failed to fetch pet details.",
    });
  }
};