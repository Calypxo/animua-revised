// backend/src/routes/auditRoutes.js
const express = require("express");
const router = express.Router();

const {
  getAuditLogs,
} = require(
  "../controllers/auditController"
);

const authenticateToken = require(
  "../middleware/authMiddleware"
);

const authorizeRole = require(
  "../middleware/roleMiddleware"
);

// Only Admin can view the audit trail.
router.get(
  "/",
  authenticateToken,
  authorizeRole("Admin"),
  getAuditLogs
);

module.exports = router;