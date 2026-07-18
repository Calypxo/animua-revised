// backend/src/controllers/animalController.js
const { db, admin, bucket } = require("../config/firebase");

const ANIMAL_COL = "animals";
const AUDIT_COL  = "auditLogs";

// ── GET ALL ANIMALS ───────────────────────────────────
exports.getAllAnimals = async (req, res) => {
  try {
    const { status, species, sex } = req.query;
    const snapshot = await db.collection(ANIMAL_COL).orderBy("createdAt", "desc").get();

    let animals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (status)  animals = animals.filter(a => a.status === status);
    if (species) animals = animals.filter(a => a.species === species);
    if (sex)     animals = animals.filter(a => a.sex === sex);

    const summary = {
      total:      animals.length,
      profiling:  animals.filter(a => a.status === "Profiling").length,
      quarantine: animals.filter(a => a.status === "Quarantine").length,
      ready:      animals.filter(a => a.status === "Ready").length,
      adopted:    animals.filter(a => a.status === "Adopted").length,
      fostered:   animals.filter(a => a.status === "Fostered").length,
      archived:   animals.filter(a => a.status === "Archived").length,
    };

    res.status(200).json({ animals, summary });
  } catch (err) {
    console.error("[getAllAnimals]", err.message);
    res.status(500).json({ message: "Failed to fetch animals." });
  }
};

// ── GET SINGLE ANIMAL ─────────────────────────────────
exports.getAnimalById = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection(ANIMAL_COL).doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Animal not found." });
    }

    const animal = { id: doc.id, ...doc.data() };
    animal.history = animal.history || [];
    animal.medicalRecords = animal.medicalRecords || [];

    res.status(200).json({ animal });
  } catch (err) {
    console.error("[getAnimalById]", err.message);
    res.status(500).json({ message: "Failed to fetch animal." });
  }
};

// ── UPDATE ANIMAL PROFILE ─────────────────────────────
exports.updateAnimal = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection(ANIMAL_COL).doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Animal not found." });
    }

    const before = doc.data();

    const allowed = [
      "name",
      "species",
      "breed",
      "sex",
      "ageEstimate",
      "color",
      "weight",
      "status",
      "notes",
      "photoURL",
      "cageNumber",
      "housingType"
    ];

    const updates = {};
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });

    console.log("[updateAnimal] Incoming req.body:", req.body);
    console.log("[updateAnimal] Updates object:", updates);

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    updates.updatedBy = req.user?.email || "";

    if (updates.status && updates.status !== before.status) {
      updates.history = admin.firestore.FieldValue.arrayUnion({
        date: new Date().toISOString().split("T")[0],
        event: `Status changed to ${updates.status}`,
        detail: `From ${before.status}`,
        actor: req.user?.fullName || req.user?.email || "Staff",
      });
    }

    await db.collection(ANIMAL_COL).doc(id).update(updates);

    await writeAuditLog({
      action: "animal.updated",
      module: "Animal Profiling",
      targetId: id,
      targetName: updates.name || before.name,
      performedBy: req.user?.email,
      performedByName: req.user?.fullName,
      before: { status: before.status },
      after: { status: updates.status || before.status },
    });

    res.status(200).json({ message: "Animal profile updated." });
  } catch (err) {
    console.error("[updateAnimal]", err.message);
    res.status(500).json({ message: "Failed to update animal." });
  }
};

exports.uploadAnimalProfileImage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        message: "No image file uploaded.",
      });
    }

    const animalRef = db.collection("animals").doc(id);
    const animalDoc = await animalRef.get();

    if (!animalDoc.exists) {
      return res.status(404).json({
        message: "Animal not found.",
      });
    }

    const animalData = animalDoc.data();

    if (animalData.photoPath) {
      await bucket.file(animalData.photoPath).delete().catch(() => {});
    }

    const fileExt = req.file.originalname.split(".").pop();
    const fileName = `animals/${id}/profile-${Date.now()}.${fileExt}`;

    const file = bucket.file(fileName);

    await file.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype,
      },
      resumable: false,
    });

    await file.makePublic();

    const photoURL = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    await animalRef.update({
      photoURL,
      photoPath: fileName,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      message: "Animal image uploaded successfully.",
      photoURL,
    });
  } catch (error) {
    console.error("[uploadAnimalProfileImage]", error.message);
    res.status(500).json({
      message: "Failed to upload animal image.",
    });
  }
};

exports.deleteAnimalProfileImage = async (req, res) => {
  try {
    const { id } = req.params;

    const animalRef = db.collection("animals").doc(id);
    const animalDoc = await animalRef.get();

    if (!animalDoc.exists) {
      return res.status(404).json({
        message: "Animal not found.",
      });
    }

    const animalData = animalDoc.data();

    if (animalData.photoPath) {
      await bucket.file(animalData.photoPath).delete().catch(() => {});
    }

    await animalRef.update({
      photoURL: "",
      photoPath: "",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      message: "Animal photo removed successfully.",
    });
  } catch (error) {
    console.error("[deleteAnimalProfileImage]", error.message);
    res.status(500).json({
      message: "Failed to remove animal image.",
    });
  }
};

// ── SAVE BEHAVIORAL ASSESSMENT ────────────────────────
exports.saveBehavioralAssessment = async (req, res) => {
  try {
    const { id } = req.params;
    const { traits, notes, assessor } = req.body;

    if (!traits || typeof traits !== "object") {
      return res.status(400).json({ message: "Trait scores object is required." });
    }

    const REQUIRED_TRAITS = [
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
      "trainingDifficulty",
      "affectionLevel",
      "separationAnxiety",
      "aggressive",
      "specialNeeds",
    ];

    for (const t of REQUIRED_TRAITS) {
      if (traits[t] === undefined) {
        return res.status(400).json({ message: `Missing trait: ${t}` });
      }

      if (traits[t] < 1 || traits[t] > 5) {
        return res.status(400).json({ message: `Trait ${t} must be between 1 and 5.` });
      }
    }

    const doc = await db.collection(ANIMAL_COL).doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ message: "Animal not found." });
    }

    const compatibilityVector = REQUIRED_TRAITS.map((traitKey) => traits[traitKey]);

    const historyEntry = {
      date: new Date().toISOString().split("T")[0],
      event: "Behavioral assessment completed",
      detail: "Behavioral dimensions recorded for compatibility matching",
      actor: assessor || req.user?.fullName || req.user?.email || "Staff",
    };

    await db.collection(ANIMAL_COL).doc(id).update({
      behavioralAssessment: traits,
      behavioralNotes: notes || "",
      behavioralAssessor: assessor || req.user?.fullName || "",
      behavioralDate: new Date().toISOString().split("T")[0],
      compatibilityVector,
      history: admin.firestore.FieldValue.arrayUnion(historyEntry),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user?.email || "",
    });

    await writeAuditLog({
      action: "animal.behavioral_assessment",
      module: "Animal Profiling",
      targetId: id,
      targetName: doc.data().name,
      performedBy: req.user?.email,
      performedByName: req.user?.fullName,
      after: {
        traitsRecorded: REQUIRED_TRAITS.length
      },
    });

    res.status(200).json({
      message: "Behavioral assessment saved."
    });
  } catch (err) {
    console.error("[saveBehavioralAssessment]", err.message);
    res.status(500).json({ message: "Failed to save behavioral assessment." });
  }
};

// ── ADD MEDICAL RECORD ────────────────────────────────
exports.addMedicalRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, date, vet, diagnosis, treatment, notes, clearance, weight } = req.body;

    if (!type || !date) {
      return res.status(400).json({ message: "Type and date are required." });
    }

    const doc = await db.collection(ANIMAL_COL).doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ message: "Animal not found." });
    }

    const medId = `MR-${Date.now()}`;
    const record = {
      id: medId,
      type,
      date,
      vet: vet || "",
      diagnosis: diagnosis || "",
      treatment: treatment || "",
      notes: notes || "",
      clearance: clearance || "Pending",
      weight: weight || null,
    };

    const histEntry = {
      date,
      event: `Medical record added — ${type}`,
      detail: diagnosis || "",
      actor: vet || req.user?.fullName || "Staff",
    };

    const updates = {
      medicalRecords: admin.firestore.FieldValue.arrayUnion(record),
      history: admin.firestore.FieldValue.arrayUnion(histEntry),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user?.email || "",
    };

    if (weight !== undefined && weight !== null && weight !== "") {
      updates.weight = weight;
    }

    if (clearance !== "Cleared" && doc.data().status === "Profiling") {
      updates.status = "Quarantine";
    }

    await db.collection(ANIMAL_COL).doc(id).update(updates);

    res.status(201).json({ message: "Medical record added.", id: medId });
  } catch (err) {
    console.error("[addMedicalRecord]", err.message);
    res.status(500).json({ message: "Failed to add medical record." });
  }
};

// ── UPDATE MEDICAL RECORD ─────────────────────────────
exports.updateMedicalRecord = async (req, res) => {
  try {
    const { id, medicalId } = req.params;
    const { type, date, vet, diagnosis, treatment, notes, clearance, weight } = req.body;

    const doc = await db.collection(ANIMAL_COL).doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ message: "Animal not found." });
    }

    const animal = doc.data();
    const records = animal.medicalRecords || [];
    const index = records.findIndex((r) => r.id === medicalId);

    if (index === -1) {
      return res.status(404).json({ message: "Medical record not found." });
    }

    const existing = records[index];

    records[index] = {
      ...existing,
      type: type ?? existing.type,
      date: date ?? existing.date,
      vet: vet ?? existing.vet,
      diagnosis: diagnosis ?? existing.diagnosis,
      treatment: treatment ?? existing.treatment,
      notes: notes ?? existing.notes,
      clearance: clearance ?? existing.clearance,
      weight: weight ?? existing.weight,
    };

    const histEntry = {
      date: new Date().toISOString().split("T")[0],
      event: `Medical record updated — ${records[index].type}`,
      detail: records[index].diagnosis || "",
      actor: req.user?.fullName || req.user?.email || "Staff",
    };

    const updates = {
      medicalRecords: records,
      history: admin.firestore.FieldValue.arrayUnion(histEntry),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user?.email || "",
    };

    if (records[index].weight !== undefined && records[index].weight !== null && records[index].weight !== "") {
      updates.weight = records[index].weight;
    }

    await db.collection(ANIMAL_COL).doc(id).update(updates);

    res.status(200).json({ message: "Medical record updated." });
  } catch (err) {
    console.error("[updateMedicalRecord]", err.message);
    res.status(500).json({ message: "Failed to update medical record." });
  }
};

// ── ARCHIVE ANIMAL ────────────────────────────────────
exports.archiveAnimal = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection(ANIMAL_COL).doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Animal not found." });
    }

    const histEntry = {
      date: new Date().toISOString().split("T")[0],
      event: "Animal archived",
      detail: "Moved to archive",
      actor: req.user?.fullName || req.user?.email || "Staff",
    };

    await db.collection(ANIMAL_COL).doc(id).update({
      status: "Archived",
      history: admin.firestore.FieldValue.arrayUnion(histEntry),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user?.email || "",
    });

    await writeAuditLog({
      action: "animal.archived",
      module: "Animal Profiling",
      targetId: id,
      targetName: doc.data().name,
      performedBy: req.user?.email,
      performedByName: req.user?.fullName,
      before: { status: doc.data().status },
      after: { status: "Archived" },
    });

    res.status(200).json({ message: "Animal archived." });
  } catch (err) {
    console.error("[archiveAnimal]", err.message);
    res.status(500).json({ message: "Failed to archive animal." });
  }
};

// ── AUDIT LOG ─────────────────────────────────────────
async function writeAuditLog({
  action,
  module,
  targetId,
  targetName,
  performedBy,
  performedByName,
  before = {},
  after = {}
}) {
  try {
    await db.collection(AUDIT_COL).add({
      action,
      module,
      targetId: targetId || "",
      targetName: targetName || "",
      performedBy: performedBy || "system",
      performedByName: performedByName || "System",
      before,
      after,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn("[auditLog]", err.message);
  }
}