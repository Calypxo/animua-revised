const { db } = require("../config/firebase");
const { buildShelterLabel } = require("../utils/animalIdentity");

const ANGELES_BARANGAYS = [
  "Agapito del Rosario", "Amsic", "Anunas", "Balibago", "Capaya", "Claro M. Recto",
  "Cuayan", "Cutcut", "Cutud", "Lourdes Norte", "Lourdes Sur", "Lourdes Sur East",
  "Malabanias", "Margot", "Mining", "Ninoy Aquino", "Pampang", "Pandan", "Plaridel",
  "Pulung Cacutud", "Pulung Maragul", "Pulungbulu", "Salapungan", "San Jose",
  "San Nicolas", "Santa Teresita", "Santa Trinidad", "Santo Cristo", "Santo Domingo",
  "Santo Rosario", "Sapalibutad", "Sapangbato", "Sergio Bernal", "Silangan",
  "Tabun", "Virgen Delos Remedios",
];

const dateText = (value) => {
  if (!value) return "";
  const date = typeof value.toDate === "function"
    ? value.toDate()
    : new Date((value._seconds ?? value.seconds)
      ? (value._seconds ?? value.seconds) * 1000
      : value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

const withinPeriod = (value, query) =>
  (!query.from || dateText(value) >= query.from) &&
  (!query.to || dateText(value) <= query.to);

const stockStatus = (item) => {
  const current = Number(item.currentStock ?? item.quantity ?? item.stock ?? 0);
  const reorder = Number(item.reorderPoint ?? item.minimumStock ?? item.minStock ?? 0);
  const critical = Number(item.criticalPoint ?? Math.max(1, Math.floor(reorder / 2)));
  return current <= critical ? "Critical" : reorder && current <= reorder ? "Low" : "OK";
};

const barangayFromLocation = (location) => {
  const normalized = String(location || "").trim().toLowerCase();
  if (!normalized) return "";
  return [...ANGELES_BARANGAYS]
    .sort((left, right) => right.length - left.length)
    .find((barangay) => normalized.includes(barangay.toLowerCase())) || "";
};

const barangayOf = (record = {}) => {
  const structured =
    record.barangayDetails?.barangayName ||
    record.owner?.barangay ||
    record.barangay ||
    "";
  if (structured) return structured;
  return ["Barangay Impound", "Rescue"].includes(record.source)
    ? barangayFromLocation(record.location || record.intakeLocation)
    : "";
};

exports.getReports = async (req, res) => {
  try {
    const snapshots = await Promise.all(
      ["intakeRecords", "animals", "adoptions", "surrenderRequests", "inventoryItems"]
        .map((name) => db.collection(name).get())
    );
    const [intakes, animals, adoptions, surrenders, inventory] = snapshots.map(
      (snapshot) => snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))
    );
    const inventoryById = new Map(inventory.map((item) => [item.id, item]));
    const animalsById = new Map(animals.map((animal) => [animal.id, animal]));

    const reports = {
      intake: intakes
        .filter((record) => withinPeriod(record.intakeDate || record.createdAt, req.query))
        .map((record) => ({
          date: dateText(record.intakeDate || record.createdAt),
          id: record.id,
          animal: buildShelterLabel(record, record.id),
          source: record.source,
          barangay: barangayOf(record),
          species: record.species,
          status: record.status,
          conversion: record.animalProfileId ? "Converted" : "Not converted",
          location: record.location,
        })),
      status: animals
        .filter((animal) => withinPeriod(animal.intakeDate || animal.createdAt, req.query))
        .map((animal) => ({
          date: dateText(animal.intakeDate || animal.createdAt),
          id: animal.id,
          animal: buildShelterLabel(animal, animal.id),
          barangay: barangayOf(animal),
          species: animal.species,
          status: animal.status,
          clearance: animal.quarantineClearance || "N/A",
          assessment: animal.behavioralAssessment ? "Complete" : "Pending",
        })),
      adoption: adoptions
        .filter((application) => withinPeriod(application.submittedAt || application.createdAt, req.query))
        .map((application) => {
          const animal = animalsById.get(application.pet_id) || {};
          return {
            date: dateText(application.submittedAt || application.createdAt),
            id: application.applicationId || application.id,
            animalId: application.pet_id,
            animal: application.pet_label || application.pet_name,
            applicant: application.applicant?.full_name,
            contact: application.applicant?.contact_number,
            barangay: barangayOf(animal),
            location: animal.location || animal.intakeLocation || "",
            status: application.status,
            source: application.compatibility ? "Quiz" : "Browse",
            adoptionDate: dateText(application.adoptionDate),
            adoptedName: application.adoptedName || "",
          };
        }),
      medical: [],
      inventory: [],
      surrender: surrenders
        .filter((request) => withinPeriod(request.createdAt || request.submittedAt, req.query))
        .map((request) => ({
          date: dateText(request.createdAt || request.submittedAt),
          id: request.id,
          owner: request.owner?.name,
          barangay: barangayOf(request),
          animal: request.pet?.colorMarkings || request.pet?.name,
          species: request.pet?.species,
          status: request.status,
          category: request.nlp?.category || request.nlp?.classification || "",
          urgency: request.nlp?.urgency || request.nlp?.urgencyLevel || "",
        })),
      barangay: intakes
        .filter((record) =>
          withinPeriod(record.intakeDate || record.createdAt, req.query) &&
          ["Barangay Impound", "Rescue"].includes(record.source) &&
          barangayOf(record)
        )
        .map((record) => ({
          date: dateText(record.intakeDate || record.createdAt),
          id: record.id,
          barangay: barangayOf(record),
          animal: buildShelterLabel(record, record.id),
          species: record.species,
          condition: record.condition || "Not recorded",
          status: record.status,
          location: record.location,
          officer: record.barangayDetails?.officerName || "Not recorded",
        })),
    };

    animals.forEach((animal) => {
      (animal.medicalRecords || []).forEach((medicalRecord) => {
        if (!withinPeriod(medicalRecord.date, req.query)) return;
        const item = inventoryById.get(medicalRecord.inventoryItemId) || {};
        const reportRow = {
          date: dateText(medicalRecord.date),
          animalId: animal.id,
          animal: buildShelterLabel(animal, animal.id),
          barangay: barangayOf(animal),
          type: medicalRecord.type,
          veterinarian: medicalRecord.vet,
          diagnosis: medicalRecord.diagnosis,
          treatment: medicalRecord.treatment,
          inventoryItem: medicalRecord.inventoryItemName || item.name || item.itemDescription || "",
          quantityUsed: Number(medicalRecord.quantityUsed || 0),
          unit: medicalRecord.inventoryUnit || item.unit || "",
          clearance: medicalRecord.clearance || "N/A",
        };
        reports.medical.push(reportRow);
        if (reportRow.quantityUsed) {
          reports.inventory.push({
            ...reportRow,
            remainingStock: Number(item.currentStock ?? item.quantity ?? item.stock ?? 0),
            stockStatus: stockStatus(item),
          });
        }
      });
    });

    const reportsByRole = {
      Admin: ["intake", "barangay", "status", "adoption", "medical", "inventory", "surrender"],
      Staff: ["intake", "barangay", "status", "adoption", "surrender"],
      Veterinarian: ["status", "medical", "inventory"],
    };
    const available = reportsByRole[req.user.role] || [];

    return res.json({
      generatedAt: new Date().toISOString(),
      available,
      reports: Object.fromEntries(available.map((key) => [key, reports[key]])),
    });
  } catch (error) {
    console.error("[reports]", error);
    return res.status(500).json({ message: "Failed to generate live reports." });
  }
};
