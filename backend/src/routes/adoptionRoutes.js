const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/adoptionController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/roleMiddleware");

function optionalAuthenticateToken(req, res, next) {
  if (!req.headers.authorization) {
    return next();
  }

  return authenticateToken(req, res, next);
}

// Public submit
router.post("/", optionalAuthenticateToken, ctrl.createAdoption);

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

module.exports = router;
