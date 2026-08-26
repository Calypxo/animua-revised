import { API_BASE_URL } from "./api.js";

const OPTIMIZABLE_IMAGE_HOSTS = new Set([
  "storage.googleapis.com",
  "firebasestorage.googleapis.com",
]);

const MIN_IMAGE_WIDTH = 96;
const MAX_IMAGE_WIDTH = 900;

function normalizedImageWidth(width) {
  const parsed = Number.parseInt(String(width || ""), 10);
  if (!Number.isFinite(parsed)) return 480;
  return Math.min(MAX_IMAGE_WIDTH, Math.max(MIN_IMAGE_WIDTH, parsed));
}

export function isOptimizableManagementImage(imageUrl) {
  const value = String(imageUrl || "").trim();
  if (!value || value.startsWith("data:") || value.startsWith("blob:")) return false;

  try {
    return OPTIMIZABLE_IMAGE_HOSTS.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function optimizedManagementImageUrl(imageUrl, width = 480) {
  const value = String(imageUrl || "").trim();
  if (!isOptimizableManagementImage(value)) return value;

  return `${API_BASE_URL}/public/optimized-image?width=${normalizedImageWidth(width)}&src=${encodeURIComponent(value)}`;
}

/**
 * Restores the original signed URL if resizing fails, then reveals an optional
 * sibling marked with data-image-fallback if the original also cannot load.
 */
export function installManagementImageFallbacks(root = document) {
  const images = root?.matches?.("img[data-original-src]")
    ? [root]
    : Array.from(root?.querySelectorAll?.("img[data-original-src]") || []);

  images.forEach((image) => {
    if (image.dataset.imageFallbackReady === "true") return;
    image.dataset.imageFallbackReady = "true";

    image.addEventListener("error", () => {
      const original = String(image.dataset.originalSrc || "").trim();
      const rendered = String(image.getAttribute("src") || "").trim();

      if (original && rendered !== original) {
        image.dataset.originalSrc = "";
        image.src = original;
        return;
      }

      image.hidden = true;
      image.parentElement?.querySelector?.("[data-image-fallback]")?.removeAttribute("hidden");
    });
  });
}
