const { db } = require("../config/firebase");
const { analyzeSurrenderReason } = require("../services/surrenderNlpService");
const {
  buildApprovalDeadlineFields,
  reconcileRequestDeadlines,
  validateScheduleDate,
} = require("../services/requestDeadlineService");
const {
  getSurrenderConversionError,
} = require("../services/surrenderWorkflowService");

const COLLECTION_NAME = "surrenderRequests";
const SETTINGS_COLLECTION_NAME = "surrenderSettings";
const AVAILABILITY_SETTINGS_ID = "requestAvailability";
const SHELTER_LOCATION = "Angeles City Veterinary Office, Brgy. Pampang, Angeles City";
<<<<<<< HEAD
const CLOSED_CAPACITY_MESSAGE =
  "The shelter is not accepting surrender requests right now because space or cages may be unavailable. Please check again later or contact the shelter for urgent concerns.";
=======
const SCHEDULE_WINDOW_DAYS = 14;
>>>>>>> origin/main

const MAX_SURRENDER_PHOTO_DATA_URL_LENGTH = 900000;

const ANGELES_BARANGAYS = [
  "Agapito del Rosario", "Amsic", "Anunas", "Balibago", "Capaya", "Claro M. Recto",
  "Cuayan", "Cutcut", "Cutud", "Lourdes Norte", "Lourdes Sur", "Lourdes Sur Este",
  "Malabanias", "Margot", "Mining", "Ninoy Aquino", "Pampang", "Pandan", "Plaridel",
  "Pulung Cacutud", "Pulung Maragul", "Pulungbulu", "Salapungan", "San Jose",
  "San Nicolas", "Santa Teresita", "Santa Trinidad", "Santo Cristo", "Santo Domingo",
  "Santo Rosario", "Sapalibutad", "Sapangbato", "Sergio Bernal", "Silangan",
  "Tabun", "Virgen Delos Remedios",
];

function isAdminOrStaff(user) {
  return user.role === "Admin" || user.role === "Staff";
}

function generateRequestId() {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `SR-${year}-${timestamp}`;
}

<<<<<<< HEAD
function getAvailabilitySettingsRef() {
  return db.collection(SETTINGS_COLLECTION_NAME).doc(AVAILABILITY_SETTINGS_ID);
}

async function readSurrenderAvailability() {
  const snapshot = await getAvailabilitySettingsRef().get();
  const data = snapshot.exists ? snapshot.data() || {} : {};
  return {
    acceptingRequests: data.acceptingRequests !== false,
    closedMessage: CLOSED_CAPACITY_MESSAGE,
    updatedAt: data.updatedAt || null,
  };
}

async function getSurrenderAvailability(_req, res) {
  try {
    return res.json({ availability: await readSurrenderAvailability() });
  } catch (error) {
    console.error("Get surrender availability error:", error);
    return res.status(500).json({
      message: "Failed to check whether surrender requests are available.",
      error: error.message,
    });
  }
=======
function parseScheduleDate(value) {
  if (!value) return null;
  if (value._seconds || value.seconds) {
    const seconds = Number(value._seconds || value.seconds);
    const date = new Date(seconds * 1000);
    date.setHours(0, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const text = String(value).trim();
  if (!text) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00`)
    : new Date(text);
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addScheduleWindowDays(date) {
  const maxDate = new Date(date);
  maxDate.setDate(maxDate.getDate() + SCHEDULE_WINDOW_DAYS);
  return maxDate;
>>>>>>> origin/main
}

async function updateSurrenderAvailability(req, res) {
  try {
    if (!isAdminOrStaff(req.user)) {
      return res.status(403).json({
        message: "Only Admin or Staff can manage surrender request availability.",
      });
    }
    const { acceptingRequests } = req.body || {};
    if (typeof acceptingRequests !== "boolean") {
      return res.status(400).json({
        message: "acceptingRequests must be true or false.",
      });
    }
    const updatedAt = new Date().toISOString();
    await getAvailabilitySettingsRef().set({
      acceptingRequests,
      updatedAt,
      updatedBy: {
        id: req.user.id || null,
        email: req.user.email || null,
        name: req.user.fullName || req.user.email || "Management user",
        role: req.user.role,
      },
    }, { merge: true });

<<<<<<< HEAD
    return res.json({
      message: acceptingRequests
        ? "Incoming surrender requests are now open."
        : "Incoming surrender requests are now paused.",
      availability: {
        acceptingRequests,
        closedMessage: CLOSED_CAPACITY_MESSAGE,
        updatedAt,
      },
    });
  } catch (error) {
    console.error("Update surrender availability error:", error);
    return res.status(500).json({
      message: "Failed to update surrender request availability.",
      error: error.message,
    });
=======
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = decisionDate > today ? decisionDate : today;
  const maxDate = addScheduleWindowDays(decisionDate);

  return scheduleDate >= minDate && scheduleDate <= maxDate;
}

async function analyzeSurrenderReason(reason) {
  const response = await fetch(PYTHON_SENTIMENT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reason,
    }),
  });

  if (!response.ok) {
    throw new Error("Python sentiment service failed.");
>>>>>>> origin/main
  }
}

async function createSurrenderRequest(req, res) {
  try {
    const availability = await readSurrenderAvailability();
    if (!availability.acceptingRequests) {
      return res.status(503).json({
        code: "SURRENDER_REQUESTS_CLOSED",
        message: availability.closedMessage,
        availability,
      });
    }

    const user = req.user;
    const body = req.body;

    const owner = body.owner || {};
    const pet = body.pet || {};
    const agreement = body.agreement || {};
    const surrenderReason = body.surrenderReason?.trim();

    if (!surrenderReason) {
      return res.status(400).json({
        message: "Surrender reason is required.",
      });
    }

    if (!owner.contact || !owner.address || !owner.barangay) {
      return res.status(400).json({
        message: "Contact number, address, and barangay are required.",
      });
    }

    if (!ANGELES_BARANGAYS.includes(owner.barangay) || owner.city !== "Angeles City") {
      return res.status(403).json({
        message: "Only residents of Angeles City can submit a surrender request.",
      });
    }

    if (!agreement.agreedToTerms) {
      return res.status(400).json({
        message: "You must agree to the surrender terms before submitting.",
      });
    }

    const photoDataUrl = typeof pet.photoDataUrl === "string" ? pet.photoDataUrl.trim() : "";
    if (
      photoDataUrl &&
      (
        photoDataUrl.length > MAX_SURRENDER_PHOTO_DATA_URL_LENGTH ||
        !/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(photoDataUrl)
      )
    ) {
      return res.status(400).json({
        message: "Animal photo must be a JPG, PNG, or WebP image under 650 KB.",
      });
    }

    const nlpResult = await analyzeSurrenderReason(surrenderReason);

    const requestId = body.id || generateRequestId();

    const surrenderRequest = {
      id: requestId,

      account: {
        email: user.email,
        name: user.fullName || body.account?.name || "User",
        role: user.role || "Public",
      },

      owner: {
        name: user.fullName || body.owner?.name || "User",
        email: user.email,
        contact: owner.contact,
        address: owner.address,
        barangay: owner.barangay,
        city: "Angeles City",
        isAngelesResident: true,
      },

      pet: {
        name: pet.name || "",
        species: pet.species || "",
        breed: pet.breed || "",
        age: pet.age || "",
        sex: pet.sex || "",
        colorMarkings: pet.colorMarkings || "",
        status: Array.isArray(pet.status) ? pet.status : [],
        vaccinationHistory: pet.vaccinationHistory || "",
        photoName: photoDataUrl ? String(pet.photoName || "").trim().slice(0, 160) : "",
        photoType: photoDataUrl ? String(pet.photoType || "").trim().slice(0, 80) : "",
        photoDataUrl,
      },

      surrenderReason,

      agreement: {
        agreedToTerms: true,
        agreedAt: agreement.agreedAt || new Date().toISOString(),
        agreementText:
          agreement.agreementText ||
          "Nabasa ko at sumasang-ayon ako sa lahat ng mga tuntunin at pahayag na nakasaad sa itaas.",
      },

      nlp: nlpResult,

      status: "Pending",
      source: "Public Form",

      submittedAt: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),

      reviewedBy: null,
      reviewedAt: null,
      reviewNotes: null,
      rejectedReason: null,
      intakeId: null,
      dropoffDate: null,
    };

    await db
      .collection(COLLECTION_NAME)
      .doc(requestId)
      .set(surrenderRequest);

    return res.status(201).json({
      message: "Surrender request submitted successfully.",
      request: surrenderRequest,
    });
  } catch (error) {
    console.error("Create surrender request error:", error);

    return res.status(500).json({
      message: "Failed to submit surrender request.",
      error: error.message,
    });
  }
}

async function getAllSurrenderRequests(req, res) {
  try {
    await reconcileRequestDeadlines("surrender");

    const snapshot = await db
      .collection(COLLECTION_NAME)
      .orderBy("createdAt", "desc")
      .get();

    const requests = snapshot.docs.map((doc) => doc.data());

    return res.json({
      requests,
    });
  } catch (error) {
    console.error("Get all surrender requests error:", error);

    return res.status(500).json({
      message: "Failed to load surrender requests.",
      error: error.message,
    });
  }
}

async function getMySurrenderRequests(req, res) {
  try {
    await reconcileRequestDeadlines("surrender");
    const snapshot = await db
      .collection(COLLECTION_NAME)
      .where("account.email", "==", req.user.email)
      .get();

    const requests = snapshot.docs
      .map((doc) => doc.data())
      .sort((a, b) => {
        const aTime = new Date(a.createdAt || a.submittedAt || 0).getTime();
        const bTime = new Date(b.createdAt || b.submittedAt || 0).getTime();
        return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
      });

    return res.json({
      requests,
    });
  } catch (error) {
    console.error("Get my surrender requests error:", error);

    return res.status(500).json({
      message: "Failed to load your surrender requests.",
      error: error.message,
    });
  }
}

async function updateSurrenderStatus(req, res) {
  try {
    if (!isAdminOrStaff(req.user)) {
      return res.status(403).json({
        message: "Only Admin or Staff can update surrender requests.",
      });
    }

    const { id } = req.params;
    const { status, reviewNotes, rejectedReason, dropoffDate, intakeId } = req.body;

    const allowedStatuses = ["Pending", "Approved", "Rejected", "Converted"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid surrender request status.",
      });
    }

    const requestRef = db.collection(COLLECTION_NAME).doc(id);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return res.status(404).json({
        message: "Surrender request not found.",
      });
    }

    const current = requestDoc.data();

    if (current.status === "Converted") {
      return res.status(400).json({
        message: "Converted surrender requests can no longer be updated.",
      });
    }

    if (current.status === "Rejected" && status !== "Rejected") {
      return res.status(400).json({
        message: "Rejected surrender requests cannot be changed back.",
      });
    }

    if (status === "Converted") {
      const conversionError = getSurrenderConversionError(current);
      if (conversionError) {
        return res.status(400).json({ message: conversionError });
      }
    }

    const updateData = {
      status,
      updatedAt: new Date().toISOString(),
      reviewedBy: req.user.fullName || req.user.email,
      reviewedAt: new Date().toISOString().split("T")[0],
    };

    if (status === "Approved" && current.status !== "Approved") {
      Object.assign(updateData, buildApprovalDeadlineFields(new Date()));
    }

    if (reviewNotes) {
      updateData.reviewNotes = reviewNotes;
    }

    if (rejectedReason) {
      updateData.rejectedReason = rejectedReason;
    }

    if (dropoffDate) {
      updateData.dropoffDate = dropoffDate;
    }

    if (status === "Converted") {
      updateData.deadlineStatus = "Completed";
      updateData.deadlineReminderStage = "Completed";
      updateData.noShowRisk = false;
      const year = new Date().getFullYear();
      updateData.intakeId =
        intakeId || `INT-${year}-${Date.now().toString().slice(-6)}`;
    }

    await requestRef.update(updateData);

    const updatedDoc = await requestRef.get();

    return res.json({
      message: `Surrender request ${status.toLowerCase()} successfully.`,
      request: updatedDoc.data(),
    });
  } catch (error) {
    console.error("Update surrender status error:", error);

    return res.status(500).json({
      message: "Failed to update surrender request.",
      error: error.message,
    });
  }
}

async function scheduleMySurrenderAppointment(req, res) {
  try {
    const email = String(req.user?.email || "").trim().toLowerCase();
    const { id } = req.params;
    const { date, time } = req.body || {};

    if (!email) {
      return res.status(401).json({
        message: "Please sign in to schedule your surrender appointment.",
      });
    }

    if (!date || !time) {
      return res.status(400).json({
        message: "Appointment date and time are required.",
      });
    }

    const requestRef = db.collection(COLLECTION_NAME).doc(id);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return res.status(404).json({
        message: "Surrender request not found.",
      });
    }

    const data = requestDoc.data() || {};
    const accountEmail = String(data.account?.email || data.owner?.email || "")
      .trim()
      .toLowerCase();

    if (accountEmail !== email) {
      return res.status(403).json({
        message: "You can only schedule your own surrender appointment.",
      });
    }

    if (String(data.status || "").toLowerCase() !== "approved") {
      return res.status(400).json({
        message: "Only accepted surrender requests can schedule an appointment.",
      });
    }

    if (!validateScheduleDate(data, date)) {
      return res.status(400).json({
<<<<<<< HEAD
        message: "Appointment date must be today or later and within the 14-day attendance deadline.",
=======
        message: "Surrender appointment date must be within 14 days from the request acceptance date.",
>>>>>>> origin/main
      });
    }

    const existingAppointment = data.surrenderAppointment || null;
    const alreadyScheduled = Boolean(existingAppointment?.date || existingAppointment?.time);
    const now = new Date().toISOString();

    if (alreadyScheduled) {
      const rescheduleCount = Number(existingAppointment?.rescheduleCount || 0);
      if (rescheduleCount >= 1 || existingAppointment?.rescheduledAt) {
        return res.status(400).json({
          message: "Surrender appointment can only be rescheduled once.",
        });
      }

      const surrenderRescheduleRequest = {
        date,
        time,
        location: SHELTER_LOCATION,
        status: "Pending",
        requestedAt: now,
        requestedBy: email,
        previousSchedule: existingAppointment,
      };

      await requestRef.update({
        surrenderRescheduleRequest,
        deadlineStatus: "Reschedule Pending",
        updatedAt: now,
      });

      return res.json({
        message: "Surrender appointment reschedule request sent for staff approval.",
        requiresApproval: true,
        surrenderRescheduleRequest,
      });
    }

    const surrenderAppointment = {
      date,
      time,
      location: SHELTER_LOCATION,
      scheduledAt: now,
    };

    await requestRef.update({
      surrenderAppointment,
      dropoffDate: date,
      deadlineStatus: "Appointment Scheduled",
      noShowRisk: false,
      updatedAt: new Date().toISOString(),
    });

    const updatedDoc = await requestRef.get();

    return res.json({
      message: "Surrender appointment saved.",
      request: updatedDoc.data(),
      surrenderAppointment,
    });
  } catch (error) {
    console.error("Schedule surrender appointment error:", error);

    return res.status(500).json({
      message: "Failed to save surrender appointment.",
      error: error.message,
    });
  }
}

async function approveSurrenderReschedule(req, res) {
  try {
    const { id } = req.params;
    const requestRef = db.collection(COLLECTION_NAME).doc(id);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return res.status(404).json({
        message: "Surrender request not found.",
      });
    }

    const data = requestDoc.data() || {};
    const request = data.surrenderRescheduleRequest || {};

    if (String(request.status || "").toLowerCase() !== "pending") {
      return res.status(400).json({
        message: "No pending surrender reschedule request found.",
      });
    }

<<<<<<< HEAD
    if (!validateScheduleDate(data, request.date)) {
      return res.status(400).json({
        message: "The requested surrender appointment is outside the active 14-day attendance deadline.",
=======
    const acceptedDate = data.acceptedDate || data.acceptedAt || data.approvedDate || data.approvedAt || data.reviewedAt || data.updatedAt;
    if (!isScheduleWithinDecisionWindow(request.date, acceptedDate)) {
      return res.status(400).json({
        message: "Surrender appointment date must be within 14 days from the request acceptance date.",
>>>>>>> origin/main
      });
    }

    const now = new Date().toISOString();
    const surrenderAppointment = {
      date: request.date,
      time: request.time,
      location: request.location || SHELTER_LOCATION,
      scheduledAt: data.surrenderAppointment?.scheduledAt || now,
      rescheduledAt: now,
      approvedBy: req.user?.email || "Admin",
    };

    await requestRef.update({
      surrenderAppointment,
      dropoffDate: request.date,
      "surrenderRescheduleRequest.status": "Approved",
      "surrenderRescheduleRequest.reviewedAt": now,
      "surrenderRescheduleRequest.reviewedBy": req.user?.email || "Admin",
      deadlineStatus: "Appointment Scheduled",
      noShowRisk: false,
      updatedAt: now,
    });

    const updatedDoc = await requestRef.get();

    return res.json({
      message: "Surrender appointment reschedule approved.",
      request: updatedDoc.data(),
      surrenderAppointment,
    });
  } catch (error) {
    console.error("Approve surrender reschedule error:", error);

    return res.status(500).json({
      message: "Failed to approve surrender reschedule.",
      error: error.message,
    });
  }
}

async function rejectSurrenderReschedule(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const requestRef = db.collection(COLLECTION_NAME).doc(id);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return res.status(404).json({
        message: "Surrender request not found.",
      });
    }

    const request = requestDoc.data()?.surrenderRescheduleRequest || {};

    if (String(request.status || "").toLowerCase() !== "pending") {
      return res.status(400).json({
        message: "No pending surrender reschedule request found.",
      });
    }

    await requestRef.update({
      "surrenderRescheduleRequest.status": "Rejected",
      "surrenderRescheduleRequest.rejectionReason": String(reason || "").trim(),
      "surrenderRescheduleRequest.reviewedAt": new Date().toISOString(),
      "surrenderRescheduleRequest.reviewedBy": req.user?.email || "Admin",
      updatedAt: new Date().toISOString(),
    });

    return res.json({
      message: "Surrender appointment reschedule rejected.",
    });
  } catch (error) {
    console.error("Reject surrender reschedule error:", error);

    return res.status(500).json({
      message: "Failed to reject surrender reschedule.",
      error: error.message,
    });
  }
}

module.exports = {
  getSurrenderAvailability,
  updateSurrenderAvailability,
  createSurrenderRequest,
  getAllSurrenderRequests,
  getMySurrenderRequests,
  scheduleMySurrenderAppointment,
  approveSurrenderReschedule,
  rejectSurrenderReschedule,
  updateSurrenderStatus,
};
