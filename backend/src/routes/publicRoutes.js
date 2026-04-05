const express = require("express");
const router = express.Router();
const {
  getPublicPets,
  getPublicPetById,
} = require("../controllers/publicController");

// Public pet browsing
router.get("/pets", getPublicPets);
router.get("/pets/:id", getPublicPetById);

module.exports = router;