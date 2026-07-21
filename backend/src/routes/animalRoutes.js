// backend/src/routes/animalRoutes.js

const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/animalController");
const auth = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const uploadAnimalImage = require("../middleware/uploadAnimalImage");

router.use(auth);

// View animal list
router.get(
  "/",
  authorize("Admin", "Staff", "Veterinarian"),
  ctrl.getAllAnimals
);

// View individual animal profile
router.get(
  "/:id",
  authorize("Admin", "Staff", "Veterinarian"),
  ctrl.getAnimalById
);

// Update basic profile information
router.put(
  "/:id",
  authorize("Admin", "Staff"),
  ctrl.updateAnimal
);

// Send animal to quarantine
router.patch(
  "/:id/send-to-quarantine",
  authorize("Admin", "Staff"),
  ctrl.sendToQuarantine
);

// Mark animal ready for adoption
router.patch(
  "/:id/mark-ready",
  authorize("Admin", "Staff"),
  ctrl.markReadyForAdoption
);

// Behavioral assessment
router.post(
  "/:id/behavioral",
  authorize("Admin", "Veterinarian"),
  ctrl.saveBehavioralAssessment
);

// Add medical record
router.post(
  "/:id/medical",
  authorize("Admin", "Veterinarian"),
  ctrl.addMedicalRecord
);

// Update medical record
router.put(
  "/:id/medical/:medicalId",
  authorize("Admin", "Veterinarian"),
  ctrl.updateMedicalRecord
);

// Upload animal image
router.patch(
  "/:id/photo",
  authorize("Admin", "Staff"),
  uploadAnimalImage.single("photo"),
  ctrl.uploadAnimalProfileImage
);

// Delete animal image
router.delete(
  "/:id/photo",
  authorize("Admin", "Staff"),
  ctrl.deleteAnimalProfileImage
);

// Archive animal
router.patch(
  "/:id/archive",
  authorize("Admin"),
  ctrl.archiveAnimal
);

console.log("Animal routes loaded");

module.exports = router;