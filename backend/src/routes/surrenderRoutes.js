const express = require("express");
const router = express.Router();

const authenticateToken = require("../middleware/authMiddleware");

const {
  createSurrenderRequest,
  getAllSurrenderRequests,
  getMySurrenderRequests,
  updateSurrenderStatus,
} = require("../controllers/surrenderController");

// Public logged-in user submits surrender request
router.post("/", authenticateToken, createSurrenderRequest);

// Admin/Staff gets all surrender requests
router.get("/", authenticateToken, getAllSurrenderRequests);

// Public user gets their own surrender requests
router.get("/my-requests", authenticateToken, getMySurrenderRequests);

// Admin/Staff updates request status
router.patch("/:id/status", authenticateToken, updateSurrenderStatus);

module.exports = router;