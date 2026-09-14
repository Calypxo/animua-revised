const sharp = require("sharp");

// The two ID images and optional animal photo are stored in the same document.
// 3 * 220 KiB * 4/3 leaves over 140 KiB for form fields and workflow metadata.
const MAX_STORED_IMAGE_BYTES = 220 * 1024;

async function prepareSurrenderImage(document, label = "photo") {
  if (!document?.dataUrl) return document;
  const buffer = Buffer.from(document.dataUrl.split(",")[1] || "", "base64");
  if (buffer.length <= MAX_STORED_IMAGE_BYTES) return document;

  try {
    for (const side of [1600, 1280, 1024, 800, 640]) {
      const image = sharp(buffer, { limitInputPixels: 100_000_000 })
        .rotate()
        .resize({ width: side, height: side, fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" });
      for (const quality of [85, 75, 65, 55]) {
        const output = await image.clone().jpeg({ quality }).toBuffer();
        if (output.length <= MAX_STORED_IMAGE_BYTES) {
          return {
            ...document,
            name: `${String(document.name || "photo").replace(/\.[^.]+$/, "").slice(0, 150)}.jpg`,
            type: "image/jpeg",
            size: output.length,
            dataUrl: `data:image/jpeg;base64,${output.toString("base64")}`,
          };
        }
      }
    }
  } catch {
    // Return an actionable validation error instead of a database/server error.
  }
  const error = new Error(`We could not prepare the ${label}. Please choose a smaller JPG, PNG, or WebP photo and try again.`);
  error.status = 400;
  error.code = "SURRENDER_IMAGE_PROCESSING_FAILED";
  throw error;
}

module.exports = { MAX_STORED_IMAGE_BYTES, prepareSurrenderImage };
