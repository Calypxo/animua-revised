const { db, admin } = require("../config/firebase");

const NOTIFICATION_COL = "notifications";
const USERS_COL = "users";

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizeSettings(settings = {}) {
  const source = settings && typeof settings === "object" ? settings : {};
  return {
    applicationUpdates: source.applicationUpdates !== false,
    surrenderRequestUpdates: source.surrenderRequestUpdates !== false,
    announcementsEvents: source.announcementsEvents !== false,
  };
}

async function getUserSettings(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return normalizeSettings();

  const userDoc = await db.collection(USERS_COL).doc(normalizedEmail).get();
  return normalizeSettings(userDoc.exists ? userDoc.data().notificationSettings : {});
}

function categoryEnabled(settings, category) {
  if (category === "application") return settings.applicationUpdates !== false;
  if (category === "surrender") return settings.surrenderRequestUpdates !== false;
  if (category === "event") return settings.announcementsEvents !== false;
  return true;
}

async function createUserNotification({
  userEmail,
  category = "general",
  type = "general",
  title = "ANIMUA update",
  message = "",
  link = "",
  referenceId = "",
  metadata = {},
  respectSettings = true,
}) {
  const email = normalizeEmail(userEmail);
  if (!email) return null;

  if (respectSettings) {
    const settings = await getUserSettings(email);
    if (!categoryEnabled(settings, category)) return null;
  }

  const docRef = await db.collection(NOTIFICATION_COL).add({
    userEmail: email,
    category,
    type,
    title: String(title || "ANIMUA update").trim(),
    message: String(message || "").trim(),
    link: String(link || "").trim(),
    referenceId: String(referenceId || "").trim(),
    metadata,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return docRef.id;
}

async function createNotificationForUsersBySetting(notification, settingKey) {
  const snapshot = await db.collection(USERS_COL).where("role", "==", "Public").get();
  const writes = [];

  snapshot.forEach((doc) => {
    const user = doc.data() || {};
    const settings = normalizeSettings(user.notificationSettings);
    const email = normalizeEmail(user.email || doc.id);

    if (!email || settings[settingKey] === false) return;

    writes.push(createUserNotification({
      ...notification,
      userEmail: email,
      respectSettings: false,
    }));
  });

  await Promise.allSettled(writes);
}

async function createManagementNotification({
  roles = ["Admin", "Staff"],
  type,
  resourceType,
  relatedResourceId,
  title,
  message = "",
  metadata = {},
}) {
  const allowedRoles = new Set(roles);
  const snapshot = await db.collection(USERS_COL).get();
  const recipients = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((user) => allowedRoles.has(user.role) && user.status !== "Inactive")
    .map((user) => normalizeEmail(user.email || user.id))
    .filter(Boolean);

  await Promise.allSettled(recipients.map((userEmail) => createUserNotification({
    userEmail,
    category: "management",
    type,
    title,
    message,
    referenceId: relatedResourceId,
    metadata: {
      ...metadata,
      resourceType,
      relatedResourceId: String(relatedResourceId || ""),
    },
    respectSettings: false,
  })));
  return recipients.length;
}

module.exports = {
  createUserNotification,
  createNotificationForUsersBySetting,
  createManagementNotification,
  normalizeNotificationSettings: normalizeSettings,
};
