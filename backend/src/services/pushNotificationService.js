const crypto = require("crypto");
const { db, admin } = require("../config/firebase");

const PUSH_SUBSCRIPTIONS_COL = "pushSubscriptions";
const MANAGEMENT_APP_BASE_URL = String(
  process.env.MANAGEMENT_APP_BASE_URL || "https://animua-admin.web.app"
).replace(/\/+$/, "");
const INVALID_TOKEN_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizeToken(value = "") {
  const token = String(value || "").trim();
  if (token.length < 20 || token.length > 4096 || /\s/.test(token)) return "";
  return token;
}

function subscriptionId(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function managementLink(path = "") {
  const candidate = String(path || "").trim();
  if (!candidate) return `${MANAGEMENT_APP_BASE_URL}/pages/dashboard.html`;
  try {
    const url = new URL(candidate, `${MANAGEMENT_APP_BASE_URL}/`);
    return url.origin === new URL(MANAGEMENT_APP_BASE_URL).origin
      ? url.toString()
      : `${MANAGEMENT_APP_BASE_URL}/pages/dashboard.html`;
  } catch {
    return `${MANAGEMENT_APP_BASE_URL}/pages/dashboard.html`;
  }
}

async function registerPushSubscription({ user = {}, token, userAgent = "" }) {
  const normalizedToken = normalizeToken(token);
  const userEmail = normalizeEmail(user.email || user.id);
  if (!normalizedToken || !userEmail) return null;

  const id = subscriptionId(normalizedToken);
  const reference = db.collection(PUSH_SUBSCRIPTIONS_COL).doc(id);
  const existing = await reference.get();
  const timestamps = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await reference.set({
    token: normalizedToken,
    userEmail,
    userId: String(user.id || user.uid || userEmail),
    role: String(user.role || ""),
    platform: "web",
    status: "Active",
    userAgent: String(userAgent || "").slice(0, 320),
    ...(existing.exists ? {} : {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }),
    ...timestamps,
  }, { merge: true });

  return id;
}

async function unregisterPushSubscription({ user = {}, token }) {
  const normalizedToken = normalizeToken(token);
  const userEmail = normalizeEmail(user.email || user.id);
  if (!normalizedToken || !userEmail) return false;

  const reference = db.collection(PUSH_SUBSCRIPTIONS_COL).doc(subscriptionId(normalizedToken));
  const snapshot = await reference.get();
  if (!snapshot.exists || normalizeEmail(snapshot.data().userEmail) !== userEmail) return false;
  await reference.delete();
  return true;
}

async function removeInvalidSubscriptions(documents, responses) {
  const invalid = [];
  responses.forEach((response, index) => {
    if (!response.success && INVALID_TOKEN_CODES.has(response.error?.code)) {
      invalid.push(documents[index]?.ref?.delete());
    }
  });
  await Promise.allSettled(invalid.filter(Boolean));
}

async function sendPushNotificationToUser({
  userEmail,
  title,
  message = "",
  link = "",
  type = "general",
  referenceId = "",
}) {
  const email = normalizeEmail(userEmail);
  if (!email) return { attempted: 0, sent: 0, failed: 0 };

  const snapshot = await db.collection(PUSH_SUBSCRIPTIONS_COL)
    .where("userEmail", "==", email)
    .get();
  const subscriptions = snapshot.docs
    .filter((document) => document.data().status !== "Inactive")
    .map((document) => ({ document, token: normalizeToken(document.data().token) }))
    .filter((subscription) => Boolean(subscription.token))
    .slice(0, 500);
  const documents = subscriptions.map((subscription) => subscription.document);
  const tokens = subscriptions.map((subscription) => subscription.token);
  if (!tokens.length) return { attempted: 0, sent: 0, failed: 0 };

  const destination = managementLink(link);
  const result = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: String(title || "ANIMUA management update").slice(0, 120),
      body: String(message || "Open Management to review this update.").slice(0, 240),
    },
    data: {
      link: destination,
      type: String(type || "general").slice(0, 80),
      referenceId: String(referenceId || "").slice(0, 180),
    },
    webpush: {
      headers: { Urgency: "high" },
      notification: {
        icon: `${MANAGEMENT_APP_BASE_URL}/pwa-192.png`,
        badge: `${MANAGEMENT_APP_BASE_URL}/favicon.png`,
        tag: `${String(type || "animua")}-${String(referenceId || email)}`.slice(0, 180),
        renotify: true,
      },
      fcmOptions: { link: destination },
    },
  });

  await removeInvalidSubscriptions(documents, result.responses || []);
  return {
    attempted: tokens.length,
    sent: result.successCount || 0,
    failed: result.failureCount || 0,
  };
}

module.exports = {
  MANAGEMENT_APP_BASE_URL,
  PUSH_SUBSCRIPTIONS_COL,
  managementLink,
  normalizeToken,
  registerPushSubscription,
  sendPushNotificationToUser,
  subscriptionId,
  unregisterPushSubscription,
};
