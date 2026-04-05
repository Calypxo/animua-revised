const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/adoptionController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/roleMiddleware");

// Public submit
router.post("/", ctrl.createAdoption);

// Admin / Staff management
router.get("/", authenticateToken, authorizeRole("Admin", "Staff"), ctrl.getAllAdoptions);
router.get("/:id", authenticateToken, authorizeRole("Admin", "Staff"), ctrl.getAdoptionById);
router.patch("/:id/approve", authenticateToken, authorizeRole("Admin", "Staff"), ctrl.approveAdoption);
router.patch("/:id/reject", authenticateToken, authorizeRole("Admin", "Staff"), ctrl.rejectAdoption);
router.patch("/:id/finalize", authenticateToken, authorizeRole("Admin", "Staff"), ctrl.finalizeAdoption);

module.exports = router;