const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/roleMiddleware");

const {
  createSurrenderRequest,
  getAllSurrenderRequests,
  getMySurrenderRequests,
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

// Admin/Staff gets all surrender requests
router.get(
  "/",
  authenticateToken,
  authorizeRole("Admin", "Staff"),
  getAllSurrenderRequests
);

// Admin/Staff updates request status
router.patch(
  "/:id/status",
  authenticateToken,
  authorizeRole("Admin", "Staff"),
  updateSurrenderStatus
);

module.exports = router;