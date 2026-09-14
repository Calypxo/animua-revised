const crypto = require("crypto");
const { db, admin } = require("../config/firebase");
const {
  buildShelterLabel,
  cleanText,
} = require("../utils/animalIdentity");
const { getSignedReadUrl } = require("../services/storageUrlService");

const ADOPTION_COL = "adoptions";
const ANIMAL_COL = "animals";
const SHELTER_LOCATION = "Angeles City Veterinary Office, Brgy. Pampang, Angeles City";
const MAX_PICKUP_RESCHEDULES = 1;
const {
  buildApprovalDeadlineFields,
  reconcileRequestDeadlines,
  validateScheduleDate,
} = require("../services/requestDeadlineService");
const { createUserNotification, createManagementNotification } = require("../services/notificationService");
const {
  getAdoptionFinalizationError,
} = require("../services/adoptionWorkflowService");

function normalizeApplicantIdentifier(value) {
  return String(value || "").trim().toLowerCase();
}

function adoptionBelongsToApplicant(adoption = {}, user = {}) {
  const applicantIdentifiers = new Set([
    normalizeApplicantIdentifier(user.id),
    normalizeApplicantIdentifier(user.email),
  ].filter(Boolean));
  const recordedIdentifiers = [
    adoption.applicant?.email,
    adoption.account?.email,
    adoption.submission_metadata?.applicant_account_id,
  ].map(normalizeApplicantIdentifier).filter(Boolean);
  return recordedIdentifiers.some((identifier) => applicantIdentifiers.has(identifier));
}

function adoptionSubmissionDocumentId(user = {}, petId = "") {
  const applicantIdentifier = normalizeApplicantIdentifier(user.id || user.email);
  return `user_pet_${crypto
    .createHash("sha256")
    .update(`${applicantIdentifier}:${String(petId).trim()}`)
    .digest("hex")}`;
}

function isAlreadyExistingDocumentError(error) {
  return error?.code === 6 ||
    error?.code === "already-exists" ||
    error?.code === "ALREADY_EXISTS";
}

function getPickupRescheduleCount(schedule = {}) {
  const explicitCount = Number(schedule.rescheduleCount || 0);
  return explicitCount > 0 ? explicitCount : schedule.rescheduledAt ? 1 : 0;
}

function pickupScheduleError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function buildRescheduledPickup(existingSchedule, { date, time, changedAt, changedBy }) {
  const rescheduleCount = getPickupRescheduleCount(existingSchedule) + 1;
  const previousSchedule = {
    date: existingSchedule.date || "",
    time: existingSchedule.time || "",
    location: existingSchedule.location || SHELTER_LOCATION,
    scheduledAt: existingSchedule.scheduledAt || null,
  };
  const historyEntry = {
    number: rescheduleCount,
    from: previousSchedule,
    to: {
      date,
      time,
      location: SHELTER_LOCATION,
    },
    changedAt,
    changedBy,
  };

  return {
    date,
    time,
    location: SHELTER_LOCATION,
    scheduledAt: existingSchedule.scheduledAt || changedAt,
    rescheduledAt: changedAt,
    rescheduledBy: changedBy,
    rescheduleCount,
    previousSchedule,
    rescheduleHistory: [
      ...(Array.isArray(existingSchedule.rescheduleHistory)
        ? existingSchedule.rescheduleHistory
        : []),
      historyEntry,
    ],
  };
}

async function applyLegacyPendingPickupReschedule(adoptionRef, data) {
  const request = data.pickupRescheduleRequest || {};
  const existingSchedule = data.pickupSchedule || {};
  if (
    String(request.status || "").toLowerCase() !== "pending" ||
    !request.date ||
    !request.time ||
    (!existingSchedule.date && !existingSchedule.time)
  ) {
    return data;
  }

  if (getPickupRescheduleCount(existingSchedule) >= MAX_PICKUP_RESCHEDULES) {
    const rejectedRequest = {
      ...request,
      status: "Rejected",
      reviewedAt: new Date().toISOString(),
      reviewedBy: "system:reschedule-limit",
      rejectedReason: "Pickup can only be rescheduled once.",
    };
    await adoptionRef.update({
      pickupRescheduleRequest: rejectedRequest,
      deadlineStatus: "Appointment Scheduled",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {
      ...data,
      pickupRescheduleRequest: rejectedRequest,
      deadlineStatus: "Appointment Scheduled",
    };
  }

  const changedAt = request.requestedAt || new Date().toISOString();
  const pickupSchedule = buildRescheduledPickup(existingSchedule, {
    date: request.date,
    time: request.time,
    changedAt,
    changedBy: request.requestedBy || "Legacy reschedule",
  });
  const normalized = {
    ...data,
    pickupSchedule,
    pickupRescheduleRequest: null,
    deadlineStatus: "Appointment Scheduled",
    noShowRisk: false,
  };

  await adoptionRef.update({
    pickupSchedule,
    pickupRescheduleRequest: null,
    deadlineStatus: "Appointment Scheduled",
    noShowRisk: false,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return normalized;
}

exports.createAdoption = async (req, res) => {
  try {
    const {
      pet_id,
      pet_age,
      pet_sex,
      pet_type,
      pet_status,
      application_reference,
      submission_timestamp,
      applicant_account_id,
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
      has_current_pets,
      number_of_pets,
      current_pet_type,
      housing_type,
      residence_allows_pets,
      why_adopt,
      visit_veterinarian,
      vet_clinic_name,
      existing_pets,
      primary_caregiver,
      pet_stay_location,
      hours_alone,
      provide_vet_care,
      provide_daily_care,
      cannot_care_plan,
      additional_info,
      id_front_upload,
      id_back_upload,
      confirm_truthful,
      agree_declaration,
      understand_no_guarantee,
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

    const existingForPet = await db.collection(ADOPTION_COL)
      .where("pet_id", "==", pet_id)
      .get();
    const existingApplication = (existingForPet.docs || []).find((doc) =>
      adoptionBelongsToApplicant(doc.data() || {}, req.user)
    );
    if (existingApplication) {
      return res.status(409).json({
        code: "DUPLICATE_ADOPTION_APPLICATION",
        message: "You already submitted an adoption application for this pet.",
        applicationId: existingApplication.data()?.applicationId || "",
      });
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
      pet_name: petLabel,
      pet_label: petLabel,
      selected_pet: {
        id: pet_id,
        name: petLabel,
        requestedName: req.body.pet_name || "",
        age: pet_age || "",
        sex: pet_sex || "",
        type: pet_type || "",
        status: pet_status || animalData.status || "",
      },
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

      household_information: {
        spouse_name: spouse_name || "",
        children_names: children_names || "",
        has_current_pets: has_current_pets || "",
        number_of_pets: number_of_pets || "",
        current_pet_type: current_pet_type || "",
        visit_veterinarian: visit_veterinarian || "",
        vet_clinic_name: vet_clinic_name || "",
        housing_type: housing_type || "",
        residence_allows_pets: residence_allows_pets || "",
      },

      adoption_readiness: {
        why_adopt: why_adopt || "",
        primary_caregiver: primary_caregiver || "",
        pet_stay_location: pet_stay_location || "",
        hours_alone: hours_alone || "",
        provide_vet_care: provide_vet_care || "",
        provide_daily_care: provide_daily_care || "",
        cannot_care_plan: cannot_care_plan || "",
        additional_info: additional_info || "",
      },

      declaration: {
        issued_day: issued_day || "",
        issued_month: issued_month || "",
        issued_year: issued_year || "",
        signature_name: signature_name || "",
        confirm_truthful: Boolean(confirm_truthful),
        agree_declaration: Boolean(agree_declaration),
        understand_no_guarantee: Boolean(understand_no_guarantee),
        declaration_text:
          "I solemnly declare that I will take proper care of the animal I am applying to adopt. I will provide appropriate food, shelter, veterinary care, regular checkups, and vaccinations. I will not allow the animal to roam unattended or be neglected.",
      },

      identity_verification: {
        front: id_front_upload || null,
        back: id_back_upload || null,
        privacy_notice:
          "Your ID will be used only to verify your identity and support the shelter's adoption review. It will not be displayed publicly.",
      },

      submission_metadata: {
        client_reference: application_reference || "",
        client_submitted_at: submission_timestamp || "",
        applicant_account_id: applicant_account_id || req.user?.uid || req.user?.email || "",
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

    const docRef = db.collection(ADOPTION_COL).doc(
      adoptionSubmissionDocumentId(req.user, pet_id)
    );
    try {
      await docRef.create(adoptionData);
    } catch (error) {
      if (isAlreadyExistingDocumentError(error)) {
        return res.status(409).json({
          code: "DUPLICATE_ADOPTION_APPLICATION",
          message: "You already submitted an adoption application for this pet.",
        });
      }
      throw error;
    }
    await createManagementNotification({
      type: "adoption_application_created",
      resourceType: "adoption_application",
      relatedResourceId: docRef.id,
      title: "New adoption application received",
      message: `${full_name || "A public user"} applied to adopt ${petLabel}.`,
      metadata: { applicationId, animalId: pet_id },
    }).catch((error) => console.warn("[createAdoption notification]", error.message));

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
    await reconcileRequestDeadlines("adoption");
    const { status } = req.query;

    const snapshot = await db.collection(ADOPTION_COL).get();

    let adoptions = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = await applyLegacyPendingPickupReschedule(doc.ref, doc.data() || {});

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
          attendanceDeadlineAt: data.attendanceDeadlineAt || null,
          deadlineStatus: data.deadlineStatus || "",
          deadlineReminderStage: data.deadlineReminderStage || "",
          noShowRisk: data.noShowRisk === true,
          arrivalConfirmedAt: data.arrivalConfirmedAt || null,
          expiredAt: data.expiredAt || null,
          expirationReason: data.expirationReason || "",
          deadlineExtensions: data.deadlineExtensions || [],
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
    await reconcileRequestDeadlines("adoption");
    const email = String(req.user?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(401).json({
        message: "Please sign in to view your adoption applications.",
      });
    }

    const snapshot = await db.collection(ADOPTION_COL).get();

    const normalizedAdoptionDocs = await Promise.all(
      snapshot.docs.map(async (doc) => ({
        id: doc.id,
        data: await applyLegacyPendingPickupReschedule(doc.ref, doc.data() || {}),
      }))
    );

    const adoptions = await Promise.all(
      normalizedAdoptionDocs
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
                const imageUrl = await getSignedReadUrl({
                  path: animalData.photoPath,
                  legacyUrl:
                    animalData.imageUrl ||
                    animalData.photoURL ||
                    animalData.profileImageUrl ||
                    animalData.photoUrl ||
                    "",
                  expectedPrefix: `animals/${animalDoc.id}`,
                });
                animal = {
                  id: animalDoc.id,
                  name: buildShelterLabel(animalData, animalDoc.id),
                  species: animalData.species || "",
                  sex: animalData.sex || animalData.gender || "",
                  age: animalData.age || "",
                  imageUrl,
                  photoURL: imageUrl,
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
            attendanceDeadlineAt: data.attendanceDeadlineAt || null,
            deadlineStatus: data.deadlineStatus || "",
            deadlineReminderStage: data.deadlineReminderStage || "",
            noShowRisk: data.noShowRisk === true,
            arrivalConfirmedAt: data.arrivalConfirmedAt || null,
            expiredAt: data.expiredAt || null,
            expirationReason: data.expirationReason || "",
            deadlineExtensions: data.deadlineExtensions || [],
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

    let data = adoptionDoc.data() || {};
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

    if (String(data.status || "").toLowerCase() !== "approved") {
      return res.status(400).json({
        message: "Only approved applications can schedule a pickup.",
      });
    }

    if (data.arrivalConfirmedAt) {
      return res.status(400).json({
        message: "Pickup attendance has already been confirmed and can no longer be rescheduled.",
      });
    }

    data = await applyLegacyPendingPickupReschedule(adoptionRef, data);

    if (!validateScheduleDate(data, date)) {
      return res.status(400).json({
        message: "Pickup date must be today or later and within the 14-day attendance deadline.",
      });
    }

    const scheduleResult = await db.runTransaction(async (transaction) => {
      const currentDoc = await transaction.get(adoptionRef);
      if (!currentDoc.exists) {
        throw pickupScheduleError(404, "Adoption application not found.");
      }

      const currentData = currentDoc.data() || {};
      const currentApplicantEmail = String(
        currentData.account?.email ||
        currentData.applicant?.email ||
        currentData.userEmail ||
        ""
      ).trim().toLowerCase();
      if (currentApplicantEmail !== email) {
        throw pickupScheduleError(403, "You can only schedule your own adoption pickup.");
      }
      if (String(currentData.status || "").toLowerCase() !== "approved") {
        throw pickupScheduleError(400, "Only approved applications can schedule a pickup.");
      }
      if (currentData.arrivalConfirmedAt) {
        throw pickupScheduleError(
          400,
          "Pickup attendance has already been confirmed and can no longer be rescheduled."
        );
      }
      if (!validateScheduleDate(currentData, date)) {
        throw pickupScheduleError(
          400,
          "Pickup date must be today or later and within the 14-day attendance deadline."
        );
      }

      const existingSchedule = currentData.pickupSchedule || null;
      const alreadyScheduled = Boolean(existingSchedule?.date || existingSchedule?.time);
      const now = new Date().toISOString();
      let pickupSchedule;

      if (alreadyScheduled) {
        const rescheduleCount = getPickupRescheduleCount(existingSchedule);
        if (rescheduleCount >= MAX_PICKUP_RESCHEDULES) {
          throw pickupScheduleError(400, "Pickup can only be rescheduled once.");
        }
        pickupSchedule = buildRescheduledPickup(existingSchedule, {
          date,
          time,
          changedAt: now,
          changedBy: email,
        });
      } else {
        pickupSchedule = {
          date,
          time,
          location: SHELTER_LOCATION,
          scheduledAt: now,
        };
      }

      transaction.update(adoptionRef, {
        pickupSchedule,
        pickupRescheduleRequest: null,
        deadlineStatus: "Appointment Scheduled",
        noShowRisk: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { pickupSchedule, isReschedule: alreadyScheduled };
    });

    const updatedDoc = await adoptionRef.get();

    if (scheduleResult.isReschedule) {
      const { pickupSchedule } = scheduleResult;
      return res.status(200).json({
        message: "Pickup rescheduled successfully. This is your final pickup schedule.",
        finalReschedule: true,
        reschedulesRemaining: Math.max(0, MAX_PICKUP_RESCHEDULES - pickupSchedule.rescheduleCount),
        request: updatedDoc.data(),
        pickupSchedule,
      });
    }

    res.status(200).json({
      message: "Pickup schedule saved.",
      request: updatedDoc.data(),
      pickupSchedule: scheduleResult.pickupSchedule,
    });
  } catch (error) {
    console.error("[scheduleMyAdoptionPickup]", error.message);
    res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Failed to save pickup schedule.",
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

    if (!validateScheduleDate(data, request.date)) {
      return res.status(400).json({
        message: "The requested pickup date is outside the active 14-day attendance deadline.",
      });
    }

    const existingSchedule = data.pickupSchedule || {};
    if (getPickupRescheduleCount(existingSchedule) >= MAX_PICKUP_RESCHEDULES) {
      return res.status(400).json({
        message: "Pickup can only be rescheduled once.",
      });
    }

    const now = new Date().toISOString();
    const pickupSchedule = buildRescheduledPickup(existingSchedule, {
      date: request.date,
      time: request.time,
      changedAt: now,
      changedBy: req.user?.email || "Admin",
    });

    await adoptionRef.update({
      pickupSchedule,
      "pickupRescheduleRequest.status": "Approved",
      "pickupRescheduleRequest.reviewedAt": now,
      "pickupRescheduleRequest.reviewedBy": req.user?.email || "Admin",
      deadlineStatus: "Appointment Scheduled",
      noShowRisk: false,
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
      attendanceDeadlineAt: data.attendanceDeadlineAt || null,
      deadlineStatus: data.deadlineStatus || "",
      deadlineReminderStage: data.deadlineReminderStage || "",
      noShowRisk: data.noShowRisk === true,
      arrivalConfirmedAt: data.arrivalConfirmedAt || null,
      expiredAt: data.expiredAt || null,
      expirationReason: data.expirationReason || "",
      deadlineExtensions: data.deadlineExtensions || [],
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

    const now = new Date();
    await adoptionRef.update({
      status: "Approved",
      ...buildApprovalDeadlineFields(now),
      approvedBy: req.user?.email || "Admin",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await createUserNotification({
      userEmail: data.applicant?.email || data.account?.email || data.userEmail,
      category: "application",
      type: "adoption_approved",
      title: "Adoption application approved",
      message: `Your adoption application for ${data.pet_label || data.pet_name || "a pet"} was approved.`,
      link: "/pages/public/my-submissions.html",
      referenceId: id,
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
    const normalizedReason = String(reason || "").trim();

    if (normalizedReason.length < 5) {
      return res.status(400).json({
        message: "A clear rejection reason using at least 5 characters is required.",
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
      rejectedReason: normalizedReason,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await createUserNotification({
      userEmail: data.applicant?.email || data.account?.email || data.userEmail,
      category: "application",
      type: "adoption_rejected",
      title: "Adoption application update",
      message: `Your adoption application for ${data.pet_label || data.pet_name || "a pet"} was not approved. View My Submissions to see the shelter's reason.`,
      link: "/pages/public/my-submissions.html",
      referenceId: id,
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

    const finalizationError = getAdoptionFinalizationError(adoptionData);
    if (finalizationError) {
      return res.status(400).json({
        message: finalizationError,
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
      deadlineStatus: "Completed",
      deadlineReminderStage: "Completed",
      noShowRisk: false,
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

    await createUserNotification({
      userEmail: adoptionData.applicant?.email || adoptionData.account?.email || adoptionData.userEmail,
      category: "application",
      type: "adoption_finalized",
      title: "Adoption finalized",
      message: `${finalAdoptedName} has been finalized for adoption.`,
      link: "/pages/public/my-submissions.html",
      referenceId: id,
    });

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
