// backend/src/routes/animalRoutes.js
const express   = require("express");
const router    = express.Router();
const ctrl      = require("../controllers/animalController");
const auth      = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");
const uploadAnimalImage = require("../middleware/uploadAnimalImage");

router.use(auth);

// GET  /api/animals              → list all animals
router.get("/", authorize("Admin", "Staff"), ctrl.getAllAnimals);

// GET  /api/animals/:id          → get single animal profile
router.get("/:id", authorize("Admin", "Staff"), ctrl.getAnimalById);

// PUT  /api/animals/:id          → update basic profile fields / status
router.put("/:id", authorize("Admin", "Staff"), ctrl.updateAnimal);

// POST /api/animals/:id/behavioral → save behavioral assessment
router.post("/:id/behavioral", authorize("Admin", "Staff"), ctrl.saveBehavioralAssessment);

// POST /api/animals/:id/medical   → add medical record
router.post("/:id/medical", authorize("Admin", "Staff"), ctrl.addMedicalRecord);

// PUT  /api/animals/:id/medical/:medicalId → update medical record
router.put("/:id/medical/:medicalId", authorize("Admin", "Staff"), ctrl.updateMedicalRecord);

// PATCH /api/animals/:id/archive → archive animal
router.patch("/:id/archive", authorize("Admin"), ctrl.archiveAnimal);

router.patch(
  "/:id/photo",
  authorize("Admin", "Staff"),
  uploadAnimalImage.single("photo"),
  ctrl.uploadAnimalProfileImage
);

router.delete(
  "/:id/photo",
  authorize("Admin", "Staff"),
  ctrl.deleteAnimalProfileImage
);

console.log("Animal routes loaded");

module.exports = router;