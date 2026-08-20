const { bucket } = require("../config/firebase");

const SIGNED_READ_URL_TTL_MS = 30 * 60 * 1000;

function normalizeObjectPath(value) {
  const path = String(value || "").trim().replace(/^\/+/, "");
  if (!path || path.includes("\\")) return "";
  const segments = path.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return "";
  return path;
}

function hasExpectedPrefix(path, expectedPrefix) {
  const normalizedPath = normalizeObjectPath(path);
  const normalizedPrefix = normalizeObjectPath(expectedPrefix);
  return Boolean(normalizedPath && normalizedPrefix && normalizedPath.startsWith(`${normalizedPrefix}/`));
}

function assertExpectedStoragePath(path, expectedPrefix) {
  const normalizedPath = normalizeObjectPath(path);
  if (!hasExpectedPrefix(normalizedPath, expectedPrefix)) {
    const error = new Error("Stored image path does not belong to this record.");
    error.statusCode = 400;
    error.code = "INVALID_STORAGE_PATH";
    throw error;
  }
  return normalizedPath;
}

function pathFromLegacyUrl(value, bucketName = bucket?.name || "") {
  const raw = String(value || "").trim();
  if (!raw || !bucketName) return "";
  if (raw.startsWith(`gs://${bucketName}/`)) {
    return normalizeObjectPath(raw.slice(`gs://${bucketName}/`.length));
  }

  try {
    const url = new URL(raw);
    if (url.hostname === "storage.googleapis.com") {
      const prefix = `/${bucketName}/`;
      if (!url.pathname.startsWith(prefix)) return "";
      return normalizeObjectPath(decodeURIComponent(url.pathname.slice(prefix.length)));
    }
    if (url.hostname === "firebasestorage.googleapis.com") {
      const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
      if (!match || decodeURIComponent(match[1]) !== bucketName) return "";
      return normalizeObjectPath(decodeURIComponent(match[2]));
    }
  } catch {
    return "";
  }
  return "";
}

function isExternalHttpUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) &&
      !["storage.googleapis.com", "firebasestorage.googleapis.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

async function getSignedReadUrl({
  path,
  legacyUrl = "",
  expectedPrefix,
  expiresInMs = SIGNED_READ_URL_TTL_MS,
  storageBucket = bucket,
  now = Date.now(),
  logger = console,
} = {}) {
  const explicitPath = normalizeObjectPath(path);
  const legacyPath = explicitPath ? "" : pathFromLegacyUrl(legacyUrl, storageBucket?.name);
  const objectPath = explicitPath || legacyPath;

  if (!objectPath) return isExternalHttpUrl(legacyUrl) ? String(legacyUrl).trim() : "";
  if (!hasExpectedPrefix(objectPath, expectedPrefix) || !storageBucket) return "";

  try {
    const [signedUrl] = await storageBucket.file(objectPath).getSignedUrl({
      action: "read",
      expires: now + expiresInMs,
      version: "v4",
    });
    return signedUrl || "";
  } catch (error) {
    logger.warn(`[storage signed URL] ${objectPath}: ${error.message}`);
    return "";
  }
}

module.exports = {
  SIGNED_READ_URL_TTL_MS,
  normalizeObjectPath,
  hasExpectedPrefix,
  assertExpectedStoragePath,
  pathFromLegacyUrl,
  getSignedReadUrl,
};
