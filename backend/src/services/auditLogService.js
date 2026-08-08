const admin = require("firebase-admin");
const { db } = require("../config/firebase");

const SENSITIVE_KEY_PATTERN = /password|passcode|token|secret|hash|authorization|credential|otp/i;

function sanitizeAuditValue(value, depth = 0) {
  if (depth > 4) return "[Nested data omitted]";
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeAuditValue(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_KEY_PATTERN.test(key))
        .map(([key, item]) => [key, sanitizeAuditValue(item, depth + 1)])
    );
  }
  return value;
}

async function writeAuditEvent({
  action,
  module,
  targetId,
  targetName,
  user = {},
  before = {},
  after = {},
  status = "Success",
  details = "",
  ipAddress = "Not recorded",
}) {
  if (!action || !module) return;

  await db.collection("auditLogs").add({
    action: String(action),
    module: String(module),
    targetId: String(targetId || "system"),
    targetName: String(targetName || targetId || "System record"),
    performedBy: user.email || user.id || "System",
    performedByName: user.fullName || user.name || user.email || "System",
    role: user.role || "System",
    before: sanitizeAuditValue(before),
    after: sanitizeAuditValue(after),
    status,
    details: details ? String(details) : "",
    ipAddress: String(ipAddress || "Not recorded"),
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

module.exports = { sanitizeAuditValue, writeAuditEvent };
