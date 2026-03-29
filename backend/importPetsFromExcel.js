const path = require("path");
const xlsx = require("xlsx");
const { db } = require("./src/config/firebase");

const FILE_PATH = path.join(__dirname, "Animal_Data_numeric_cosine_ready.xlsx");

function normalizeText(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function normalizeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeSpecies(value) {
  const raw = normalizeText(value).toLowerCase();

  if (raw === "canine") return "Dog";
  if (raw === "feline") return "Cat";
  if (raw === "dog") return "Dog";
  if (raw === "cat") return "Cat";

  return normalizeText(value);
}

function buildCompatibility(row) {
  return {
    energyLevel: normalizeNumber(row.energyLevel),
    exerciseNeeds: normalizeNumber(row.exerciseNeeds),
    independenceLevel: normalizeNumber(row.independenceLevel),
    attentionNeeds: normalizeNumber(row.attentionNeeds),
    playfulness: normalizeNumber(row.playfulness),
    friendlinessToHumans: normalizeNumber(row.friendlinessToHumans),
    goodWithKids: normalizeNumber(row.goodWithKids),
    goodWithOtherPets: normalizeNumber(row.goodWithOtherPets),
    strangerTolerance: normalizeNumber(row.strangerTolerance),
    noiseLevel: normalizeNumber(row.noiseLevel),
    spaceNeeds: normalizeNumber(row.spaceNeeds),
    adaptability: normalizeNumber(row.adaptability),
    climateTolerance: normalizeNumber(row.climateTolerance),
    groomingNeeds: normalizeNumber(row.groomingNeeds),
    sheddingLevel: normalizeNumber(row.sheddingLevel),
    trainingDifficulty: normalizeNumber(row.trainingDifficulty),
    healthRiskLevel: normalizeNumber(row.healthRiskLevel),
    affectionLevel: normalizeNumber(row.affectionLevel),
    loyaltyLevel: normalizeNumber(row.loyaltyLevel),
    separationAnxiety: normalizeNumber(row.separationAnxiety),
  };
}

async function importPets() {
  try {
    const workbook = xlsx.readFile(FILE_PATH);

    const lookupSheet = workbook.Sheets["Pet Lookup"];
    const numericSheet = workbook.Sheets["Numeric Data"];

    if (!lookupSheet || !numericSheet) {
      throw new Error('Workbook must contain sheets named "Pet Lookup" and "Numeric Data".');
    }

    const lookupRows = xlsx.utils.sheet_to_json(lookupSheet, { defval: "" });
    const numericRows = xlsx.utils.sheet_to_json(numericSheet, { defval: "" });

    const lookupMap = new Map();
    for (const row of lookupRows) {
      lookupMap.set(String(row.petId), row);
    }

    const mergedPets = [];

    for (const row of numericRows) {
      const petId = String(row.petId);
      const lookup = lookupMap.get(petId);

      if (!lookup) {
        console.warn(`Skipping petId ${petId}: no matching row in Pet Lookup`);
        continue;
      }

      const pet = {
        sourcePetId: petId,
        name: normalizeText(lookup.name),
        species: normalizeSpecies(lookup.species),
        breed: normalizeText(lookup.breed),
        sex: normalizeText(lookup.sex),
        age: normalizeNumber(lookup.age),
        size: normalizeText(lookup.size),
        barangay: normalizeText(lookup.barangay),
        coatColor: normalizeText(lookup.color),
        secondaryColor: normalizeText(lookup.secondaryColor),
        weightKg: normalizeNumber(lookup.weightKg),
        distinctFeatures: "",
        photoUrl: null,
        status: normalizeText(lookup.status, "Intake"),
        compatibility: buildCompatibility(row),
        flags: {
          allergyFriendly: false,
          aggressive: false,
          specialNeeds: false,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mergedPets.push(pet);
    }

    console.log(`Found ${mergedPets.length} merged pets to import.`);

    let batch = db.batch();
    let batchCount = 0;
    let totalImported = 0;

    for (const pet of mergedPets) {
      const ref = db.collection("pets").doc();
      batch.set(ref, pet);
      batchCount++;
      totalImported++;

      if (batchCount === 500) {
        await batch.commit();
        console.log(`Committed ${totalImported} pets...`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    console.log(`✅ Import complete. Total imported: ${totalImported}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Import failed:", error);
    process.exit(1);
  }
}

importPets();