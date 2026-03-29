const { db } = require("../config/firebase");

// CREATE adoption request
exports.createAdoptionRequest = async (req, res) => {
  try {
    const data = {
      ...req.body,
      status: "Pending",
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection("adoptionRequests").add(data);

    res.json({
      message: "Adoption request submitted",
      id: docRef.id
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET all adoption requests (Admin)
exports.getAdoptionRequests = async (req, res) => {
  try {
    const snapshot = await db.collection("adoptionRequests")
      .orderBy("createdAt", "desc")
      .get();

    const requests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateAdoptionRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await db.collection("adoptionRequests").doc(id).update({
      status,
      updatedAt: new Date().toISOString(),
    });

    res.json({
      message: "Adoption request updated",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteAdoptionRequest = async (req, res) => {
  try {
    const { id } = req.params;

    await db.collection("adoptionRequests").doc(id).delete();

    res.json({
      message: "Adoption request deleted",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};