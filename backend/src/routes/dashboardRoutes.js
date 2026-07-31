const express = require("express");
const router = express.Router();

const {
  getAttentionSummary,
  getDashboardStats,
} = require("../controllers/dashboardController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/roleMiddleware");

router.get(
  "/attention",
  authenticateToken,
  authorizeRole("Admin", "Staff", "Veterinarian"),
  getAttentionSummary
);

router.get(
  "/stats",
  authenticateToken,
  authorizeRole("Admin", "Staff", "Veterinarian"),
  getDashboardStats
);

module.exports = router;
