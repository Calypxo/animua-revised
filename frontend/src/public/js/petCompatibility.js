import { API_BASE_URL } from "../../utils/api.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("pet-compatibility-form");

  console.log("petCompatibility.js loaded");

  if (!form) return;

    const progressFill = document.getElementById("quizProgressFill");
  const progressText = document.getElementById("quizProgressText");
  const requiredFields = form.querySelectorAll("select[required]");

  function updateQuizProgress() {
    const answered = Array.from(requiredFields).filter(
      (field) => field.value !== ""
    ).length;

    const total = requiredFields.length;
    const percent = total ? Math.round((answered / total) * 100) : 0;

    if (progressFill) {
      progressFill.style.width = `${percent}%`;
    }

    if (progressText) {
      progressText.textContent = `${percent}% completed`;
    }
  }

  form.addEventListener("change", updateQuizProgress);
  updateQuizProgress();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const formData = new FormData(form);

      const quizData = {
        filters: {
          preferredSpecies: formData.get("preferredSpecies") || "Any",
          preferredSex: formData.get("preferredSex") || "Any",
          needAllergyFriendly: formData.get("needAllergyFriendly") || "no",
          acceptAggressive: formData.get("acceptAggressive") || "yes",
          acceptSpecialNeeds: formData.get("acceptSpecialNeeds") || "yes"
        },
        preferences: {
          energyLevel: Number(formData.get("energyLevel")),
          exerciseNeeds: Number(formData.get("exerciseNeeds")),
          independenceLevel: Number(formData.get("independenceLevel")),
          attentionNeeds: Number(formData.get("attentionNeeds")),
          playfulness: Number(formData.get("playfulness")),
          friendlinessToHumans: Number(formData.get("friendlinessToHumans")),
          goodWithKids: Number(formData.get("goodWithKids")),
          goodWithOtherPets: Number(formData.get("goodWithOtherPets")),
          strangerTolerance: Number(formData.get("strangerTolerance")),
          noiseLevel: Number(formData.get("noiseLevel")),
          spaceNeeds: Number(formData.get("spaceNeeds")),
          adaptability: Number(formData.get("adaptability")),
          climateTolerance: Number(formData.get("climateTolerance")),
          groomingNeeds: Number(formData.get("groomingNeeds")),
          sheddingLevel: Number(formData.get("sheddingLevel")),
          trainingDifficulty: Number(formData.get("trainingDifficulty")),
          healthRiskLevel: Number(formData.get("healthRiskLevel")),
          affectionLevel: Number(formData.get("affectionLevel")),
          separationAnxiety: Number(formData.get("separationAnxiety"))
        }
      };

      console.log("Quiz Data:", quizData);

      const animals = await fetchAnimals();
      console.log("Animals from backend:", animals);

      const filteredAnimals = applyFilters(animals, quizData.filters);
      console.log("Filtered Animals:", filteredAnimals);

      const matchedAnimals = scoreAnimals(filteredAnimals, quizData.preferences);
      console.log("Matched Animals:", matchedAnimals);

      localStorage.setItem("animua_quiz_data", JSON.stringify(quizData));
      localStorage.setItem("animua_match_results", JSON.stringify(matchedAnimals));

      window.location.href = "/pages/public/compatibilityResults.html";
    } catch (error) {
      console.error("Compatibility matching failed:", error);
      alert("Something went wrong while finding pet matches.");
    }
  });
});

async function fetchAnimals() {
  const response = await fetch(`${API_BASE_URL}/public/pets`, {
    method: "GET"
  });

  if (!response.ok) {
    throw new Error("Failed to fetch pet records.");
  }

  const data = await response.json();
  console.log("RAW PET API RESPONSE:", data);

  const pets = Array.isArray(data) ? data : data.pets || data.animals || [];

  const normalizedPets = pets.map((pet) => ({
    ...pet,
    ...(pet.compatibility || {}),
    ...(pet.flags || {})
  }));

  console.log("NORMALIZED PETS:", normalizedPets);
  console.log("CHECK ONE PET:", normalizedPets[0]);

  return normalizedPets;
}

function applyFilters(animals, filters) {
  return animals.filter((animal) => {
    const isAdoptable = animal.status === "Ready for Adoption";

    const speciesMatch =
      !filters.preferredSpecies ||
      filters.preferredSpecies === "Any" ||
      animal.species === filters.preferredSpecies;

    const sexMatch =
      !filters.preferredSex ||
      filters.preferredSex === "Any" ||
      animal.sex === filters.preferredSex;

    const allergyMatch =
      filters.needAllergyFriendly !== "yes" || animal.allergyFriendly === true;

    const aggressiveMatch =
      filters.acceptAggressive !== "no" || animal.aggressive === false;

    const specialNeedsMatch =
      filters.acceptSpecialNeeds !== "no" || animal.specialNeeds === false;

    return (
      isAdoptable &&
      speciesMatch &&
      sexMatch &&
      allergyMatch &&
      aggressiveMatch &&
      specialNeedsMatch
    );
  });
}

function scoreAnimals(animals, preferences) {
  const keys = [
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
    "spaceNeeds",
    "adaptability",
    "climateTolerance",
    "groomingNeeds",
    "sheddingLevel",
    "trainingDifficulty",
    "healthRiskLevel",
    "affectionLevel",
    "separationAnxiety"
  ];

  const userVector = keys.map((key) => Number(preferences[key] || 0));
  console.log("User Vector:", userVector);

  const scored = animals.map((animal) => {
    const petVector = keys.map((key) => Number(animal[key] || 0));
    const similarity = cosineSimilarity(userVector, petVector);
    const matchPercent = similarity * 100;

    console.log("Pet:", animal.name);
    console.log("Pet Vector:", petVector);
    console.log("Cosine Similarity:", similarity);
    console.log("Match Percent:", matchPercent);

    return {
      ...animal,
      matchScore: Number(similarity.toFixed(4)),
      matchPercent: Number(matchPercent.toFixed(2))
    };
  });

  console.log("Scored Animals Before Sort:", scored);

  return scored.sort((a, b) => b.matchScore - a.matchScore);
}

function cosineSimilarity(vectorA, vectorB) {
  const dot = dotProduct(vectorA, vectorB);
  const magA = magnitude(vectorA);
  const magB = magnitude(vectorB);

  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dot / (magA * magB);
}

function dotProduct(vectorA, vectorB) {
  let total = 0;

  for (let i = 0; i < vectorA.length; i++) {
    total += vectorA[i] * vectorB[i];
  }

  return total;
}

function magnitude(vector) {
  let sum = 0;

  for (let i = 0; i < vector.length; i++) {
    sum += vector[i] * vector[i];
  }

  return Math.sqrt(sum);
}