const { db, admin } = require("../config/firebase");
const {
  buildShelterLabel,
  cleanText,
} = require("../utils/animalIdentity");

const ADOPTION_COL = "adoptions";
const ANIMAL_COL = "animals";
const SHELTER_LOCATION = "Angeles City Veterinary Office, Brgy. Pampang, Angeles City";

exports.createAdoption = async (req, res) => {
  try {
    const {
      pet_id,
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
    const animalData = animalDoc.data();
    if (animalData.status !== "Ready") {
      return res.status(400).json({
        message: "Only animals marked Ready can receive adoption applications.",
      });
    }
    const petLabel = buildShelterLabel(animalData, pet_id);

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
      pet_name: petLabel,
      pet_label: petLabel,
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
        email: req.user?.email || "",
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

      account: req.user?.email
        ? {
            email: req.user.email,
            name: req.user.fullName || full_name || "User",
            role: req.user.role || "Public",
          }
        : null,

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
          name:
            data.pet_label ||
            data.pet_name ||
            `Animal ${data.pet_id || doc.id}`,
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
                name: buildShelterLabel(animalData, animalDoc.id),
                shelterLabel:
                  buildShelterLabel(animalData, animalDoc.id),
                adoptedName: animalData.adoptedName || "",
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
          pet_name:
            data.pet_label || data.pet_name || "Unknown",
          pet_label:
            data.pet_label || data.pet_name || "Unknown",
          adoptedName: data.adoptedName || "",
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
          pickupSchedule: data.pickupSchedule || null,
          pickupRescheduleRequest: data.pickupRescheduleRequest || null,
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

exports.getMyAdoptions = async (req, res) => {
  try {
    const email = String(req.user?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(401).json({
        message: "Please sign in to view your adoption applications.",
      });
    }

    const snapshot = await db.collection(ADOPTION_COL).get();

    const adoptions = await Promise.all(
      snapshot.docs
        .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
        .filter(({ data }) => {
          const applicantEmail = String(
            data.account?.email ||
            data.applicant?.email ||
            data.userEmail ||
            ""
          )
            .trim()
            .toLowerCase();

          return applicantEmail === email;
        })
        .map(async ({ id, data }) => {
          let animal = null;

          if (data.pet_id) {
            try {
              const animalDoc = await db.collection(ANIMAL_COL).doc(data.pet_id).get();

              if (animalDoc.exists) {
                const animalData = animalDoc.data() || {};
                animal = {
                  id: animalDoc.id,
                  name: buildShelterLabel(animalData, animalDoc.id),
                  species: animalData.species || "",
                  sex: animalData.sex || animalData.gender || "",
                  age: animalData.age || "",
                  imageUrl:
                    animalData.imageUrl ||
                    animalData.profileImageUrl ||
                    animalData.photoUrl ||
                    "",
                };
              }
            } catch (animalErr) {
              console.error("[getMyAdoptions animal lookup]", animalErr.message);
            }
          }

          return {
            id,
            applicationId: data.applicationId || id,
            pet_id: data.pet_id || "",
            pet_name: data.pet_label || data.pet_name || animal?.name || "Animal",
            animal,
            applicant: data.applicant || {},
            account: data.account || {},
            other_information: data.other_information || {},
            declaration: data.declaration || {},
            compatibility: data.compatibility || null,
            status: data.status || "Pending",
            rejectedReason: data.rejectedReason || "",
            approvedAt: data.approvedAt || null,
            adoptionDate: data.adoptionDate || "",
            pickupSchedule: data.pickupSchedule || null,
            pickupRescheduleRequest: data.pickupRescheduleRequest || null,
            submittedAt: data.submittedAt || null,
            updatedAt: data.updatedAt || null,
          };
        })
    );

    adoptions.sort((x, y) => {
      const xSec = x.submittedAt?._seconds || x.submittedAt?.seconds || 0;
      const ySec = y.submittedAt?._seconds || y.submittedAt?.seconds || 0;
      return ySec - xSec;
    });

    res.status(200).json({
      adoptions,
    });
  } catch (error) {
    console.error("[getMyAdoptions]", error.message);
    res.status(500).json({
      message: "Failed to load your adoption applications.",
    });
  }
};

exports.scheduleMyAdoptionPickup = async (req, res) => {
  try {
    const email = String(req.user?.email || "").trim().toLowerCase();
    const { id } = req.params;
    const { date, time } = req.body || {};

    if (!email) {
      return res.status(401).json({
        message: "Please sign in to schedule your pickup.",
      });
    }

    if (!date || !time) {
      return res.status(400).json({
        message: "Pickup date and time are required.",
      });
    }

    const adoptionRef = db.collection(ADOPTION_COL).doc(id);
    const adoptionDoc = await adoptionRef.get();

    if (!adoptionDoc.exists) {
      return res.status(404).json({
        message: "Adoption application not found.",
      });
    }

    const data = adoptionDoc.data() || {};
    const applicantEmail = String(
      data.account?.email ||
      data.applicant?.email ||
      data.userEmail ||
      ""
    )
      .trim()
      .toLowerCase();

    if (applicantEmail !== email) {
      return res.status(403).json({
        message: "You can only schedule your own adoption pickup.",
      });
    }

    if (!["approved", "finalized"].includes(String(data.status || "").toLowerCase())) {
      return res.status(400).json({
        message: "Only approved applications can schedule a pickup.",
      });
    }

    const existingSchedule = data.pickupSchedule || null;
    const alreadyScheduled = Boolean(existingSchedule?.date || existingSchedule?.time);
    const now = new Date().toISOString();

    if (alreadyScheduled) {
      const pickupRescheduleRequest = {
        date,
        time,
        location: SHELTER_LOCATION,
        status: "Pending",
        requestedAt: now,
        requestedBy: email,
        previousSchedule: existingSchedule || {
          date: data.adoptionDate || "",
          time: "",
          location: SHELTER_LOCATION,
        },
      };

      await adoptionRef.update({
        pickupRescheduleRequest,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return res.status(200).json({
        message: "Pickup reschedule request sent for admin approval.",
        requiresApproval: true,
        pickupRescheduleRequest,
      });
    }

    const pickupSchedule = {
      date,
      time,
      location: SHELTER_LOCATION,
      scheduledAt: now,
    };

    await adoptionRef.update({
      pickupSchedule,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      message: "Pickup schedule saved.",
      pickupSchedule,
    });
  } catch (error) {
    console.error("[scheduleMyAdoptionPickup]", error.message);
    res.status(500).json({
      message: "Failed to save pickup schedule.",
    });
  }
};

exports.approveAdoptionReschedule = async (req, res) => {
  try {
    const { id } = req.params;
    const adoptionRef = db.collection(ADOPTION_COL).doc(id);
    const adoptionDoc = await adoptionRef.get();

    if (!adoptionDoc.exists) {
      return res.status(404).json({
        message: "Adoption request not found.",
      });
    }

    const data = adoptionDoc.data() || {};
    const request = data.pickupRescheduleRequest || {};

    if (String(request.status || "").toLowerCase() !== "pending") {
      return res.status(400).json({
        message: "No pending pickup reschedule request found.",
      });
    }

    const now = new Date().toISOString();
    const pickupSchedule = {
      date: request.date,
      time: request.time,
      location: request.location || SHELTER_LOCATION,
      scheduledAt: data.pickupSchedule?.scheduledAt || now,
      rescheduledAt: now,
      approvedBy: req.user?.email || "Admin",
    };

    await adoptionRef.update({
      pickupSchedule,
      "pickupRescheduleRequest.status": "Approved",
      "pickupRescheduleRequest.reviewedAt": now,
      "pickupRescheduleRequest.reviewedBy": req.user?.email || "Admin",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      message: "Pickup reschedule approved.",
      pickupSchedule,
    });
  } catch (error) {
    console.error("[approveAdoptionReschedule]", error.message);
    res.status(500).json({
      message: "Failed to approve pickup reschedule.",
    });
  }
};

exports.rejectAdoptionReschedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const adoptionRef = db.collection(ADOPTION_COL).doc(id);
    const adoptionDoc = await adoptionRef.get();

    if (!adoptionDoc.exists) {
      return res.status(404).json({
        message: "Adoption request not found.",
      });
    }

    const request = adoptionDoc.data()?.pickupRescheduleRequest || {};

    if (String(request.status || "").toLowerCase() !== "pending") {
      return res.status(400).json({
        message: "No pending pickup reschedule request found.",
      });
    }

    await adoptionRef.update({
      "pickupRescheduleRequest.status": "Rejected",
      "pickupRescheduleRequest.rejectionReason": cleanText(reason),
      "pickupRescheduleRequest.reviewedAt": new Date().toISOString(),
      "pickupRescheduleRequest.reviewedBy": req.user?.email || "Admin",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      message: "Pickup reschedule rejected.",
    });
  } catch (error) {
    console.error("[rejectAdoptionReschedule]", error.message);
    res.status(500).json({
      message: "Failed to reject pickup reschedule.",
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
      pet_name:
        data.pet_label ||
        data.pet_name ||
        `Animal ${data.pet_id || doc.id}`,
      pet_label:
        data.pet_label ||
        data.pet_name ||
        `Animal ${data.pet_id || doc.id}`,
      adoptedName: data.adoptedName || "",
      applicant: data.applicant || {},
      other_information: data.other_information || {},
      declaration: data.declaration || {},
      compatibility: data.compatibility || null,
      status: data.status || "Pending",
      rejectedReason: data.rejectedReason || "",
      approvedAt: data.approvedAt || null,
      approvedBy: data.approvedBy || "",
      adoptionDate: data.adoptionDate || "",
      pickupSchedule: data.pickupSchedule || null,
      pickupRescheduleRequest: data.pickupRescheduleRequest || null,
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
    const { adoptionDate, processedBy, adoptedName } = req.body;
    const finalAdoptedName = cleanText(adoptedName);

    if (
      finalAdoptedName.length < 2 ||
      finalAdoptedName.length > 60
    ) {
      return res.status(400).json({
        message:
          "The adopter-given animal name must be between 2 and 60 characters.",
      });
    }

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
      adoptedName: finalAdoptedName,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    batch.update(animalRef, {
    status: "Adopted",
    currentStage: "adopted",
    visibleToPublic: false,
    adoptionStatus: "Adopted",
    adoptionDate: finalAdoptionDate,
    name: finalAdoptedName,
    adoptedName: finalAdoptedName,
    nameAssignedBy:
      adoptionData.applicant?.full_name || "",
    nameAssignedAt: finalAdoptionDate,
    adopterName: adoptionData.applicant?.full_name || "",
    adoptionStaff: finalProcessedBy,
    processedBy: finalProcessedBy,
    adoptionApplicationId: id,
    history: admin.firestore.FieldValue.arrayUnion({
      date: finalAdoptionDate,
      event: "Adopted",
      detail: `Adopted by ${adoptionData.applicant?.full_name || "Unknown adopter"} and named ${finalAdoptedName}`,
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
