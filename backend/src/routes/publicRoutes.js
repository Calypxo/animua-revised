const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/roleMiddleware");
const {
  contactRateLimiter,
  rejectContactHoneypot,
} = require("../middleware/contactProtection");
const {
  getPublicPets,
  getPublicPetById,
  getPublicEvents,
  getOptimizedImage,
  getContactMessages,
  getMyContactMessages,
  submitContactMessage,
  addContactFollowUp,
  replyToContactMessage,
} = require("../controllers/publicController");

// Public pet browsing
router.get("/events", getPublicEvents);
router.get("/optimized-image", getOptimizedImage);
router.get("/pets", getPublicPets);
router.get("/pets/:id", getPublicPetById);
router.get(
  "/contact/messages",
  authenticateToken,
  authorizeRole("Admin", "Staff"),
  getContactMessages
);
router.get("/contact/my-messages", authenticateToken, getMyContactMessages);
router.post(
  "/contact",
  rejectContactHoneypot,
  contactRateLimiter,
  authenticateToken,
  submitContactMessage
);
router.post("/contact/:id/follow-up", authenticateToken, addContactFollowUp);
router.post(
  "/contact/:id/reply",
  authenticateToken,
  authorizeRole("Admin", "Staff"),
  replyToContactMessage
);

module.exports = router;
