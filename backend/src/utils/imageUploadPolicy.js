const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const IMAGE_EXTENSION_BY_MIME_TYPE = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
});

function validateImageFile(file, sizeMessage = "The image must be 5 MB or smaller.") {
  const extension = IMAGE_EXTENSION_BY_MIME_TYPE[file?.mimetype];
  if (!extension) {
    const error = new Error("Only JPG, PNG, and WebP images are allowed.");
    error.statusCode = 400;
    throw error;
  }

  if (Number(file?.size || 0) > MAX_IMAGE_SIZE_BYTES) {
    const error = new Error(sizeMessage);
    error.statusCode = 400;
    throw error;
  }

  return extension;
}

module.exports = {
  MAX_IMAGE_SIZE_BYTES,
  IMAGE_EXTENSION_BY_MIME_TYPE,
  validateImageFile,
};
