const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/roleMiddleware");
const deadlines = require("../controllers/requestDeadlineController");

const {
  getSurrenderAvailability,
  updateSurrenderAvailability,
  createSurrenderRequest,
  getAllSurrenderRequests,
  getMySurrenderRequests,
  scheduleMySurrenderAppointment,
  approveSurrenderReschedule,
  rejectSurrenderReschedule,
  updateSurrenderStatus,
} = require("../controllers/surrenderController");

router.get("/availability", getSurrenderAvailability);

router.patch(
  "/availability",
  authenticateToken,
  authorizeRole("Admin", "Staff"),
  updateSurrenderAvailability
);

// Public logged-in user submits surrender request
router.post(
  "/",
  authenticateToken,
  createSurrenderRequest
);

// Public user gets their own surrender requests
// IMPORTANT: keep this before "/:id/status"
router.get(
  "/my-requests",
  authenticateToken,
  getMySurrenderRequests
);

router.patch(
  "/my-requests/:id/appointment",
  authenticateToken,
  scheduleMySurrenderAppointment
);

// Admin/Staff gets all surrender requests
router.get(
  "/",
  authenticateToken,
  authorizeRole("Admin", "Staff"),
  getAllSurrenderRequests
);

// Admin/Staff updates request status
router.patch(
  "/:id/reschedule/approve",
  authenticateToken,
  authorizeRole("Admin", "Staff"),
  approveSurrenderReschedule
);

router.patch(
  "/:id/reschedule/reject",
  authenticateToken,
  authorizeRole("Admin", "Staff"),
  rejectSurrenderReschedule
);

router.patch(
  "/:id/status",
  authenticateToken,
  authorizeRole("Admin", "Staff"),
  updateSurrenderStatus
);

router.patch("/:id/deadline/extend", authenticateToken, authorizeRole("Admin", "Staff"), deadlines.extendSurrenderDeadline);
router.patch("/:id/arrival", authenticateToken, authorizeRole("Admin", "Staff"), deadlines.confirmSurrenderArrival);
router.patch("/:id/no-show", authenticateToken, authorizeRole("Admin", "Staff"), deadlines.markSurrenderNoShow);
router.patch("/:id/deadline/restore", authenticateToken, authorizeRole("Admin", "Staff"), deadlines.restoreSurrenderDeadline);

module.exports = router;
