const { db, admin } = require("../config/firebase");
const { normalizeNotificationSettings } = require("../services/notificationService");

const NOTIFICATION_COL = "notifications";
const EVENT_COL = "events";
const ANNOUNCEMENT_COL = "announcements";

function normalizeEmail(value = "") {
  return String(value || "").trim().toLowerCase();
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

    const snapshot = await db.collection(NOTIFICATION_COL).where("userEmail", "==", email).get();
    const stored = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data(), createdAt: serializeDate(doc.data().createdAt) }))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const managementUser = ["Admin", "Staff", "Veterinarian"].includes(req.user?.role);
    const eventNotices = !managementUser && settings.announcementsEvents ? await getEventNotices() : [];
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
    if (!snap.exists || normalizeEmail(snap.data().userEmail) !== email) {
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

    const snapshot = await db.collection(NOTIFICATION_COL)
      .where("userEmail", "==", email)
      .where("read", "==", false)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        read: true,
        readAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();

    return res.json({ message: "Notifications marked as read.", updated: snapshot.size });
  } catch (error) {
    console.error("[markMyNotificationsRead]", error.message);
    return res.status(500).json({ message: "Failed to update notifications." });
  }
};
