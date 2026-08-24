const { db, admin } = require("../config/firebase");
const { normalizeNotificationSettings } = require("../services/notificationService");
const {
  normalizeToken,
  registerPushSubscription,
  unregisterPushSubscription,
} = require("../services/pushNotificationService");

const NOTIFICATION_COL = "notifications";
const EVENT_COL = "events";
const ANNOUNCEMENT_COL = "announcements";

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
}

function isManagementUser(user = {}) {
  return ["Admin", "Staff", "Veterinarian"].includes(user.role);
}

function notificationAudience(req) {
  const requested = String(req.query?.audience || "").trim().toLowerCase();
  if (requested === "public") return "public";
  return isManagementUser(req.user) ? "management" : "public";
}

function belongsToAudience(notification = {}, audience = "public") {
  const isManagementNotification = notification.category === "management";
  return audience === "management" ? isManagementNotification : !isManagementNotification;
}

function serializeDate(value) {
  if (!value) return "";
  if (value.toDate) return value.toDate().toISOString();
  if (value.seconds) return new Date(value.seconds * 1000).toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function isPublishedEvent(item = {}) {
  const type = String(item.type || item.category || "").toLowerCase();
  const status = String(item.status || item.state || item.publishStatus || "").toLowerCase();
  const isEvent = type.includes("event");
  const published = item.published === true || item.visibleToPublic !== false || status.includes("publish");
  const draft = status.includes("draft") || status.includes("unpublish") || item.published === false;
  return isEvent && published && !draft;
}

function eventNoticeFromDoc(doc) {
  const data = doc.data() || {};
  return {
    id: `event-${doc.id}`,
    category: "event",
    type: "event",
    title: data.title || "Upcoming event",
    message: data.caption || data.description || data.summary || "A new ANIMUA event is available.",
    link: "/pages/public/announcements.html",
    referenceId: doc.id,
    read: true,
    createdAt: serializeDate(data.updatedAt || data.createdAt || data.eventDate),
    eventDate: data.eventDate || data.date || "",
  };
}

async function getEventNotices() {
  const [eventsSnapshot, announcementsSnapshot] = await Promise.all([
    db.collection(EVENT_COL).get().catch(() => ({ docs: [] })),
    db.collection(ANNOUNCEMENT_COL).get().catch(() => ({ docs: [] })),
  ]);

  return [...eventsSnapshot.docs, ...announcementsSnapshot.docs]
    .filter((doc) => isPublishedEvent(doc.data() || {}))
    .map(eventNoticeFromDoc)
    .sort((a, b) => new Date(b.createdAt || b.eventDate || 0) - new Date(a.createdAt || a.eventDate || 0))
    .slice(0, 8);
}

exports.getMyNotifications = async (req, res) => {
  try {
    const email = normalizeEmail(req.user?.email);
    if (!email) return res.status(401).json({ message: "Please log in to view notifications." });

    const userDoc = await db.collection("users").doc(email).get();
    const settings = normalizeNotificationSettings(userDoc.exists ? userDoc.data().notificationSettings : {});

    const audience = notificationAudience(req);
    const snapshot = await db.collection(NOTIFICATION_COL).where("userEmail", "==", email).get();
    const stored = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data(), createdAt: serializeDate(doc.data().createdAt) }))
      .filter((item) => belongsToAudience(item, audience))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const eventNotices = audience === "public" && settings.announcementsEvents ? await getEventNotices() : [];
    const notifications = [...stored, ...eventNotices]
      .sort((a, b) => new Date(b.createdAt || b.eventDate || 0) - new Date(a.createdAt || a.eventDate || 0))
      .slice(0, 20);

    return res.json({
      notifications,
      unreadCount: stored.filter((item) => item.read !== true).length,
      settings,
    });
  } catch (error) {
    console.error("[getMyNotifications]", error.message);
    return res.status(500).json({ message: "Failed to load notifications." });
  }
};

exports.markMyNotificationRead = async (req, res) => {
  try {
    const email = normalizeEmail(req.user?.email);
    if (!email) return res.status(401).json({ message: "Please log in to update notifications." });
    const ref = db.collection(NOTIFICATION_COL).doc(String(req.params.id || ""));
    const snap = await ref.get();
    const audience = notificationAudience(req);
    if (
      !snap.exists ||
      normalizeEmail(snap.data().userEmail) !== email ||
      !belongsToAudience(snap.data(), audience)
    ) {
      return res.status(404).json({ message: "Notification not found." });
    }
    if (snap.data().read !== true) {
      await ref.update({ read: true, readAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    const unread = await db.collection(NOTIFICATION_COL)
      .where("userEmail", "==", email)
      .where("read", "==", false)
      .get();
    return res.json({ message: "Notification marked as read.", unreadCount: unread.size });
  } catch (error) {
    console.error("[markMyNotificationRead]", error.message);
    return res.status(500).json({ message: "Failed to update the notification." });
  }
};

exports.markMyNotificationsRead = async (req, res) => {
  try {
    const email = normalizeEmail(req.user?.email);
    if (!email) return res.status(401).json({ message: "Please log in to update notifications." });

    const audience = notificationAudience(req);
    const snapshot = await db.collection(NOTIFICATION_COL)
      .where("userEmail", "==", email)
      .where("read", "==", false)
      .get();

    const batch = db.batch();
    const matchingDocs = snapshot.docs.filter((doc) => belongsToAudience(doc.data(), audience));
    matchingDocs.forEach((doc) => {
      batch.update(doc.ref, {
        read: true,
        readAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();

    return res.json({ message: "Notifications marked as read.", updated: matchingDocs.length });
  } catch (error) {
    console.error("[markMyNotificationsRead]", error.message);
    return res.status(500).json({ message: "Failed to update notifications." });
  }
};

exports.registerMyPushSubscription = async (req, res) => {
  try {
    const token = normalizeToken(req.body?.token);
    if (!token) {
      return res.status(400).json({ message: "A valid browser notification token is required." });
    }

    const subscriptionId = await registerPushSubscription({
      user: req.user,
      token,
      userAgent: req.body?.userAgent || req.get("user-agent") || "",
    });
    if (!subscriptionId) {
      return res.status(400).json({ message: "Unable to register this browser for notifications." });
    }

    return res.status(201).json({
      message: "Browser notifications are enabled.",
      subscriptionId,
    });
  } catch (error) {
    console.error("[registerMyPushSubscription]", error.message);
    return res.status(500).json({ message: "Failed to enable browser notifications." });
  }
};

exports.unregisterMyPushSubscription = async (req, res) => {
  try {
    const token = normalizeToken(req.body?.token);
    if (!token) {
      return res.status(400).json({ message: "A valid browser notification token is required." });
    }

    const removed = await unregisterPushSubscription({ user: req.user, token });
    return res.json({
      message: "Browser notifications are disabled for this device.",
      removed,
    });
  } catch (error) {
    console.error("[unregisterMyPushSubscription]", error.message);
    return res.status(500).json({ message: "Failed to disable browser notifications." });
  }
};
