const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/adoptionController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/roleMiddleware");
const deadlines = require("../controllers/requestDeadlineController");

// Public users must be logged in before submitting an adoption application.
router.post("/", authenticateToken, ctrl.createAdoption);

// Public logged-in user tracking
router.get("/my-applications", authenticateToken, ctrl.getMyAdoptions);
router.patch("/my-applications/:id/pickup-schedule", authenticateToken, ctrl.scheduleMyAdoptionPickup);

// Admin / Staff management
router.get("/", authenticateToken, authorizeRole("Admin", "Staff"), ctrl.getAllAdoptions);
router.get("/:id", authenticateToken, authorizeRole("Admin", "Staff"), ctrl.getAdoptionById);
router.patch("/:id/approve", authenticateToken, authorizeRole("Admin", "Staff"), ctrl.approveAdoption);
router.patch("/:id/reject", authenticateToken, authorizeRole("Admin", "Staff"), ctrl.rejectAdoption);
router.patch("/:id/reschedule/approve", authenticateToken, authorizeRole("Admin", "Staff"), ctrl.approveAdoptionReschedule);
router.patch("/:id/reschedule/reject", authenticateToken, authorizeRole("Admin", "Staff"), ctrl.rejectAdoptionReschedule);
router.patch("/:id/finalize", authenticateToken, authorizeRole("Admin", "Staff"), ctrl.finalizeAdoption);
router.patch("/:id/deadline/extend", authenticateToken, authorizeRole("Admin", "Staff"), deadlines.extendAdoptionDeadline);
router.patch("/:id/arrival", authenticateToken, authorizeRole("Admin", "Staff"), deadlines.confirmAdoptionArrival);
router.patch("/:id/no-show", authenticateToken, authorizeRole("Admin", "Staff"), deadlines.markAdoptionNoShow);
router.patch("/:id/deadline/restore", authenticateToken, authorizeRole("Admin", "Staff"), deadlines.restoreAdoptionDeadline);

module.exports = router;
