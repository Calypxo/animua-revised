const express = require("express");
const router = express.Router();
const {
  getPublicPets,
  getPublicPetById,
  getPublicEvents,
} = require("../controllers/publicController");

// Public pet browsing
router.get("/pets", getPublicPets);
router.get("/pets/:id", getPublicPetById);
router.get("/events", getPublicEvents);

module.exports = router;
