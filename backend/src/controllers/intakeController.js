// backend/src/controllers/intakeController.js
const { db, admin } = require("../config/firebase");

// ── COLLECTION NAMES ──────────────────────────────────
const INTAKE_COL = "intakeRecords";
const ANIMAL_COL = "animals";
const AUDIT_COL  = "auditLogs";

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
      animalName, species, breed, sex, ageEstimate, color,
      source, condition, weight, conditionNotes,
      injuries, vaccinated,
      intakeDate, location, intakeNotes,
      barangayDetails, surrenderRefId,
      ownerName, ownerContact, surrenderApprovedDate,
      status, // "Pending" or "Draft"
    } = req.body;

    // Validation
    if (!species || !sex || !condition || !source || !intakeDate) {
      return res.status(400).json({ message: "Required fields missing: species, sex, condition, source, intakeDate." });
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

    const year = new Date().getFullYear();

    // Auto-generate sequential ID: INT-YYYY-NNN
    const countSnap = await db.collection(INTAKE_COL)
      .where("intakeYear", "==", year)
      .get();
    const seq = String(countSnap.size + 1).padStart(3, "0");
    const intakeId = `INT-${year}-${seq}`;

    const record = {
      animalName:    animalName || "Unknown",
      species, breed: breed || "", sex,
      ageEstimate:   ageEstimate || "",
      color:         color || "",
      source,
      condition,
      weight:        weight || null,
      conditionNotes: conditionNotes || "",
      injuries:      injuries || "Unknown",
      vaccinated:    vaccinated || "Unknown",
      intakeDate,
      location:      location || "",
      intakeNotes:   intakeNotes || "",
      barangayDetails:      source === "Barangay Impound"   ? (barangayDetails || null) : null,
      surrenderRefId:       source === "Approved Surrender" ? (surrenderRefId  || null) : null,
      ownerName:            source === "Approved Surrender" ? (ownerName       || "")   : "",
      ownerContact:         source === "Approved Surrender" ? (ownerContact    || "")   : "",
      surrenderApprovedDate:source === "Approved Surrender" ? (surrenderApprovedDate || "") : "",
      status:        status === "Draft" ? "Draft" : "Pending",
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

    await db.collection(INTAKE_COL).doc(intakeId).set(record);

    await writeAuditLog({
      action:          "intake.created",
      module:          "Intake Management",
      targetId:        intakeId,
      targetName:      `${animalName || "Unknown"} (${species})`,
      performedBy:     req.user?.email,
      performedByName: req.user?.fullName,
      after:           { source, species, condition, status: record.status },
    });

    res.status(201).json({ message: "Intake record created.", id: intakeId });
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
    "animalName","species","breed","sex","ageEstimate","color",
    "source",
    "condition","weight","conditionNotes","injuries","vaccinated",
    "intakeDate","location","intakeNotes",
    "barangayDetails","surrenderRefId","ownerName","ownerContact","surrenderApprovedDate",
    "status", "photoURL", "cageNumber", "housingType"
  ];

    const updates = {};
    allowed.forEach(key => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });

    updates.updatedAt  = admin.firestore.FieldValue.serverTimestamp();
    updates.updatedBy  = req.user?.email;

    await db.collection(INTAKE_COL).doc(id).update(updates);

    await writeAuditLog({
      action: "intake.updated", module: "Intake Management",
      targetId: id, targetName: current.animalName,
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
      targetId: id, targetName: current.animalName,
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
      targetId: id, targetName: current.animalName,
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

    if (intake.status !== "Approved") {
      return res.status(400).json({
        message: "Only Approved intakes can be converted to a profile."
      });
    }

    if (intake.animalProfileId) {
      return res.status(409).json({
        message: "This intake has already been converted.",
        profileId: intake.animalProfileId
      });
    }

    // Auto-generate animal ID: ANIM-YYYY-NNN
    const year = new Date().getFullYear();
    const countSnap = await db.collection(ANIMAL_COL)
      .where("intakeYear", "==", year)
      .get();

    const seq = String(countSnap.size + 1).padStart(3, "0");
    const animalId = `ANIM-${year}-${seq}`;

    const today = new Date().toISOString().split("T")[0];
    const actor = req.user?.fullName || req.user?.email || "Admin";

    const animalProfile = {
      intakeId: id,
      intakeYear: year,

      // Basic profile
      name: intake.animalName || "Unknown",
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

      // Medical baseline from intake
      initialCondition: intake.condition || "",
      initialWeight: intake.weight || null,
      weight: intake.weight || null,
      injuries: intake.injuries || "Unknown",
      vaccinated: intake.vaccinated || "Unknown",
      conditionNotes: intake.conditionNotes || "",

      // References
      surrenderRefId: intake.surrenderRefId || null,
      barangayDetails: intake.barangayDetails || null,

      // Lifecycle
      status: "Profiling",
      currentStage: "profiling",
      photoURL: null,

      // Behavioral
      behavioralAssessment: null,
      behavioralNotes: "",
      behavioralAssessor: "",
      behavioralDate: "",
      compatibilityVector: [],

      // Medical records
      medicalRecords: [],

      // Adoption fields
      adoptionDate: "",
      adopterName: "",
      adoptionStaff: "",

      // General notes
      notes: "",

      // Timeline / history
      history: [
        {
          date: intake.intakeDate || today,
          event: "Intake recorded",
          detail: `${intake.source || "Unknown source"} intake`,
          actor: intake.encodedBy || "Staff",
        },
        {
          date: today,
          event: "Converted to profile",
          detail: `Intake ${id} converted to animal profile`,
          actor,
        }
      ],

      // Metadata
      intakedBy: intake.encodedBy || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: req.user?.email || "",
    };

    // Batch write: create animal profile + update intake record
    const batch = db.batch();

    batch.set(db.collection(ANIMAL_COL).doc(animalId), animalProfile);

    batch.update(db.collection(INTAKE_COL).doc(id), {
      status: "Converted",
      animalProfileId: animalId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user?.email || "",
    });

    await batch.commit();

    await writeAuditLog({
      action: "intake.converted",
      module: "Intake Management",
      targetId: id,
      targetName: intake.animalName || "Unknown",
      performedBy: req.user?.email,
      performedByName: req.user?.fullName,
      before: { status: "Approved" },
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