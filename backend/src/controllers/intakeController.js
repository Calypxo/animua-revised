// backend/src/controllers/intakeController.js
const { db, admin } = require("../config/firebase");
const {
  buildShelterLabel,
  cleanText,
} = require("../utils/animalIdentity");
const {
  getSurrenderConversionError,
} = require("../services/surrenderWorkflowService");
const {
  canAdvanceIntakeToProfiling,
  shouldAutoAdvanceIntake,
} = require("../services/intakeWorkflowService");

// ── COLLECTION NAMES ──────────────────────────────────
const INTAKE_COL = "intakeRecords";
const ANIMAL_COL = "animals";
const AUDIT_COL  = "auditLogs";

async function prepareAnimalProfile(intake, intakeId, user = {}) {
  const year = new Date().getFullYear();
  const countSnap = await db.collection(ANIMAL_COL)
    .where("intakeYear", "==", year)
    .get();
  const animalId = `ANIM-${year}-${String(countSnap.size + 1).padStart(3, "0")}`;
  const today = new Date().toISOString().split("T")[0];
  const actor = user.fullName || user.email || "Staff";
  const shelterLabel = buildShelterLabel(intake, animalId);

  return {
    animalId,
    shelterLabel,
    profile: {
      intakeId,
      intakeYear: year,
      name: "",
      adoptedName: "",
      previousName: intake.previousName || "",
      identifyingDescription: intake.identifyingDescription || shelterLabel,
      shelterLabel,
      species: intake.species || "",
      breed: intake.breed || "",
      sex: intake.sex || "Unknown",
      ageEstimate: intake.ageEstimate || "",
      color: intake.color || "",
      cageNumber: "",
      housingType: "Unassigned",
      source: intake.source || "",
      intakeDate: intake.intakeDate || "",
      intakeLocation: intake.location || "",
      initialCondition: intake.condition || "",
      initialWeight: intake.weight || null,
      weight: intake.weight || null,
      injuries: intake.injuries || "Unknown",
      vaccinated: intake.vaccinated || "Unknown",
      alteredStatus: intake.alteredStatus || "Unknown",
      visibleDefects: intake.visibleDefects || "",
      conditionNotes: intake.conditionNotes || "",
      surrenderRefId: intake.surrenderRefId || null,
      barangayDetails: intake.barangayDetails || null,
      status: "Profiling",
      currentStage: "profiling",
      photoURL: null,
      behavioralAssessment: null,
      behavioralNotes: "",
      behavioralAssessor: "",
      behavioralDate: "",
      compatibilityVector: [],
      medicalRecords: [],
      adoptionDate: "",
      adopterName: "",
      adoptionStaff: "",
      notes: intake.intakeNotes || "",
      history: [
        {
          date: intake.intakeDate || today,
          event: "Intake recorded",
          detail: `${intake.source || "Unknown source"} intake`,
          actor: intake.encodedBy || "Staff",
        },
        {
          date: today,
          event: "Started profiling",
          detail: `Intake ${intakeId} advanced to animal profiling`,
          actor,
        },
      ],
      intakedBy: intake.encodedBy || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: user.email || "",
    },
  };
}

// ── GET ALL INTAKE RECORDS ────────────────────────────
// Optional query params: ?status=Pending&source=Rescue&species=Dog
exports.getAllIntake = async (req, res) => {
  try {
    const { status, source, species } = req.query;
    let query = db.collection(INTAKE_COL).orderBy("createdAt", "desc");

    const snapshot = await query.get();
    let records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Apply optional filters
    if (status)  records = records.filter(r => r.status  === status);
    if (source)  records = records.filter(r => r.source  === source);
    if (species) records = records.filter(r => r.species === species);

    const summary = {
      total:     records.length,
      pending:   records.filter(r => r.status === "Pending").length,
      approved:  records.filter(r => r.status === "Approved").length,
      converted: records.filter(r => r.status === "Converted").length,
      rejected:  records.filter(r => r.status === "Rejected").length,
      draft:     records.filter(r => r.status === "Draft").length,
    };

    res.status(200).json({ records, summary });
  } catch (err) {
    console.error("[getAllIntake]", err.message);
    res.status(500).json({ message: "Failed to fetch intake records." });
  }
};

// ── GET SINGLE INTAKE RECORD ──────────────────────────
exports.getIntakeById = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection(INTAKE_COL).doc(id).get();
    if (!doc.exists) return res.status(404).json({ message: "Record not found." });
    res.status(200).json({ record: { id: doc.id, ...doc.data() } });
  } catch (err) {
    console.error("[getIntakeById]", err.message);
    res.status(500).json({ message: "Failed to fetch record." });
  }
};

// ── CREATE INTAKE RECORD ──────────────────────────────
exports.createIntake = async (req, res) => {
  try {
    const {
      animalName, identifyingDescription, previousName,
      species, breed, sex, ageEstimate, color,
      source, condition, weight, conditionNotes,
      injuries, vaccinated, alteredStatus, visibleDefects,
      intakeDate, location, intakeNotes,
      barangayDetails, surrenderRefId,
      ownerName, ownerContact, surrenderApprovedDate,
      status, // "Pending" or "Draft"
    } = req.body;

    const recordStatus = status === "Draft" ? "Draft" : "Pending";
    const description = cleanText(
      identifyingDescription || animalName || color
    );

    if (
      recordStatus !== "Draft" &&
      (!description || !species || !sex || !condition ||
        !source || !intakeDate || !cleanText(location))
    ) {
      return res.status(400).json({
        message:
          "Required fields missing: identifyingDescription, species, sex, condition, source, intakeDate, location.",
      });
    }

    const validSources = ["Rescue", "Barangay Impound", "Approved Surrender"];
    if (!validSources.includes(source)) {
      return res.status(400).json({ message: `Invalid source. Must be one of: ${validSources.join(", ")}` });
    }

    if (source === "Barangay Impound" && !barangayDetails?.barangayName) {
      return res.status(400).json({ message: "Barangay name is required for Barangay Impound." });
    }

    if (source === "Approved Surrender" && !surrenderRefId) {
      return res.status(400).json({ message: "Surrender reference ID is required for Approved Surrender." });
    }

    if (source === "Approved Surrender" && recordStatus === "Draft") {
      return res.status(400).json({
        message: "Arrived surrender intakes must be completed now and cannot be saved as drafts.",
      });
    }

    let surrenderRef = null;
    if (source === "Approved Surrender") {
      surrenderRef = db.collection("surrenderRequests").doc(surrenderRefId);
      const surrenderSnapshot = await surrenderRef.get();
      if (!surrenderSnapshot.exists) {
        return res.status(404).json({ message: "Referenced surrender request was not found." });
      }

      const conversionError = getSurrenderConversionError(surrenderSnapshot.data() || {});
      if (conversionError) {
        return res.status(400).json({ message: conversionError });
      }

      const duplicateSnapshot = await db.collection(INTAKE_COL)
        .where("surrenderRefId", "==", surrenderRefId)
        .limit(1)
        .get();
      if (!duplicateSnapshot.empty) {
        return res.status(409).json({
          message: "An Intake record already exists for this surrender request.",
        });
      }
    }

    const year = new Date().getFullYear();

    // Auto-generate sequential ID: INT-YYYY-NNN
    const countSnap = await db.collection(INTAKE_COL)
      .where("intakeYear", "==", year)
      .get();
    const seq = String(countSnap.size + 1).padStart(3, "0");
    const intakeId = `INT-${year}-${seq}`;

    const shouldAdvanceToProfiling = shouldAutoAdvanceIntake({
      source,
      status: recordStatus,
    });
    const actor = req.user?.fullName || req.user?.email || "Staff";
    const approvedOn = new Date().toISOString().split("T")[0];

    const record = {
      animalName:    "",
      identifyingDescription: description,
      previousName:
        source === "Approved Surrender"
          ? cleanText(previousName || animalName)
          : cleanText(previousName),
      species, breed: breed || "", sex,
      ageEstimate:   ageEstimate || "",
      color:         color || "",
      source,
      condition,
      weight:        weight || null,
      conditionNotes: conditionNotes || "",
      injuries:      injuries || "Unknown",
      vaccinated:    vaccinated || "Unknown",
      alteredStatus: alteredStatus || "Unknown",
      visibleDefects: cleanText(visibleDefects),
      intakeDate,
      location:      location || "",
      intakeNotes:   intakeNotes || "",
      barangayDetails:      source === "Barangay Impound"   ? (barangayDetails || null) : null,
      surrenderRefId:       source === "Approved Surrender" ? (surrenderRefId  || null) : null,
      ownerName:            source === "Approved Surrender" ? (ownerName       || "")   : "",
      ownerContact:         source === "Approved Surrender" ? (ownerContact    || "")   : "",
      surrenderApprovedDate:source === "Approved Surrender" ? (surrenderApprovedDate || "") : "",
      status:        recordStatus,
      intakeYear:    year,
      encodedBy:     req.user?.fullName || req.user?.email || "Staff",
      encodedByEmail:req.user?.email    || "",
      approvedBy:    null,
      approvedAt:    null,
      rejectedReason:null,
      animalProfileId: null,  // filled on convert
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    let preparedProfile = null;
    if (shouldAdvanceToProfiling) {
      preparedProfile = await prepareAnimalProfile(record, intakeId, req.user || {});
      record.status = "Converted";
      record.approvedBy = actor;
      record.approvedAt = approvedOn;
      record.animalProfileId = preparedProfile.animalId;
    }

    const intakeRef = db.collection(INTAKE_COL).doc(intakeId);
    const batch = db.batch();
    batch.set(intakeRef, record);

    if (preparedProfile) {
      batch.set(
        db.collection(ANIMAL_COL).doc(preparedProfile.animalId),
        preparedProfile.profile
      );
    }

    if (surrenderRef) {
      batch.update(surrenderRef, {
        status: "Converted",
        intakeId,
        dropoffDate: intakeDate,
        deadlineStatus: "Completed",
        deadlineReminderStage: "Completed",
        noShowRisk: false,
        convertedAt: new Date().toISOString(),
        convertedBy: req.user?.fullName || req.user?.email || "Staff",
        updatedAt: new Date().toISOString(),
      });
    }

    await batch.commit();

    await writeAuditLog({
      action:          "intake.created",
      module:          "Intake Management",
      targetId:        intakeId,
      targetName:      buildShelterLabel(record, intakeId),
      performedBy:     req.user?.email,
      performedByName: req.user?.fullName,
      after:           { source, species, condition, status: record.status },
    });

    if (preparedProfile) {
      await writeAuditLog({
        action: "intake.converted",
        module: "Intake Management",
        targetId: intakeId,
        targetName: preparedProfile.shelterLabel,
        performedBy: req.user?.email,
        performedByName: req.user?.fullName,
        before: { status: "Pending" },
        after: { status: "Converted", animalProfileId: preparedProfile.animalId },
      });
    }

    res.status(201).json({
      message: preparedProfile
        ? "Intake completed and animal moved to profiling."
        : surrenderRef
        ? "Intake record created and surrender request converted."
        : "Intake record created.",
      id: intakeId,
      surrenderConverted: Boolean(surrenderRef),
      animalProfileId: preparedProfile?.animalId || null,
      status: record.status,
    });
  } catch (err) {
    console.error("[createIntake]", err.message);
    res.status(500).json({ message: "Failed to create intake record." });
  }
};

// ── UPDATE INTAKE RECORD (Pending / Draft only) ───────
exports.updateIntake = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection(INTAKE_COL).doc(id).get();
    if (!doc.exists) return res.status(404).json({ message: "Record not found." });

    const current = doc.data();
    if (!["Pending","Draft"].includes(current.status)) {
      return res.status(400).json({ message: `Cannot edit a record with status: ${current.status}.` });
    }

  const allowed = [
    "identifyingDescription","previousName",
    "species","breed","sex","ageEstimate","color",
    "source",
    "condition","weight","conditionNotes","injuries","vaccinated",
    "alteredStatus","visibleDefects",
    "intakeDate","location","intakeNotes",
    "barangayDetails","surrenderRefId","ownerName","ownerContact","surrenderApprovedDate",
    "status", "photoURL", "cageNumber", "housingType"
  ];

    const updates = {};
    allowed.forEach(key => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });

    if (
      updates.identifyingDescription !== undefined
    ) {
      updates.identifyingDescription =
        cleanText(updates.identifyingDescription);
      updates.animalName = "";
    }

    const candidate = { ...current, ...updates };
    if (candidate.status === "Pending") {
      const description = cleanText(
        candidate.identifyingDescription ||
        candidate.animalName ||
        candidate.color
      );

      if (
        !description ||
        !candidate.species ||
        !candidate.sex ||
        !candidate.condition ||
        !candidate.source ||
        !candidate.intakeDate ||
        !cleanText(candidate.location)
      ) {
        return res.status(400).json({
          message:
            "Submitted intake records require an identifying description, species, sex, condition, source, intake date, and location.",
        });
      }
      updates.identifyingDescription = description;
      updates.animalName = "";
    }

    updates.updatedAt  = admin.firestore.FieldValue.serverTimestamp();
    updates.updatedBy  = req.user?.email;

    await db.collection(INTAKE_COL).doc(id).update(updates);

    await writeAuditLog({
      action: "intake.updated", module: "Intake Management",
      targetId: id, targetName: buildShelterLabel(current, id),
      performedBy: req.user?.email, performedByName: req.user?.fullName,
      before: { status: current.status }, after: { status: updates.status || current.status },
    });

    res.status(200).json({ message: "Intake record updated." });
  } catch (err) {
    console.error("[updateIntake]", err.message);
    res.status(500).json({ message: "Failed to update record." });
  }
};

// ── APPROVE INTAKE ────────────────────────────────────
exports.approveIntake = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection(INTAKE_COL).doc(id).get();
    if (!doc.exists) return res.status(404).json({ message: "Record not found." });

    const current = doc.data();
    if (current.status !== "Pending") {
      return res.status(400).json({ message: `Cannot approve a record with status: ${current.status}.` });
    }

    const now = new Date().toISOString().split("T")[0];

    await db.collection(INTAKE_COL).doc(id).update({
      status:     "Approved",
      approvedBy: req.user?.fullName || req.user?.email,
      approvedAt: now,
      updatedAt:  admin.firestore.FieldValue.serverTimestamp(),
      updatedBy:  req.user?.email,
    });

    await writeAuditLog({
      action: "intake.approved", module: "Intake Management",
      targetId: id, targetName: buildShelterLabel(current, id),
      performedBy: req.user?.email, performedByName: req.user?.fullName,
      before: { status: "Pending" }, after: { status: "Approved" },
    });

    res.status(200).json({ message: "Intake approved.", status: "Approved" });
  } catch (err) {
    console.error("[approveIntake]", err.message);
    res.status(500).json({ message: "Failed to approve intake." });
  }
};

// ── REJECT INTAKE ─────────────────────────────────────
exports.rejectIntake = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ message: "A rejection reason (min 5 chars) is required." });
    }

    const doc = await db.collection(INTAKE_COL).doc(id).get();
    if (!doc.exists) return res.status(404).json({ message: "Record not found." });

    const current = doc.data();
    if (current.status !== "Pending") {
      return res.status(400).json({ message: `Cannot reject a record with status: ${current.status}.` });
    }

    await db.collection(INTAKE_COL).doc(id).update({
      status:         "Rejected",
      rejectedReason: reason.trim(),
      updatedAt:      admin.firestore.FieldValue.serverTimestamp(),
      updatedBy:      req.user?.email,
    });

    await writeAuditLog({
      action: "intake.rejected", module: "Intake Management",
      targetId: id, targetName: buildShelterLabel(current, id),
      performedBy: req.user?.email, performedByName: req.user?.fullName,
      before: { status: "Pending" }, after: { status: "Rejected", reason },
    });

    res.status(200).json({ message: "Intake rejected.", status: "Rejected" });
  } catch (err) {
    console.error("[rejectIntake]", err.message);
    res.status(500).json({ message: "Failed to reject intake." });
  }
};

// ── CONVERT TO ANIMAL PROFILE ─────────────────────────
// Creates a new document in the `animals` collection from the intake data
exports.convertToProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection(INTAKE_COL).doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ message: "Intake record not found." });
    }

    const intake = doc.data();

    if (!canAdvanceIntakeToProfiling(intake.status)) {
      return res.status(400).json({
        message: "Only Pending or Approved intakes can be moved to profiling."
      });
    }

    if (intake.animalProfileId) {
      return res.status(409).json({
        message: "This intake has already been converted.",
        profileId: intake.animalProfileId
      });
    }

    const originalStatus = intake.status;
    const preparedProfile = await prepareAnimalProfile(intake, id, req.user || {});
    const { animalId, shelterLabel, profile: animalProfile } = preparedProfile;
    const approvedOn = new Date().toISOString().split("T")[0];

    // Batch write: create animal profile + update intake record
    const batch = db.batch();

    batch.set(db.collection(ANIMAL_COL).doc(animalId), animalProfile);

    batch.update(db.collection(INTAKE_COL).doc(id), {
      status: "Converted",
      animalProfileId: animalId,
      approvedBy: intake.approvedBy || req.user?.fullName || req.user?.email || "Staff",
      approvedAt: intake.approvedAt || approvedOn,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user?.email || "",
    });

    await batch.commit();

    await writeAuditLog({
      action: "intake.converted",
      module: "Intake Management",
      targetId: id,
      targetName: shelterLabel,
      performedBy: req.user?.email,
      performedByName: req.user?.fullName,
      before: { status: originalStatus },
      after: { status: "Converted", animalProfileId: animalId },
    });

    res.status(201).json({
      message: "Animal profile created successfully.",
      animalProfileId: animalId,
      intakeId: id,
    });
  } catch (err) {
    console.error("[convertToProfile]", err.message);
    res.status(500).json({ message: "Failed to convert intake to profile." });
  }
};

// ── AUDIT LOG HELPER ──────────────────────────────────
async function writeAuditLog({ action, module, targetId, targetName,
  performedBy, performedByName, before = {}, after = {} }) {
  try {
    await db.collection(AUDIT_COL).add({
      action, module,
      targetId:        targetId        || "",
      targetName:      targetName      || "",
      performedBy:     performedBy     || "system",
      performedByName: performedByName || "System",
      before, after,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn("[auditLog]", err.message);
  }
}
