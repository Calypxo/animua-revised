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

export function isOptimizablePublicImage(imageUrl) {
  const value = String(imageUrl || "").trim();
  if (!value || value.startsWith("data:") || value.startsWith("blob:")) return false;

  try {
    return OPTIMIZABLE_IMAGE_HOSTS.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function optimizedPublicImageUrl(imageUrl, width = 480) {
  const value = String(imageUrl || "").trim();
  if (!isOptimizablePublicImage(value)) return value;

  return `${API_BASE_URL}/public/optimized-image?width=${normalizedImageWidth(width)}&src=${encodeURIComponent(value)}`;
}
