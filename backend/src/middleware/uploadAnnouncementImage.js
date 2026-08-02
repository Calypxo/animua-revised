const multer = require("multer");

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const announcementImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowedImageTypes.has(file.mimetype)) {
      return cb(new Error("Only JPG, PNG, and WebP images are allowed."));
    }
    return cb(null, true);
  },
});

function uploadAnnouncementImage(req, res, next) {
  announcementImageUpload.single("photo")(req, res, (error) => {
    if (!error) return next();

    const message = error.code === "LIMIT_FILE_SIZE"
      ? "The cover photo must be 5 MB or smaller."
      : error.message || "The cover photo could not be uploaded.";

    return res.status(400).json({ message });
  });
}

module.exports = uploadAnnouncementImage;
