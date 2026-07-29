const { db } = require("../config/firebase");

const COLLECTION_NAME = "surrenderRequests";
const SHELTER_LOCATION = "Angeles City Veterinary Office, Brgy. Pampang, Angeles City";

const PYTHON_SENTIMENT_API_URL =
  process.env.PYTHON_SENTIMENT_API_URL ||
  "http://127.0.0.1:8002/analyze-surrender-sentiment";
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
  }

  return await response.json();
}

async function createSurrenderRequest(req, res) {
  try {
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

    if (status === "Converted" && current.status !== "Approved") {
      return res.status(400).json({
        message: "Only approved surrender requests can be converted.",
      });
    }

    const updateData = {
      status,
      updatedAt: new Date().toISOString(),
      reviewedBy: req.user.fullName || req.user.email,
      reviewedAt: new Date().toISOString().split("T")[0],
    };

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

    if (!["approved", "accepted", "converted"].includes(String(data.status || "").toLowerCase())) {
      return res.status(400).json({
        message: "Only accepted surrender requests can schedule an appointment.",
      });
    }

    const existingAppointment = data.surrenderAppointment || null;
    const alreadyScheduled = Boolean(existingAppointment?.date || existingAppointment?.time);
    const now = new Date().toISOString();

    if (alreadyScheduled) {
      const surrenderRescheduleRequest = {
        date,
        time,
        location: SHELTER_LOCATION,
        status: "Pending",
        requestedAt: now,
        requestedBy: email,
        previousSchedule: existingAppointment || {
          date: data.dropoffDate || "",
          time: "",
          location: SHELTER_LOCATION,
        },
      };

      await requestRef.update({
        surrenderRescheduleRequest,
        updatedAt: now,
      });

      const updatedDoc = await requestRef.get();

      return res.json({
        message: "Surrender appointment reschedule request sent for admin approval.",
        requiresApproval: true,
        request: updatedDoc.data(),
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
  createSurrenderRequest,
  getAllSurrenderRequests,
  getMySurrenderRequests,
  scheduleMySurrenderAppointment,
  approveSurrenderReschedule,
  rejectSurrenderReschedule,
  updateSurrenderStatus,
};
