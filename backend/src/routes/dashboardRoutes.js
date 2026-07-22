const express = require("express");
const router = express.Router();

const { getDashboardStats } = require("../controllers/dashboardController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/roleMiddleware");

router.get(
  "/stats",
  authenticateToken,
  authorizeRole("Admin", "Staff", "Veterinarian"),
  getDashboardStats
);

module.exports = router;
