// backend/src/controllers/animalController.js
const { db, admin, bucket } = require("../config/firebase");
const {
  getAnimalDisplayLabel,
} = require("../utils/animalIdentity");

const ANIMAL_COL = "animals";
const AUDIT_COL  = "auditLogs";
const INVENTORY_COL = "inventoryItems";

const MEDICAL_INVENTORY_CATEGORIES = new Set([
  "Antibiotic", "Antiparasitic", "Antifungal", "Anesthetic",
  "Supplement", "Vaccine", "Surgical Supply", "Topical Medicine",
  "Hormonal Medicine", "Respiratory Medicine", "Pain Relief",
  "Sedative", "Diagnostic",
]);
const QUARANTINE_CLEARANCE_VALUES =
  new Set(["Pending", "Cleared", "Hold"]);
const MEDICAL_RECORD_TYPES = new Set([
  "Checkup",
  "Vaccination",
  "Treatment",
  "Surgery",
  "Deworming",
  "Quarantine Clearance",
]);

function requestError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeInventoryQuantity(value) {
  if (value === undefined || value === null || value === "") return 0;

  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw requestError(
      400,
      "Inventory quantity must be a non-negative whole number."
    );
  }
  return quantity;
}

function validateInventoryUsage(inventoryItemId, quantityUsed) {
  if (quantityUsed > 0 && !inventoryItemId) {
    throw requestError(
      400,
      "Select an inventory item when recording inventory usage."
    );
  }
  if (inventoryItemId && quantityUsed < 1) {
    throw requestError(
      400,
      "Inventory quantity must be at least 1 when an item is selected."
    );
  }
}

function getValidatedClearance(type, value, fallback = "Pending") {
  if (type !== "Quarantine Clearance") return null;

  const clearance = String(value ?? fallback).trim() || fallback;
  if (!QUARANTINE_CLEARANCE_VALUES.has(clearance)) {
    throw requestError(
      400,
      "Quarantine clearance must be Pending, Cleared, or Hold."
    );
  }
  return clearance;
}

function validateMedicalRecordFields(type, date) {
  if (!MEDICAL_RECORD_TYPES.has(String(type || "").trim())) {
    throw requestError(400, "Select a valid medical record type.");
  }
  if (!date || Number.isNaN(Date.parse(date))) {
    throw requestError(400, "Select a valid medical record date.");
  }
}

function getInventoryStock(item = {}) {
  const stock = Number(
    item.currentStock ?? item.quantity ?? item.stock ?? item.onHand ?? 0
  );
  return Number.isFinite(stock) ? stock : 0;
}

function getLatestQuarantineClearance(records = []) {
  let latest = null;
  records.forEach((record, index) => {
    if (record?.type !== "Quarantine Clearance" || !record.clearance) return;

    const timestamp = Date.parse(record.date || "") || 0;
    if (
      !latest ||
      timestamp > latest.timestamp ||
      (timestamp === latest.timestamp && index > latest.index)
    ) {
      latest = { record, index, timestamp };
    }
  });
  return latest?.record || null;
}

function buildAuditLogEntry({
  action, module, targetId, targetName, performedBy,
  performedByName, before = {}, after = {},
}) {
  return {
    action,
    module,
    targetId: targetId || "",
    targetName: targetName || "",
    performedBy: performedBy || "system",
    performedByName: performedByName || "System",
    before,
    after,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  };
}

function calculateInventoryUpdates(item, previousStock, nextStock) {
  const avgMonthlyUsage = Number(item.avgMonthlyUsage || 0);
  const averageInventory = Number(item.averageInventory || nextStock || 0);
  const leadTimeDays = Number(item.leadTimeDays || item.leadTime || 7);
  const wasDeducted = nextStock < previousStock;
  const stockoutFrequency =
    Number(item.stockoutFrequency || 0) +
    (wasDeducted && previousStock > 0 && nextStock <= 0 ? 1 : 0);
  const monthlyTurnoverRatio =
    averageInventory > 0
      ? Number((avgMonthlyUsage / averageInventory).toFixed(2))
      : 0;
  const reorderPoint = Math.max(
    1,
    Math.ceil((avgMonthlyUsage / 30) * leadTimeDays)
  );
  const criticalPoint = Math.max(1, Math.floor(reorderPoint * 0.5));
  const daysUntilStockout =
    avgMonthlyUsage > 0
      ? Math.round((nextStock / avgMonthlyUsage) * 30)
      : 999;
  const daysToRestock = Math.max(0, daysUntilStockout - leadTimeDays);
  const recencyDays = wasDeducted ? 0 : Number(item.recencyDays || 0);
  const movement =
    (monthlyTurnoverRatio >= 0.5 && recencyDays <= 7) ||
    stockoutFrequency > 0
      ? "Fast"
      : "Slow";
  const stockStatus =
    nextStock <= criticalPoint
      ? "Critical"
      : nextStock <= reorderPoint
      ? "Low"
      : "OK";
  const reorderRisk =
    nextStock < avgMonthlyUsage || stockoutFrequency > 0
      ? "Review"
      : "OK";

  return {
    currentStock: nextStock,
    recencyDays,
    stockoutFrequency,
    monthlyTurnoverRatio,
    movementLabel: movement,
    movement,
    reorderRisk,
    reorderPoint,
    daysUntilStockout,
    daysToRestock,
    stockStatus,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function resolveInventoryDocumentId(rawId) {
  const inventoryItemId = String(rawId || "").trim();
  if (!inventoryItemId) return "";

  const collection = db.collection(INVENTORY_COL);
  const direct = await collection.doc(inventoryItemId).get();
  if (direct.exists) return direct.id;

  for (const field of ["id", "itemId"]) {
    const snapshot = await collection
      .where(field, "==", inventoryItemId)
      .limit(2)
      .get();
    if (snapshot.size === 1) return snapshot.docs[0].id;
    if (snapshot.size > 1) {
      throw requestError(
        409,
        "The inventory identifier matches multiple items."
      );
    }
  }

  throw requestError(404, "Inventory item not found.");
}

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
      "identifyingDescription",
      "shelterLabel",
      "species",
      "breed",
      "sex",
      "ageEstimate",
      "color",
      "weight",
      "notes",
      "photoURL",
      "cageNumber",
      "housingType",
    ];

    const updates = {};
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });

    console.log("[updateAnimal] Incoming req.body:", req.body);
    console.log("[updateAnimal] Updates object:", updates);

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    updates.updatedBy = req.user?.email || "";

    await db.collection(ANIMAL_COL).doc(id).update(updates);

    await writeAuditLog({
      action: "animal.updated",
      module: "Animal Profiling",
      targetId: id,
      targetName:
        updates.identifyingDescription ||
        updates.shelterLabel ||
        getAnimalDisplayLabel(before, id),
      performedBy: req.user?.email,
      performedByName: req.user?.fullName,
      before: { status: before.status },
      after: {
      updatedFields: Object.keys(updates).filter(
        key => !["updatedAt", "updatedBy"].includes(key)
      ),
    },
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
        cacheControl: "public, max-age=31536000",
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
    const { traits, notes } = req.body;

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
      actor: req.user?.fullName || req.user?.email || "Staff",
    };

    await db.collection(ANIMAL_COL).doc(id).update({
      behavioralAssessment: traits,
      behavioralNotes: notes || "",
      behavioralAssessor: req.user?.fullName || req.user?.email || "Staff",
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
      targetName: getAnimalDisplayLabel(doc.data(), id),
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
    const {
      type,
      date,
      diagnosis,
      treatment,
      notes,
      clearance,
      weight,
      inventoryItemId,
      quantityUsed,
    } = req.body;

    if (!type || !date) {
      return res.status(400).json({ message: "Type and date are required." });
    }
    validateMedicalRecordFields(type, date);

    const requestedInventoryId = String(inventoryItemId || "").trim();
    const normalizedQuantity = normalizeInventoryQuantity(quantityUsed);
    validateInventoryUsage(requestedInventoryId, normalizedQuantity);
    const resolvedInventoryId =
      await resolveInventoryDocumentId(requestedInventoryId);
    const animalRef = db.collection(ANIMAL_COL).doc(id);
    const inventoryRef = resolvedInventoryId
      ? db.collection(INVENTORY_COL).doc(resolvedInventoryId)
      : null;
    const medId = `MR-${Date.now()}`;
    let inventoryResult = null;

    await db.runTransaction(async (transaction) => {
      const animalDoc = await transaction.get(animalRef);
      if (!animalDoc.exists) throw requestError(404, "Animal not found.");

      const animal = animalDoc.data();
      if (animal.status !== "Quarantine") {
        throw requestError(
          400,
          "Medical records can only be added while the animal is in Quarantine."
        );
      }
      if (
        type === "Quarantine Clearance" &&
        (animal.medicalRecords || []).some(
          (record) => record.type === "Quarantine Clearance"
        )
      ) {
        throw requestError(
          409,
          "A quarantine review already exists. Update its decision instead of creating another clearance record."
        );
      }

      let inventoryData = null;
      let currentStock = 0;
      let newStock = 0;
      if (inventoryRef) {
        const inventoryDoc = await transaction.get(inventoryRef);
        if (!inventoryDoc.exists) {
          throw requestError(404, "Inventory item not found.");
        }
        inventoryData = inventoryDoc.data();
        if (
          !MEDICAL_INVENTORY_CATEGORIES.has(
            String(inventoryData.category || "")
          )
        ) {
          throw requestError(
            400,
            "The selected inventory item is not a medical supply."
          );
        }
        currentStock = getInventoryStock(inventoryData);
        if (normalizedQuantity > currentStock) {
          throw requestError(
            409,
            `${inventoryData.itemDescription || inventoryData.name || "Inventory item"} only has ${currentStock} ${inventoryData.unit || "pcs"} available.`
          );
        }
        newStock = currentStock - normalizedQuantity;
      }

      const record = {
        id: medId,
        type,
        date,
        vet: req.user?.fullName || req.user?.email || "Staff",
        diagnosis: diagnosis || "",
        treatment: treatment || "",
        notes: notes || "",
        clearance: getValidatedClearance(type, clearance),
        weight: weight || null,
        inventoryItemId: resolvedInventoryId,
        quantityUsed: normalizedQuantity,
        inventoryItemName:
          inventoryData?.itemDescription || inventoryData?.name || "",
        inventoryUnit: inventoryData?.unit || "",
      };
      const medicalRecords = [...(animal.medicalRecords || []), record];
      const latestClearance =
        getLatestQuarantineClearance(medicalRecords);
      const historyEntry = {
        date,
        event: `Medical record added - ${type}`,
        detail: diagnosis || "",
        actor:
          req.user?.fullName || req.user?.email || "System User",
      };
      const animalUpdates = {
        medicalRecords,
        history: admin.firestore.FieldValue.arrayUnion(historyEntry),
        quarantineClearance: latestClearance?.clearance || "Pending",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: req.user?.email || "",
      };
      animalUpdates.quarantineClearedAt =
        latestClearance?.clearance === "Cleared"
          ? latestClearance.date || date
          : admin.firestore.FieldValue.delete();
      if (weight !== undefined && weight !== null && weight !== "") {
        animalUpdates.weight = weight;
      }

      transaction.update(animalRef, animalUpdates);
      transaction.set(
        db.collection(AUDIT_COL).doc(),
        buildAuditLogEntry({
          action: "animal.medical_record_added",
          module: "Quarantine and Medical",
          targetId: id,
          targetName: getAnimalDisplayLabel(animal, id),
          performedBy: req.user?.email,
          performedByName: req.user?.fullName,
          after: {
            medicalRecordId: medId,
            type,
            inventoryItemId: resolvedInventoryId,
            quantityUsed: normalizedQuantity,
          },
        })
      );

      if (inventoryRef) {
        const inventoryName =
          inventoryData.itemDescription ||
          inventoryData.name ||
          resolvedInventoryId;
        transaction.update(
          inventoryRef,
          calculateInventoryUpdates(inventoryData, currentStock, newStock)
        );
        transaction.set(
          inventoryRef.collection("transactions").doc(),
          {
            type: "out",
            qty: normalizedQuantity,
            date,
            animal: getAnimalDisplayLabel(animal, id),
            animalId: id,
            procedure: type,
            notes: treatment || notes || "Medical quarantine usage",
            staff:
              req.user?.fullName || req.user?.email || "Veterinarian",
            medicalRecordId: medId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          }
        );
        transaction.set(
          db.collection(AUDIT_COL).doc(),
          buildAuditLogEntry({
            action: "inventory.medical_stock_used",
            module: "Inventory",
            targetId: resolvedInventoryId,
            targetName: inventoryName,
            performedBy: req.user?.email,
            performedByName: req.user?.fullName,
            before: { currentStock },
            after: {
              currentStock: newStock,
              quantityUsed: normalizedQuantity,
              animalId: id,
              medicalRecordId: medId,
            },
          })
        );
        inventoryResult = {
          itemId: resolvedInventoryId,
          itemName: inventoryName,
          unit: inventoryData.unit || "pcs",
          quantityUsed: normalizedQuantity,
          newStock,
        };
      }
    });

    res.status(201).json({
      message: "Medical record added.",
      id: medId,
      inventory: inventoryResult,
    });
  } catch (err) {
    console.error("[addMedicalRecord]", err.message);
    res.status(err.statusCode || 500).json({
      message: err.statusCode ? err.message : "Failed to add medical record.",
    });
  }
};

const RESTORABLE_ANIMAL_STATUSES =
  new Set([
    "Profiling",
    "Quarantine",
    "Ready",
    "Adopted",
    "Fostered",
  ]);

function timestampToMillis(value) {
  if (!value) {
    return 0;
  }

  if (
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }

  if (
    typeof value._seconds === "number"
  ) {
    return value._seconds * 1000;
  }

  if (
    typeof value.seconds === "number"
  ) {
    return value.seconds * 1000;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? 0
    : parsed.getTime();
}

async function resolvePreviousAnimalStatus(
  animalId,
  animal
) {
  if (
    RESTORABLE_ANIMAL_STATUSES.has(
      animal.statusBeforeArchive
    )
  ) {
    return animal.statusBeforeArchive;
  }

  /*
   * Older archived records may not have
   * statusBeforeArchive yet. Their audit log
   * contains the status before archiving.
   */
  try {
    const snapshot = await db
      .collection(AUDIT_COL)
      .where("targetId", "==", animalId)
      .get();

    const archiveLogs = snapshot.docs
      .map((doc) => doc.data())
      .filter(
        (log) =>
          log.action === "animal.archived"
      )
      .sort(
        (a, b) =>
          timestampToMillis(b.timestamp) -
          timestampToMillis(a.timestamp)
      );

    const previousStatus =
      archiveLogs[0]?.before?.status;

    if (
      RESTORABLE_ANIMAL_STATUSES.has(
        previousStatus
      )
    ) {
      return previousStatus;
    }
  } catch (error) {
    console.warn(
      "[resolvePreviousAnimalStatus]",
      error.message
    );
  }

  return "Profiling";
}

// ── RESTORE ARCHIVED ANIMAL ───────────────────────────
exports.restoreAnimal = async (req, res) => {
  try {
    const { id } = req.params;

    const animalRef = db
      .collection(ANIMAL_COL)
      .doc(id);

    const animalDoc =
      await animalRef.get();

    if (!animalDoc.exists) {
      return res.status(404).json({
        message: "Animal not found.",
      });
    }

    const animal = animalDoc.data();

    if (animal.status !== "Archived") {
      return res.status(409).json({
        message:
          "Animal record is not archived.",
      });
    }

    const restoredStatus =
      await resolvePreviousAnimalStatus(
        id,
        animal
      );

    const restoredBy =
      req.user?.email || "";

    const restoredByName =
      req.user?.fullName ||
      req.user?.email ||
      "Administrator";

    const historyEntry = {
      date: new Date()
        .toISOString()
        .split("T")[0],

      event: "Animal restored",

      detail:
        `Restored from archive to ${restoredStatus}`,

      actor: restoredByName,
    };

    await animalRef.update({
      status: restoredStatus,

      statusBeforeArchive:
        admin.firestore.FieldValue.delete(),

      archiveReason:
        admin.firestore.FieldValue.delete(),

      archiveDescription:
        admin.firestore.FieldValue.delete(),

      archivedAt:
        admin.firestore.FieldValue.delete(),

      archivedBy:
        admin.firestore.FieldValue.delete(),

      archivedByName:
        admin.firestore.FieldValue.delete(),

      history:
        admin.firestore.FieldValue.arrayUnion(
          historyEntry
        ),

      updatedAt:
        admin.firestore.FieldValue.serverTimestamp(),

      updatedBy: restoredBy,
    });

    await writeAuditLog({
      action: "animal.restored",
      module: "Archived Records",
      targetId: id,
      targetName: getAnimalDisplayLabel(animal, id),
      performedBy: restoredBy,
      performedByName: restoredByName,
      before: {
        status: "Archived",
      },
      after: {
        status: restoredStatus,
      },
    });

    return res.status(200).json({
      message:
        "Animal restored successfully.",

      status: restoredStatus,
    });
  } catch (error) {
    console.error(
      "[restoreAnimal]",
      error.message
    );

    return res.status(500).json({
      message:
        "Failed to restore animal.",
    });
  }
};

// ── UPDATE MEDICAL RECORD ─────────────────────────────
exports.updateMedicalRecord = async (req, res) => {
  try {
    const { id, medicalId } = req.params;
    const {
      type,
      date,
      diagnosis,
      treatment,
      notes,
      clearance,
      weight,
      inventoryItemId,
      quantityUsed,
    } = req.body;

    const animalRef = db.collection(ANIMAL_COL).doc(id);
    const preflightDoc = await animalRef.get();
    if (!preflightDoc.exists) {
      return res.status(404).json({ message: "Animal not found." });
    }

    const preflightAnimal = preflightDoc.data();
    const preflightRecord = (preflightAnimal.medicalRecords || [])
      .find((record) => record.id === medicalId);
    if (!preflightRecord) {
      return res.status(404).json({ message: "Medical record not found." });
    }
    validateMedicalRecordFields(
      type ?? preflightRecord.type,
      date ?? preflightRecord.date
    );

    const hasItem = Object.prototype.hasOwnProperty.call(
      req.body,
      "inventoryItemId"
    );
    const hasQuantity = Object.prototype.hasOwnProperty.call(
      req.body,
      "quantityUsed"
    );
    const requestedInventoryId = String(
      hasItem
        ? inventoryItemId || ""
        : preflightRecord.inventoryItemId || ""
    ).trim();
    const normalizedQuantity = normalizeInventoryQuantity(
      hasQuantity ? quantityUsed : preflightRecord.quantityUsed
    );
    validateInventoryUsage(requestedInventoryId, normalizedQuantity);

    const oldInventoryId = await resolveInventoryDocumentId(
      preflightRecord.inventoryItemId || ""
    );
    const newInventoryId =
      await resolveInventoryDocumentId(requestedInventoryId);
    const inventoryIds = [
      ...new Set([oldInventoryId, newInventoryId].filter(Boolean)),
    ];
    let inventoryAdjustments = [];

    await db.runTransaction(async (transaction) => {
      const animalDoc = await transaction.get(animalRef);
      if (!animalDoc.exists) throw requestError(404, "Animal not found.");

      const animal = animalDoc.data();
      if (animal.status !== "Quarantine") {
        throw requestError(
          400,
          "Medical records can only be updated while the animal is in Quarantine."
        );
      }

      const records = [...(animal.medicalRecords || [])];
      const index = records.findIndex((record) => record.id === medicalId);
      if (index === -1) {
        throw requestError(404, "Medical record not found.");
      }

      const existing = records[index];
      if (
        String(existing.inventoryItemId || "") !==
        String(preflightRecord.inventoryItemId || "")
      ) {
        throw requestError(
          409,
          "The medical record changed while it was being edited. Reload and try again."
        );
      }

      const inventoryStates = new Map();
      for (const inventoryId of inventoryIds) {
        const ref = db.collection(INVENTORY_COL).doc(inventoryId);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) {
          throw requestError(
            409,
            "An inventory item linked to this medical record no longer exists."
          );
        }
        const data = snapshot.data();
        const currentStock = getInventoryStock(data);
        inventoryStates.set(inventoryId, {
          ref,
          data,
          currentStock,
          newStock: currentStock,
        });
      }

      if (newInventoryId) {
        const selected = inventoryStates.get(newInventoryId);
        if (
          !MEDICAL_INVENTORY_CATEGORIES.has(
            String(selected.data.category || "")
          )
        ) {
          throw requestError(
            400,
            "The selected inventory item is not a medical supply."
          );
        }
      }

      const oldQuantity = normalizeInventoryQuantity(existing.quantityUsed);
      if (oldQuantity > 0) {
        const oldState = inventoryStates.get(oldInventoryId);
        if (!oldState) {
          throw requestError(
            409,
            "The existing inventory usage cannot be safely reversed."
          );
        }
        oldState.newStock += oldQuantity;
      }

      if (normalizedQuantity > 0) {
        const newState = inventoryStates.get(newInventoryId);
        if (!newState || normalizedQuantity > newState.newStock) {
          const available = newState?.newStock || 0;
          const name =
            newState?.data.itemDescription ||
            newState?.data.name ||
            "Inventory item";
          throw requestError(
            409,
            `${name} only has ${available} ${newState?.data.unit || "pcs"} available after adjusting the existing record.`
          );
        }
        newState.newStock -= normalizedQuantity;
      }

      const selectedInventory =
        newInventoryId
          ? inventoryStates.get(newInventoryId)?.data
          : null;
      const updatedRecord = {
        ...existing,
        type: type ?? existing.type,
        date: date ?? existing.date,
        vet: existing.vet || req.user?.fullName || req.user?.email || "Staff",
        diagnosis: diagnosis ?? existing.diagnosis,
        treatment: treatment ?? existing.treatment,
        notes: notes ?? existing.notes,
        clearance: getValidatedClearance(
          type ?? existing.type,
          clearance,
          existing.clearance ?? "Pending"
        ),
        weight: weight ?? existing.weight,
        inventoryItemId: newInventoryId,
        quantityUsed: normalizedQuantity,
        inventoryItemName:
          selectedInventory?.itemDescription ||
          selectedInventory?.name ||
          "",
        inventoryUnit: selectedInventory?.unit || "",
      };
      records[index] = updatedRecord;

      const latestClearance =
        getLatestQuarantineClearance(records);
      const historyEntry = {
        date: new Date().toISOString().split("T")[0],
        event: `Medical record updated - ${updatedRecord.type}`,
        detail: updatedRecord.diagnosis || "",
        actor:
          req.user?.fullName || req.user?.email || "System User",
      };
      const animalUpdates = {
        medicalRecords: records,
        history: admin.firestore.FieldValue.arrayUnion(historyEntry),
        quarantineClearance: latestClearance?.clearance || "Pending",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: req.user?.email || "",
      };
      animalUpdates.quarantineClearedAt =
        latestClearance?.clearance === "Cleared"
          ? latestClearance.date ||
            new Date().toISOString().split("T")[0]
          : admin.firestore.FieldValue.delete();
      if (
        updatedRecord.weight !== undefined &&
        updatedRecord.weight !== null &&
        updatedRecord.weight !== ""
      ) {
        animalUpdates.weight = updatedRecord.weight;
      }

      transaction.update(animalRef, animalUpdates);
      transaction.set(
        db.collection(AUDIT_COL).doc(),
        buildAuditLogEntry({
          action: "animal.medical_record_updated",
          module: "Quarantine and Medical",
          targetId: id,
          targetName: getAnimalDisplayLabel(animal, id),
          performedBy: req.user?.email,
          performedByName: req.user?.fullName,
          before: {
            medicalRecordId: medicalId,
            type: existing.type,
            inventoryItemId: oldInventoryId,
            quantityUsed: oldQuantity,
          },
          after: {
            medicalRecordId: medicalId,
            type: updatedRecord.type,
            inventoryItemId: newInventoryId,
            quantityUsed: normalizedQuantity,
          },
        })
      );

      const adjustments = [];
      for (const [inventoryId, state] of inventoryStates) {
        const difference = state.newStock - state.currentStock;
        if (difference === 0) continue;

        const isReturn = difference > 0;
        const quantityChanged = Math.abs(difference);
        const inventoryName =
          state.data.itemDescription || state.data.name || inventoryId;
        transaction.update(
          state.ref,
          calculateInventoryUpdates(
            state.data,
            state.currentStock,
            state.newStock
          )
        );
        transaction.set(
          state.ref.collection("transactions").doc(),
          {
            type: isReturn ? "in" : "out",
            qty: quantityChanged,
            date:
              updatedRecord.date ||
              new Date().toISOString().split("T")[0],
            animal: getAnimalDisplayLabel(animal, id),
            animalId: id,
            procedure: updatedRecord.type,
            notes: isReturn
              ? "Medical record inventory adjustment (returned)"
              : "Medical record inventory adjustment (used)",
            staff:
              req.user?.fullName || req.user?.email || "Veterinarian",
            medicalRecordId: medicalId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          }
        );
        transaction.set(
          db.collection(AUDIT_COL).doc(),
          buildAuditLogEntry({
            action: isReturn
              ? "inventory.medical_stock_returned"
              : "inventory.medical_stock_used",
            module: "Inventory",
            targetId: inventoryId,
            targetName: inventoryName,
            performedBy: req.user?.email,
            performedByName: req.user?.fullName,
            before: { currentStock: state.currentStock },
            after: {
              currentStock: state.newStock,
              quantityChanged,
              animalId: id,
              medicalRecordId: medicalId,
            },
          })
        );
        adjustments.push({
          itemId: inventoryId,
          itemName: inventoryName,
          unit: state.data.unit || "pcs",
          type: isReturn ? "in" : "out",
          quantity: quantityChanged,
          newStock: state.newStock,
        });
      }
      inventoryAdjustments = adjustments;
    });

    res.status(200).json({
      message: "Medical record updated.",
      inventoryAdjustments,
    });
  } catch (err) {
    console.error("[updateMedicalRecord]", err.message);
    res.status(err.statusCode || 500).json({
      message: err.statusCode
        ? err.message
        : "Failed to update medical record.",
    });
  }
};

exports.sendToQuarantine = async (req, res) => {
  try {
    const { id } = req.params;

    const animalRef = db.collection(ANIMAL_COL).doc(id);
    const doc = await animalRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        message: "Animal not found.",
      });
    }

    const animal = doc.data();

    if (animal.status !== "Profiling") {
      return res.status(400).json({
        message: "Only animals in Profiling can be sent to quarantine.",
      });
    }

    const today = new Date().toISOString().split("T")[0];

    const historyEntry = {
      date: today,
      event: "Sent to quarantine",
      detail: "Animal moved from profiling to quarantine/medical evaluation.",
      actor: req.user?.fullName || req.user?.email || "Staff",
    };

    await animalRef.update({
      status: "Quarantine",
      currentStage: "quarantine",
      profilingStatus: "Completed",
      quarantineStatus: "Active",
      quarantineClearance: "Pending",
      quarantineStartedAt: today,
      visibleToPublic: false,
      history: admin.firestore.FieldValue.arrayUnion(historyEntry),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user?.email || "",
    });

    await writeAuditLog({
      action: "animal.sent_to_quarantine",
      module: "Animal Profiling",
      targetId: id,
      targetName: getAnimalDisplayLabel(animal, id),
      performedBy: req.user?.email,
      performedByName: req.user?.fullName,
      before: {
        status: animal.status,
      },
      after: {
        status: "Quarantine",
        quarantineClearance: "Pending",
      },
    });

    res.status(200).json({
      message: "Animal sent to quarantine.",
      status: "Quarantine",
    });
  } catch (err) {
    console.error("[sendToQuarantine]", err.message);
    res.status(500).json({
      message: "Failed to send animal to quarantine.",
    });
  }
};

exports.markReadyForAdoption = async (req, res) => {
  try {
    const { id } = req.params;

    const animalRef = db.collection(ANIMAL_COL).doc(id);
    const doc = await animalRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        message: "Animal not found.",
      });
    }

    const animal = doc.data();

    if (animal.status !== "Quarantine") {
      return res.status(400).json({
        message: "Only animals in Quarantine can be marked ready for adoption.",
      });
    }

    const medicalRecords = animal.medicalRecords || [];

    const latestClearance =
      getLatestQuarantineClearance(medicalRecords);
    const hasVetClearance =
      latestClearance?.clearance === "Cleared";

    if (!hasVetClearance) {
      return res.status(400).json({
        message: "Animal must have cleared quarantine clearance before being marked ready.",
      });
    }

    if (!animal.behavioralAssessment) {
      return res.status(400).json({
        message: "Behavioral assessment is required before marking animal ready for adoption.",
      });
    }

    const today = new Date().toISOString().split("T")[0];

    const historyEntry = {
      date: today,
      event: "Marked ready for adoption",
      detail: "Animal completed quarantine clearance and behavioral assessment.",
      actor: req.user?.fullName || req.user?.email || "Staff",
    };

    await animalRef.update({
      status: "Ready",
      currentStage: "adoption",
      quarantineStatus: "Completed",
      quarantineClearance: "Cleared",
      quarantineClearedAt: today,
      readyForAdoptionAt: today,
      visibleToPublic: true,
      history: admin.firestore.FieldValue.arrayUnion(historyEntry),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user?.email || "",
    });

    await writeAuditLog({
      action: "animal.marked_ready",
      module: "Animal Profiling",
      targetId: id,
      targetName: getAnimalDisplayLabel(animal, id),
      performedBy: req.user?.email,
      performedByName: req.user?.fullName,
      before: {
        status: animal.status,
      },
      after: {
        status: "Ready",
        visibleToPublic: true,
      },
    });

    res.status(200).json({
      message: "Animal marked ready for adoption.",
      status: "Ready",
    });
  } catch (err) {
    console.error("[markReadyForAdoption]", err.message);
    res.status(500).json({
      message: "Failed to mark animal ready for adoption.",
    });
  }
};

// ── ARCHIVE ANIMAL ────────────────────────────────────
exports.archiveAnimal = async (req, res) => {
  try {
    const { id } = req.params;

    const animalRef = db.collection(ANIMAL_COL).doc(id);
    const animalDoc = await animalRef.get();

    if (!animalDoc.exists) {
      return res.status(404).json({
        message: "Animal not found.",
      });
    }

    const animal = animalDoc.data();

    if (animal.status === "Archived") {
      return res.status(409).json({
        message: "Animal is already archived.",
      });
    }

    const allowedReasons = [
      "Duplicate",
      "Inactive",
      "Transferred",
      "Completed",
      "Replaced",
      "Other",
    ];

    const requestedReason = String(
      req.body?.reason || "Other"
    ).trim();

    const archiveReason = allowedReasons.includes(
      requestedReason
    )
      ? requestedReason
      : "Other";

    const archiveDescription = String(
      req.body?.description ||
        `Animal record archived from ${animal.status || "active records"}.`
    ).trim();

    const archivedBy =
      req.user?.email || "";

    const archivedByName =
      req.user?.fullName ||
      req.user?.email ||
      "Administrator";

    const historyEntry = {
      date: new Date()
        .toISOString()
        .split("T")[0],

      event: "Animal archived",

      detail: archiveDescription,

      actor: archivedByName,
    };

    await animalRef.update({
      statusBeforeArchive:
        animal.status || "Profiling",

      status: "Archived",

      archiveReason,
      archiveDescription,

      archivedAt:
        admin.firestore.FieldValue.serverTimestamp(),

      archivedBy,
      archivedByName,

      history:
        admin.firestore.FieldValue.arrayUnion(
          historyEntry
        ),

      updatedAt:
        admin.firestore.FieldValue.serverTimestamp(),

      updatedBy: archivedBy,
    });

    await writeAuditLog({
      action: "animal.archived",
      module: "Animal Profiling",
      targetId: id,
      targetName: getAnimalDisplayLabel(animal, id),
      performedBy: archivedBy,
      performedByName: archivedByName,
      before: {
        status: animal.status,
      },
      after: {
        status: "Archived",
        reason: archiveReason,
      },
    });

    return res.status(200).json({
      message: "Animal archived successfully.",
    });
  } catch (error) {
    console.error(
      "[archiveAnimal]",
      error.message
    );

    return res.status(500).json({
      message: "Failed to archive animal.",
    });
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
