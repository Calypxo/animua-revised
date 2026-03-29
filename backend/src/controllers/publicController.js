const { db } = require("../config/firebase");

exports.getPublicPets = async (req, res) => {
  try {
    const snapshot = await db
      .collection("pets")
      .where("isVisibleToPublic", "==", true)
      .get();

    const pets = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(pets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};