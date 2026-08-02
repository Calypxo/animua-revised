const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/announcementController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/roleMiddleware");
const uploadAnnouncementImage = require("../middleware/uploadAnnouncementImage");

router.get("/test", (req, res) => {
  res.json({ message: "Announcement route file is working" });
});

// Public portal: view published announcements/events
router.get("/public", ctrl.getPublicAnnouncements);

// Admin/Staff/Veterinarian management
router.get(
  "/",
  authenticateToken,
  authorizeRole("Admin", "Staff", "Veterinarian"),
  ctrl.getAllAnnouncements
);

router.post(
  "/",
  authenticateToken,
  authorizeRole("Admin", "Staff", "Veterinarian"),
  ctrl.createAnnouncement
);

router.put(
  "/:id",
  authenticateToken,
  authorizeRole("Admin", "Staff", "Veterinarian"),
  ctrl.updateAnnouncement
);

router.patch(
  "/:id/image",
  authenticateToken,
  authorizeRole("Admin", "Staff", "Veterinarian"),
  uploadAnnouncementImage,
  ctrl.uploadAnnouncementImage
);

router.delete(
  "/:id/image",
  authenticateToken,
  authorizeRole("Admin", "Staff", "Veterinarian"),
  ctrl.deleteAnnouncementImage
);

// Admin only can delete
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("Admin"),
  ctrl.deleteAnnouncement
);

console.log("Announcement routes loaded");

module.exports = router;
