const { db } = require("../config/firebase");

// GET all pets
exports.getPets = async (req, res) => {
  try {
    const snapshot = await db.collection("pets").get();

    const pets = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(pets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ADD pet
exports.addPet = async (req, res) => {
  try {
    const petData = {
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const docRef = await db.collection("pets").add(petData);

    res.status(201).json({
      message: "Pet added successfully",
      id: docRef.id
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// UPDATE pet
exports.updatePet = async (req, res) => {
  try {
    const { id } = req.params;
    const ref = db.collection("pets").doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ message: "Pet not found" });
    }

    await ref.update({
      ...req.body,
      updatedAt: new Date().toISOString()
    });

    res.json({ message: "Updated successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE pet
exports.deletePet = async (req, res) => {
  try {
    const { id } = req.params;
    const ref = db.collection("pets").doc(id);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({ message: "Pet not found" });
    }

    await ref.delete();
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};