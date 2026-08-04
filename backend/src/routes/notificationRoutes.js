const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const {
  getMyNotifications,
  markMyNotificationsRead,
} = require("../controllers/notificationController");

const router = express.Router();

router.get("/", authenticateToken, getMyNotifications);
router.patch("/read", authenticateToken, markMyNotificationsRead);

module.exports = router;
