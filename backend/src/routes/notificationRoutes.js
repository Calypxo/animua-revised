const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const {
  getMyNotifications,
  markMyNotificationsRead,
  markMyNotificationRead,
  registerMyPushSubscription,
  unregisterMyPushSubscription,
} = require("../controllers/notificationController");
const authorizeRole = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/", authenticateToken, getMyNotifications);
router.patch("/read", authenticateToken, markMyNotificationsRead);
router.patch("/:id/read", authenticateToken, markMyNotificationRead);
router.post(
  "/push-subscriptions",
  authenticateToken,
  authorizeRole("Admin", "Staff", "Veterinarian"),
  registerMyPushSubscription
);
router.delete(
  "/push-subscriptions",
  authenticateToken,
  authorizeRole("Admin", "Staff", "Veterinarian"),
  unregisterMyPushSubscription
);

module.exports = router;
