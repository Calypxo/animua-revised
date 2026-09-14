const { db } = require("../config/firebase");
const sharp = require("sharp");
const { prepareSurrenderImage } = require("../services/surrenderImageService");
const { getSurrenderAnalysisState } = require("../services/surrenderAnalysisState");
const {
  analyzeSurrenderReason,
  buildFallbackAnalysis,
} = require("../services/surrenderNlpService");
const {
  buildApprovalDeadlineFields,
  reconcileRequestDeadlines,
  validateScheduleDate,
} = require("../services/requestDeadlineService");
const { createUserNotification, createManagementNotification } = require("../services/notificationService");
const {
  isDirectSurrenderStatusAllowed,
} = require("../services/surrenderWorkflowService");
const {
  MIN_SURRENDER_REASON_LENGTH,
  isDetailedSurrenderReason,
} = require("../utils/surrenderReason");

const COLLECTION_NAME = "surrenderRequests";
const SETTINGS_COLLECTION_NAME = "surrenderSettings";
const AVAILABILITY_SETTINGS_ID = "requestAvailability";
const SHELTER_LOCATION = "Angeles City Veterinary Office, Brgy. Pampang, Angeles City";
const CLOSED_CAPACITY_MESSAGE =
  "The shelter is not accepting surrender requests right now because space or cages may be unavailable. Please check again later or contact the shelter for urgent concerns.";

const MAX_SURRENDER_PHOTO_DATA_URL_LENGTH = 900000;
const MAX_ID_PHOTO_DATA_URL_LENGTH = 560000;
const SURRENDER_LIST_THUMB_WIDTH = 380;

function canScheduleSurrenderStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized === "approved" || normalized === "accepted";
}

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

function normalizeImageDocument(document = {}) {
  const dataUrl = typeof document.dataUrl === "string" ? document.dataUrl.trim() : "";
  if (!dataUrl) return null;
  return {
    name: String(document.name || "").trim().slice(0, 160),
    type: String(document.type || "").trim().slice(0, 80),
    size: Number(document.size || 0),
    dataUrl,
  };
}

function parseImageDataUrl(dataUrl = "") {
  const match = String(dataUrl).match(/^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return null;
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

async function createSurrenderListThumbnail(dataUrl = "") {
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed) return "";

  try {
    const output = await sharp(parsed.buffer, { failOn: "none" })
      .rotate()
      .resize({ width: SURRENDER_LIST_THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: 72, effort: 4 })
      .toBuffer();

    return `data:image/webp;base64,${output.toString("base64")}`;
  } catch (error) {
    console.error("[createSurrenderListThumbnail]", error.message);
    return "";
  }
}

async function summarizeMySurrenderRequest(request = {}) {
  const owner = request.owner || {};
  const pet = request.pet || {};
  const originalPhotoDataUrl = typeof pet.photoDataUrl === "string" ? pet.photoDataUrl.trim() : "";
  const photoDataUrl = (await createSurrenderListThumbnail(originalPhotoDataUrl)) || originalPhotoDataUrl;

  return {
    ...request,
    owner: {
      name: owner.name || "",
      email: owner.email || "",
      contact: owner.contact || "",
      address: owner.address || "",
      barangay: owner.barangay || "",
      city: owner.city || "",
      isAngelesResident: Boolean(owner.isAngelesResident),
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
      photoName: pet.photoName || "",
      photoType: photoDataUrl ? "image/webp" : pet.photoType || "",
      photoDataUrl,
      photoURL: pet.photoURL || "",
      imageUrl: pet.imageUrl || "",
      imageURL: pet.imageURL || "",
      photoUrl: pet.photoUrl || "",
      profileImageUrl: pet.profileImageUrl || "",
      photos: Array.isArray(pet.photos) ? pet.photos : [],
      photoUrls: Array.isArray(pet.photoUrls) ? pet.photoUrls : [],
    },
  };
}

function isValidImageDataUrl(dataUrl, maxLength) {
  return Boolean(
    dataUrl &&
    dataUrl.length <= maxLength &&
    /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(dataUrl)
  );
}

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
    const identityDocuments = owner.identityDocuments || {};
    let identityIdFront = normalizeImageDocument(identityDocuments.front);
    let identityIdBack = normalizeImageDocument(identityDocuments.back);

    if (!surrenderReason) {
      return res.status(400).json({
        message: "Surrender reason is required.",
      });
    }

    if (!isDetailedSurrenderReason(surrenderReason)) {
      return res.status(400).json({
        message: `Please provide a meaningful surrender reason using at least ${MIN_SURRENDER_REASON_LENGTH} characters.`,
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

    if (!identityIdFront || !identityIdBack) {
      return res.status(400).json({
        message: "Valid ID front and back photos are required.",
      });
    }

    if (
      !isValidImageDataUrl(identityIdFront.dataUrl, MAX_ID_PHOTO_DATA_URL_LENGTH) ||
      !isValidImageDataUrl(identityIdBack.dataUrl, MAX_ID_PHOTO_DATA_URL_LENGTH)
    ) {
      return res.status(400).json({
        message: "Valid ID photos must be JPG, PNG, or WebP images under 400 KB each.",
      });
    }

    let photoDataUrl = typeof pet.photoDataUrl === "string" ? pet.photoDataUrl.trim() : "";
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

    // Older deployed clients can send three individually valid photos whose
    // combined base64 strings exceed Firestore's 1 MiB document limit.
    identityIdFront = await prepareSurrenderImage(identityIdFront, "front ID photo");
    identityIdBack = await prepareSurrenderImage(identityIdBack, "back ID photo");
    const preparedAnimalPhoto = await prepareSurrenderImage({
      name: pet.photoName,
      type: pet.photoType,
      dataUrl: photoDataUrl,
    }, "animal photo");
    photoDataUrl = preparedAnimalPhoto.dataUrl;

    // Keep the public submission path fast and reliable. The local analysis is
    // deterministic and available immediately; the remote model enriches the
    // saved request after the user has received a successful response.
    const nlpResult = {
      ...buildFallbackAnalysis(surrenderReason),
      source: "Local rules (RoBERTa analysis pending)",
    };

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
        identityDocuments: {
          front: identityIdFront,
          back: identityIdBack,
        },
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
        photoName: photoDataUrl ? String(preparedAnimalPhoto.name || "").trim().slice(0, 160) : "",
        photoType: photoDataUrl ? String(preparedAnimalPhoto.type || "").trim().slice(0, 80) : "",
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
      nlpStatus: "pending",
      nlpRequestedAt: new Date().toISOString(),

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

    // Leave room for Firestore field overhead and subsequent review metadata.
    if (Buffer.byteLength(JSON.stringify(surrenderRequest), "utf8") > 950_000) {
      return res.status(400).json({
        code: "SURRENDER_REQUEST_TOO_LARGE",
        message: "This request is too large to save. Shorten the written details or choose smaller photos, then try again.",
      });
    }

    await db
      .collection(COLLECTION_NAME)
      .doc(requestId)
      .set(surrenderRequest);
    const urgentRequest = ["Critical", "High"].includes(nlpResult.urgencyLabel);
    createManagementNotification({
      type: urgentRequest ? "urgent_surrender_request_created" : "surrender_request_created",
      resourceType: "surrender_request",
      relatedResourceId: requestId,
      title: urgentRequest ? "Urgent surrender request received" : "New surrender request received",
      message: urgentRequest
        ? `${surrenderRequest.owner.name} submitted a ${nlpResult.urgencyLabel.toLowerCase()}-urgency request for ${surrenderRequest.pet.name || "an animal"}.`
        : `${surrenderRequest.owner.name} submitted a surrender request for ${surrenderRequest.pet.name || "an animal"}.`,
    }).catch((error) => console.warn("[createSurrenderRequest notification]", error.message));

    analyzeSurrenderReason(surrenderReason)
      .then(async (enrichedAnalysis) => {
        if (!enrichedAnalysis || /node fallback/i.test(enrichedAnalysis.source || "")) {
          await db.collection(COLLECTION_NAME).doc(requestId).update({ nlpStatus: "fallback" });
          return;
        }
        await db.collection(COLLECTION_NAME).doc(requestId).update({
          nlp: enrichedAnalysis,
          nlpStatus: "completed",
          nlpAnalyzedAt: new Date().toISOString(),
        });
      })
      .catch((error) => console.warn("[createSurrenderRequest analysis]", error.message));

    return res.status(201).json({
      message: "Surrender request submitted successfully.",
      request: surrenderRequest,
    });
  } catch (error) {
    console.error("Create surrender request error:", error);

    if (error.code === "SURRENDER_IMAGE_PROCESSING_FAILED") {
      return res.status(400).json({ code: error.code, message: error.message });
    }

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

    const requests = snapshot.docs.map((doc) => {
      const record = doc.data();
      return { ...record, id: doc.id, nlpStatus: getSurrenderAnalysisState(record) };
    });

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

async function getSurrenderAnalysisStatuses(req, res) {
  const ids = [...new Set(String(req.query?.ids || "").split(","))];
  if (!ids.length || ids.length > 30 || ids.some(id => !/^[a-zA-Z0-9_-]{1,100}$/.test(id))) {
    return res.status(400).json({ message: "Provide between 1 and 30 valid request IDs." });
  }
  try {
    const snapshots = await db.getAll(
      ...ids.map(id => db.collection(COLLECTION_NAME).doc(id)),
      { fieldMask: ["nlp", "nlpStatus", "nlpRequestedAt", "nlpAnalyzedAt", "createdAt"] },
    );
    res.set("Cache-Control", "no-store");
    return res.json({ requests: snapshots.filter(doc => doc.exists).map(doc => {
      const record = doc.data();
      return { id: doc.id, nlp: record.nlp || {}, nlpStatus: getSurrenderAnalysisState(record), nlpAnalyzedAt: record.nlpAnalyzedAt || null };
    }) });
  } catch (error) {
    console.error("Get surrender analysis status error:", error.message);
    return res.status(500).json({ message: "Unable to refresh surrender analysis." });
  }
}

async function reanalyzeSurrenderRequest(req, res) {
  try {
    if (!isAdminOrStaff(req.user)) {
      return res.status(403).json({
        message: "Only Admin or Staff can rerun surrender analysis.",
      });
    }

    const { id } = req.params;
    const requestRef = db.collection(COLLECTION_NAME).doc(id);
    const requestDoc = await requestRef.get();

    if (!requestDoc.exists) {
      return res.status(404).json({
        message: "Surrender request not found.",
      });
    }

    const surrenderReason = String(requestDoc.data()?.surrenderReason || "").trim();
    if (!surrenderReason) {
      return res.status(400).json({
        message: "This request has no surrender reason to analyze.",
      });
    }

    const analysis = await analyzeSurrenderReason(surrenderReason);
    if (/node fallback/i.test(String(analysis?.source || ""))) {
      return res.status(503).json({
        message: "Tagalog RoBERTa is still starting or unavailable. The existing analysis was kept; please retry shortly.",
      });
    }

    const nlpAnalyzedAt = new Date().toISOString();
    await requestRef.update({
      nlp: analysis,
      nlpStatus: "completed",
      nlpAnalyzedAt,
    });

    return res.json({
      message: "Tagalog RoBERTa analysis completed.",
      nlp: analysis,
      nlpStatus: "completed",
      nlpAnalyzedAt,
    });
  } catch (error) {
    console.error("Reanalyze surrender request error:", error);

    return res.status(500).json({
      message: "Failed to rerun Tagalog RoBERTa analysis.",
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

    const requests = (await Promise.all(
      snapshot.docs.map((doc) => {
        const data = doc.data() || {};
        return summarizeMySurrenderRequest({
          ...data,
          id: data.id || doc.id,
        });
      })
    )).sort((a, b) => {
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
    const { status, reviewNotes, rejectedReason, dropoffDate } = req.body;
    const normalizedRejectedReason = String(rejectedReason || "").trim();

    if (!isDirectSurrenderStatusAllowed(status)) {
      return res.status(400).json({
        message: "Invalid surrender request status.",
      });
    }

    if (status === "Rejected" && normalizedRejectedReason.length < 5) {
      return res.status(400).json({
        message: "A clear rejection reason using at least 5 characters is required.",
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

    if (status === "Rejected") {
      updateData.rejectedReason = normalizedRejectedReason;
    }

    if (dropoffDate) {
      updateData.dropoffDate = dropoffDate;
    }

    await requestRef.update(updateData);

    await createUserNotification({
      userEmail: current.account?.email || current.owner?.email,
      category: "surrender",
      type: `surrender_${String(status).toLowerCase()}`,
      title: "Surrender request update",
      message: status === "Rejected"
        ? `Your surrender request for ${current.pet?.name || "your pet"} was not approved. View My Submissions to see the shelter's reason.`
        : `Your surrender request for ${current.pet?.name || "your pet"} is now ${status}.`,
      link: "/pages/public/my-submissions.html",
      referenceId: id,
    });

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

    if (!canScheduleSurrenderStatus(data.status)) {
      return res.status(400).json({
        message: "Only accepted surrender requests can schedule an appointment.",
      });
    }

    if (data.arrivalConfirmedAt) {
      return res.status(400).json({
        message: "Drop-off attendance has already been confirmed and can no longer be rescheduled.",
      });
    }

    if (!validateScheduleDate(data, date)) {
      return res.status(400).json({
        message: "Appointment date must be today or later and within the 14-day attendance deadline.",
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

    if (!validateScheduleDate(data, request.date)) {
      return res.status(400).json({
        message: "The requested surrender appointment is outside the active 14-day attendance deadline.",
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
  getSurrenderAnalysisStatuses,
  reanalyzeSurrenderRequest,
  getMySurrenderRequests,
  scheduleMySurrenderAppointment,
  approveSurrenderReschedule,
  rejectSurrenderReschedule,
  updateSurrenderStatus,
};
