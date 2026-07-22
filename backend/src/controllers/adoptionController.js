const { db, admin } = require("../config/firebase");

const ADOPTION_COL = "adoptions";
const ANIMAL_COL = "animals";

exports.createAdoption = async (req, res) => {
  try {
    const {
      pet_id,
      pet_name,
      compatibility,
      full_name,
      age,
      birthdate,
      address,
      civil_status,
      gender,
      citizenship,
      contact_number,
      occupation,
      spouse_name,
      children_names,
      why_adopt,
      visit_veterinarian,
      existing_pets,
      issued_day,
      issued_month,
      issued_year,
      signature_name,
    } = req.body;

    if (!pet_id) {
      return res.status(400).json({ message: "Pet ID is required." });
    }

    const animalDoc = await db.collection("animals").doc(pet_id).get();
    if (!animalDoc.exists) {
      return res.status(404).json({ message: "Selected pet was not found." });
    }

    const year = new Date().getFullYear();

    const countSnap = await db.collection("adoptions")
      .where("applicationYear", "==", year)
      .get();

    const seq = String(countSnap.size + 1).padStart(3, "0");
    const applicationId = `APP-${year}-${seq}`;

    const adoptionData = {
      applicationId,
      applicationYear: year,

      pet_id,
      pet_name,
      compatibility: compatibility
        ? {
            source: "quiz", // optional but recommended
            matchPercent: compatibility.matchPercent ?? null,
            preferences: compatibility.preferences ?? {},
            filters: compatibility.filters ?? {},
            matchedAt: compatibility.matchedAt ?? null
          }
        : null,

      applicant: {
        full_name: full_name || "",
        age: age || "",
        birthdate: birthdate || "",
        address: address || "",
        civil_status: civil_status || "",
        gender: gender || "",
        citizenship: citizenship || "",
        contact_number: contact_number || "",
        occupation: occupation || "",
        spouse_name: spouse_name || "",
        children_names: children_names || "",
      },

      other_information: {
        why_adopt: why_adopt || "",
        visit_veterinarian: visit_veterinarian || "",
        existing_pets: existing_pets || "",
      },

      declaration: {
        issued_day: issued_day || "",
        issued_month: issued_month || "",
        issued_year: issued_year || "",
        signature_name: signature_name || "",
      },

      status: "Pending",
      rejectedReason: "",
      approvedAt: null,
      approvedBy: "",
      adoptionDate: "",
      processedBy: "",
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("adoptions").add(adoptionData);

    res.status(201).json({
      message: "Adoption request submitted successfully.",
      adoptionId: docRef.id,
      applicationId,
    });
  } catch (error) {
    console.error("[createAdoption]", error.message);
    res.status(500).json({
      message: "Failed to submit adoption request.",
    });
  }
};

exports.getAllAdoptions = async (req, res) => {
  try {
    const { status } = req.query;

    const snapshot = await db.collection(ADOPTION_COL).get();

    let adoptions = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();

        let animal = {
          id: data.pet_id || "",
          name: data.pet_name || "Unknown",
          species: "Unknown",
          breed: "Unknown",
          status: "",
          compatibilityVector: [],
        };

        if (data.pet_id) {
          try {
            const animalDoc = await db.collection(ANIMAL_COL).doc(data.pet_id).get();

            if (animalDoc.exists) {
              const animalData = animalDoc.data();

              animal = {
                id: animalDoc.id,
                name: animalData.name || data.pet_name || "Unknown",
                species: animalData.species || "Unknown",
                breed: animalData.breed || "Unknown",
                status: animalData.status || "",
                compatibilityVector: animalData.compatibilityVector || [],
              };
            }
          } catch (animalErr) {
            console.error("[getAllAdoptions animal lookup]", animalErr.message);
          }
        }

        return {
          id: doc.id,
          applicationId: data.applicationId || doc.id,
          pet_id: data.pet_id || "",
          pet_name: data.pet_name || "Unknown",
          animal,
          applicant: data.applicant || {},
          other_information: data.other_information || {},
          declaration: data.declaration || {},
          compatibility: data.compatibility || null,
          status: data.status || "Pending",
          rejectedReason: data.rejectedReason || "",
          approvedAt: data.approvedAt || null,
          approvedBy: data.approvedBy || "",
          adoptionDate: data.adoptionDate || "",
          processedBy: data.processedBy || "",
          submittedAt: data.submittedAt || null,
          updatedAt: data.updatedAt || null,
        };
      })
    );

    if (status) {
      adoptions = adoptions.filter((item) => item.status === status);
    }

    adoptions.sort((x, y) => {
      const xSec = x.submittedAt?._seconds || x.submittedAt?.seconds || 0;
      const ySec = y.submittedAt?._seconds || y.submittedAt?.seconds || 0;
      return ySec - xSec;
    });

    const summary = {
      total: adoptions.length,
      pending: adoptions.filter((item) => item.status === "Pending").length,
      approved: adoptions.filter((item) => item.status === "Approved").length,
      finalized: adoptions.filter((item) => item.status === "Finalized").length,
      rejected: adoptions.filter((item) => item.status === "Rejected").length,
    };

    res.status(200).json({ adoptions, summary });
  } catch (error) {
    console.error("[getAllAdoptions]", error.message);
    res.status(500).json({
      message: "Failed to fetch adoption requests.",
    });
  }
};

exports.getAdoptionById = async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await db.collection(ADOPTION_COL).doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        message: "Adoption request not found.",
      });
    }

    const data = doc.data();

    const adoption = {
      id: doc.id,
      pet_id: data.pet_id || "",
      pet_name: data.pet_name || "Unknown",
      applicant: data.applicant || {},
      other_information: data.other_information || {},
      declaration: data.declaration || {},
      compatibility: data.compatibility || null,
      status: data.status || "Pending",
      rejectedReason: data.rejectedReason || "",
      approvedAt: data.approvedAt || null,
      approvedBy: data.approvedBy || "",
      adoptionDate: data.adoptionDate || "",
      processedBy: data.processedBy || "",
      submittedAt: data.submittedAt || null,
      updatedAt: data.updatedAt || null,
    };

    res.status(200).json({ adoption });
  } catch (error) {
    console.error("[getAdoptionById]", error.message);
    res.status(500).json({
      message: "Failed to fetch adoption request.",
    });
  }
};

exports.approveAdoption = async (req, res) => {
  try {
    const { id } = req.params;

    const adoptionRef = db.collection(ADOPTION_COL).doc(id);
    const doc = await adoptionRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        message: "Adoption request not found.",
      });
    }

    const data = doc.data();

    if (data.status === "Rejected") {
      return res.status(400).json({
        message: "Rejected applications cannot be approved.",
      });
    }

    if (data.status === "Finalized") {
      return res.status(400).json({
        message: "Finalized applications cannot be approved again.",
      });
    }

    await adoptionRef.update({
      status: "Approved",
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      approvedBy: req.user?.email || "Admin",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      message: "Adoption request approved.",
    });
  } catch (error) {
    console.error("[approveAdoption]", error.message);
    res.status(500).json({
      message: "Failed to approve adoption request.",
    });
  }
};

exports.rejectAdoption = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        message: "Rejection reason is required.",
      });
    }

    const adoptionRef = db.collection(ADOPTION_COL).doc(id);
    const doc = await adoptionRef.get();

    if (!doc.exists) {
      return res.status(404).json({
        message: "Adoption request not found.",
      });
    }

    const data = doc.data();

    if (data.status === "Finalized") {
      return res.status(400).json({
        message: "Finalized applications cannot be rejected.",
      });
    }

    await adoptionRef.update({
      status: "Rejected",
      rejectedReason: reason.trim(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      message: "Adoption request rejected.",
    });
  } catch (error) {
    console.error("[rejectAdoption]", error.message);
    res.status(500).json({
      message: "Failed to reject adoption request.",
    });
  }
};

exports.finalizeAdoption = async (req, res) => {
  try {
    const { id } = req.params;
    const { adoptionDate, processedBy } = req.body;

    const adoptionRef = db.collection(ADOPTION_COL).doc(id);
    const adoptionDoc = await adoptionRef.get();

    if (!adoptionDoc.exists) {
      return res.status(404).json({
        message: "Adoption request not found.",
      });
    }

    const adoptionData = adoptionDoc.data();

    if (adoptionData.status !== "Approved") {
      return res.status(400).json({
        message: "Only approved applications can be finalized.",
      });
    }

    const animalRef = db.collection(ANIMAL_COL).doc(adoptionData.pet_id);
    const animalDoc = await animalRef.get();

    if (!animalDoc.exists) {
      return res.status(404).json({
        message: "Related animal not found.",
      });
    }

    const animalData = animalDoc.data();

    if (animalData.status !== "Ready") {
      return res.status(400).json({
        message: "Only animals marked Ready can be finalized for adoption.",
      });
    }

    const finalAdoptionDate = adoptionDate || new Date().toISOString().split("T")[0];
    const finalProcessedBy = processedBy || req.user?.email || "Admin";

    const batch = db.batch();

    batch.update(adoptionRef, {
      status: "Finalized",
      adoptionDate: finalAdoptionDate,
      processedBy: finalProcessedBy,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batch.update(animalRef, {
    status: "Adopted",
    currentStage: "adopted",
    visibleToPublic: false,
    adoptionStatus: "Adopted",
    adoptionDate: finalAdoptionDate,
    adopterName: adoptionData.applicant?.full_name || "",
    adoptionStaff: finalProcessedBy,
    processedBy: finalProcessedBy,
    adoptionApplicationId: id,
    history: admin.firestore.FieldValue.arrayUnion({
      date: finalAdoptionDate,
      event: "Adopted",
      detail: `Adopted by ${adoptionData.applicant?.full_name || "Unknown adopter"}`,
      actor: finalProcessedBy,
    }),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: req.user?.email || "Admin",
  });

    await batch.commit();

    res.status(200).json({
      message: "Adoption finalized successfully.",
    });
  } catch (error) {
    console.error("[finalizeAdoption]", error.message);
    res.status(500).json({
      message: "Failed to finalize adoption.",
    });
  }
};