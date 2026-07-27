const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/roleMiddleware");

const {
  createSurrenderRequest,
  getAllSurrenderRequests,
  getMySurrenderRequests,
  scheduleMySurrenderAppointment,
  approveSurrenderReschedule,
  rejectSurrenderReschedule,
  updateSurrenderStatus,
} = require("../controllers/surrenderController");

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

module.exports = router;
