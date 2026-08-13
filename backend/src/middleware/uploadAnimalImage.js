const multer = require("multer");
const {
  MAX_IMAGE_SIZE_BYTES,
  IMAGE_EXTENSION_BY_MIME_TYPE,
} = require("../utils/imageUploadPolicy");

const animalImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
  },
  fileFilter: (req, file, cb) => {
    if (!IMAGE_EXTENSION_BY_MIME_TYPE[file.mimetype]) {
      return cb(new Error("Only JPG, PNG, and WebP images are allowed."));
    }
    cb(null, true);
  },
});

function uploadAnimalImage(req, res, next) {
  animalImageUpload.single("photo")(req, res, (error) => {
    if (!error) return next();
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "The animal photo must be 5 MB or smaller."
      : error.message || "The animal photo could not be uploaded.";
    return res.status(400).json({ message });
  });
}

module.exports = uploadAnimalImage;
