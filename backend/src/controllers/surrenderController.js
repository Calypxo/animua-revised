const { db } = require("../config/firebase");

const COLLECTION_NAME = "surrenderRequests";

const PYTHON_SENTIMENT_API_URL =
  process.env.PYTHON_SENTIMENT_API_URL ||
  "http://127.0.0.1:8001/analyze-surrender-sentiment";

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
  const timestamp = Date.now().toString().slice(-6);
  return `SR-2026-${timestamp}`;
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
    if (!isAdminOrStaff(req.user)) {
      return res.status(403).json({
        message: "Only Admin or Staff can view all surrender requests.",
      });
    }

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
      .orderBy("createdAt", "desc")
      .get();

    const requests = snapshot.docs.map((doc) => doc.data());

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
      updateData.intakeId = intakeId || `INT-2026-${Date.now().toString().slice(-6)}`;
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

module.exports = {
  createSurrenderRequest,
  getAllSurrenderRequests,
  getMySurrenderRequests,
  updateSurrenderStatus,
};