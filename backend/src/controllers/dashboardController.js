const { db } = require("../config/firebase");

exports.getDashboardStats = async (req, res) => {
  try {
    const snapshot = await db.collection("pets").get();

    let totalPets = 0;
    let intake = 0;
    let quarantine = 0;
    let readyForAdoption = 0;

    snapshot.forEach((doc) => {
      const pet = doc.data();
      totalPets++;

      if (pet.status === "Intake") intake++;
      else if (pet.status === "Quarantine") quarantine++;
      else if (pet.status === "Ready for Adoption") readyForAdoption++;
    });

    res.json({
      totalPets,
      intake,
      quarantine,
      readyForAdoption,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};