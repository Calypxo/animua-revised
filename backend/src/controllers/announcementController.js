const { db, admin, bucket } = require("../config/firebase");
const { createNotificationForUsersBySetting } = require("../services/notificationService");
const {
  assertExpectedStoragePath,
  getSignedReadUrl,
} = require("../services/storageUrlService");
const { validateImageFile } = require("../utils/imageUploadPolicy");

const ANNOUNCEMENT_COL = "announcements";

function isManagementRole(role) {
  return ["Admin", "Staff", "Veterinarian"].includes(role);
}

function isRescueAnnouncement(data = {}) {
  const searchableText = [
    data.title,
    data.caption,
    data.description,
    data.body,
    data.content,
    data.summary,
    ...(Array.isArray(data.details) ? data.details : []),
    ...(Array.isArray(data.storyParagraphs) ? data.storyParagraphs : []),
  ].join(" ").toLowerCase();

  return /\b(?:rescue|rescued|rescuing|rescues)\b|(?:pag|na)-rescue|nailigtas/.test(searchableText);
}

function normalizeAnnouncementType(value, data = {}) {
  const type = String(value || "").toLowerCase().trim();
  if (type.includes("event")) return "Upcoming Events";
  if (type.includes("success")) return "Success Stories";
  if (type.includes("rescue") || isRescueAnnouncement(data)) return "Rescue";
  return "News & Alerts";
}

function normalizeAnnouncementStatus(value) {
  return String(value || "Published").toLowerCase().trim() === "published"
    ? "Published"
    : "Draft";
}

function normalizeAnnouncementText(value = "") {
  return String(value || "").normalize("NFKC").trim();
}

function normalizeAnnouncement(data = {}) {
  const payload = {
    title: normalizeAnnouncementText(data.title),
    type: normalizeAnnouncementType(data.type, data),
    caption: normalizeAnnouncementText(data.caption),
    eventDate: normalizeAnnouncementText(data.eventDate),
    location: normalizeAnnouncementText(data.location),
    status: normalizeAnnouncementStatus(data.status),
    visibleToPublic: data.visibleToPublic !== false,
  };

  ["description", "body", "content", "summary", "source", "eventTime"].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      payload[field] = normalizeAnnouncementText(data[field]);
    }
  });

  ["details", "storyParagraphs"].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      payload[field] = Array.isArray(data[field])
        ? data[field].map((item) => normalizeAnnouncementText(item)).filter(Boolean)
        : [];
    }
  });

  return payload;
}

async function serializeAnnouncementImage(id, data = {}) {
  const announcement = { id, ...data };
  announcement.imageUrl = await getSignedReadUrl({
    path: data.imagePath,
    legacyUrl: data.imageUrl || data.imageURL || data.coverImage || "",
    expectedPrefix: `announcements/${id}`,
  });
  delete announcement.imagePath;
  delete announcement.imageURL;
  delete announcement.coverImage;
  return announcement;
}

function normalizeSerializedAnnouncement(data = {}) {
  return {
    ...data,
    title: normalizeAnnouncementText(data.title),
    caption: normalizeAnnouncementText(data.caption),
    description: normalizeAnnouncementText(data.description),
    body: normalizeAnnouncementText(data.body),
    content: normalizeAnnouncementText(data.content),
    summary: normalizeAnnouncementText(data.summary),
    source: normalizeAnnouncementText(data.source),
    eventDate: normalizeAnnouncementText(data.eventDate),
    eventTime: normalizeAnnouncementText(data.eventTime),
    location: normalizeAnnouncementText(data.location),
    details: Array.isArray(data.details)
      ? data.details.map((detail) => normalizeAnnouncementText(detail)).filter(Boolean)
      : [],
    storyParagraphs: Array.isArray(data.storyParagraphs)
      ? data.storyParagraphs.map((paragraph) => normalizeAnnouncementText(paragraph)).filter(Boolean)
      : [],
  };
}

function shouldNotifyEventAnnouncement(data = {}) {
  return data.type === "Upcoming Events" &&
    data.status === "Published" &&
    data.visibleToPublic !== false;
}

async function notifyEventAnnouncement(announcementId, data = {}) {
  if (!shouldNotifyEventAnnouncement(data)) return;

  await createNotificationForUsersBySetting({
    category: "event",
    type: "event_announcement",
    title: data.title || "Upcoming ANIMUA event",
    message: data.caption || data.description || "A new ANIMUA event is available.",
    link: "/pages/public/announcements.html",
    referenceId: announcementId,
    metadata: {
      eventDate: data.eventDate || "",
      eventTime: data.eventTime || "",
      location: data.location || "",
    },
  }, "announcementsEvents");
}

exports.getPublicAnnouncements = async (req, res) => {
  try {
    const snapshot = await db
      .collection(ANNOUNCEMENT_COL)
      .get();

    const visibleAnnouncements = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((item) => {
        // Older records did not always persist visibleToPublic. Management has
        // always treated those records as public, so the public endpoint must
        // use the same default instead of silently hiding them.
        return item.visibleToPublic !== false && normalizeAnnouncementStatus(item.status) === "Published";
      });
    const announcements = await Promise.all(
      visibleAnnouncements.map(async (item) => {
        const signed = await serializeAnnouncementImage(item.id, item);
        return {
          id: item.id,
          title: normalizeAnnouncementText(item.title),
          type: normalizeAnnouncementType(item.type, item),
          caption: normalizeAnnouncementText(item.caption),
          description: normalizeAnnouncementText(item.description),
          body: normalizeAnnouncementText(item.body),
          content: normalizeAnnouncementText(item.content),
          summary: normalizeAnnouncementText(item.summary),
          details: Array.isArray(item.details)
            ? item.details.map((detail) => normalizeAnnouncementText(detail)).filter(Boolean)
            : [],
          storyParagraphs: Array.isArray(item.storyParagraphs)
            ? item.storyParagraphs.map((paragraph) => normalizeAnnouncementText(paragraph)).filter(Boolean)
            : [],
          imageUrl: signed.imageUrl,
          eventDate: normalizeAnnouncementText(item.eventDate),
          eventTime: normalizeAnnouncementText(item.eventTime),
          location: normalizeAnnouncementText(item.location),
          source: normalizeAnnouncementText(item.source || item.createdByName || "ANIMUA City Government"),
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      })
    );
    announcements.sort((a, b) => {
        const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return dateB - dateA;
      });

    res.set("Cache-Control", "no-store");
    return res.status(200).json({ announcements });
  } catch (error) {
    console.error("[getPublicAnnouncements]", error);
    return res.status(500).json({
      message: "Failed to load public announcements.",
      error: error.message,
    });
  }
};

exports.getAllAnnouncements = async (req, res) => {
  try {
    if (!isManagementRole(req.user?.role)) {
      return res.status(403).json({
        message: "Only management users can view announcements.",
      });
    }

    const snapshot = await db
      .collection(ANNOUNCEMENT_COL)
      .get();

    const announcements = await Promise.all(snapshot.docs
      .map(async (doc) => {
        const data = doc.data();
        return serializeAnnouncementImage(doc.id, normalizeSerializedAnnouncement({
          ...data,
          type: normalizeAnnouncementType(data.type, data),
          status: normalizeAnnouncementStatus(data.status),
          visibleToPublic: data.visibleToPublic !== false,
        }));
      }));
    announcements.sort((a, b) => {
        const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return dateB - dateA;
      });

    return res.status(200).json({ announcements });
  } catch (error) {
    console.error("[getAllAnnouncements]", error);
    return res.status(500).json({
      message: "Failed to load announcements.",
      error: error.message,
    });
  }
};

exports.createAnnouncement = async (req, res) => {
  try {
    if (!isManagementRole(req.user?.role)) {
      return res.status(403).json({
        message: "Only management users can create announcements.",
      });
    }

    const payload = normalizeAnnouncement(req.body);

    if (!payload.title) {
      return res.status(400).json({
        message: "Title is required.",
      });
    }

    if (!payload.caption) {
      return res.status(400).json({
        message: "Caption or description is required.",
      });
    }

    const announcementData = {
      ...payload,
      imageUrl: "",
      imagePath: "",

      createdBy: req.user.email || "",
      createdByName: req.user.fullName || req.user.email || "ANIMUA User",
      createdByRole: req.user.role || "",

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user.email || "",
    };

    const docRef = await db
      .collection(ANNOUNCEMENT_COL)
      .add(announcementData);

    await notifyEventAnnouncement(docRef.id, announcementData);

    return res.status(201).json({
      message: "Announcement created successfully.",
      announcementId: docRef.id,
    });
  } catch (error) {
    console.error("[createAnnouncement]", error.message);
    return res.status(500).json({
      message: "Failed to create announcement.",
    });
  }
};

exports.updateAnnouncement = async (req, res) => {
  try {
    if (!isManagementRole(req.user?.role)) {
      return res.status(403).json({
        message: "Only management users can update announcements.",
      });
    }

    const { id } = req.params;
    const announcementRef = db.collection(ANNOUNCEMENT_COL).doc(id);
    const announcementDoc = await announcementRef.get();

    if (!announcementDoc.exists) {
      return res.status(404).json({
        message: "Announcement not found.",
      });
    }

    const payload = normalizeAnnouncement(req.body);

    if (!payload.title) {
      return res.status(400).json({
        message: "Title is required.",
      });
    }

    if (!payload.caption) {
      return res.status(400).json({
        message: "Caption or description is required.",
      });
    }

    await announcementRef.update({
      ...payload,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user.email || "",
    });

    await notifyEventAnnouncement(id, payload);

    return res.status(200).json({
      message: "Announcement updated successfully.",
    });
  } catch (error) {
    console.error("[updateAnnouncement]", error.message);
    return res.status(500).json({
      message: "Failed to update announcement.",
    });
  }
};

exports.uploadAnnouncementImage = async (req, res) => {
  let uploadedImagePath = "";

  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ message: "No image file uploaded." });
    }

    const announcementRef = db.collection(ANNOUNCEMENT_COL).doc(id);
    const announcementDoc = await announcementRef.get();
    if (!announcementDoc.exists) {
      return res.status(404).json({ message: "Announcement not found." });
    }

    const announcementData = announcementDoc.data();
    const previousPath = announcementData.imagePath
      ? assertExpectedStoragePath(announcementData.imagePath, `announcements/${id}`)
      : "";
    const extension = validateImageFile(
      req.file,
      "The cover photo must be 5 MB or smaller."
    );

    uploadedImagePath = `announcements/${id}/cover-${Date.now()}.${extension}`;
    const imageFile = bucket.file(uploadedImagePath);
    await imageFile.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype,
        cacheControl: "private, max-age=1800",
      },
      resumable: false,
    });
    await announcementRef.update({
      imageUrl: "",
      imagePath: uploadedImagePath,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user.email || "",
    });

    if (previousPath && previousPath !== uploadedImagePath) {
      await bucket.file(previousPath).delete().catch(() => {});
    }

    const imageUrl = await getSignedReadUrl({
      path: uploadedImagePath,
      expectedPrefix: `announcements/${id}`,
    });

    return res.status(200).json({
      message: "Announcement image uploaded successfully.",
      imageUrl,
    });
  } catch (error) {
    if (uploadedImagePath) {
      await bucket.file(uploadedImagePath).delete().catch(() => {});
    }
    console.error("[uploadAnnouncementImage]", error.message);
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Failed to upload announcement image.",
    });
  }
};

exports.deleteAnnouncementImage = async (req, res) => {
  try {
    const { id } = req.params;
    const announcementRef = db.collection(ANNOUNCEMENT_COL).doc(id);
    const announcementDoc = await announcementRef.get();
    if (!announcementDoc.exists) {
      return res.status(404).json({ message: "Announcement not found." });
    }

    const announcementData = announcementDoc.data();
    const imagePath = announcementData.imagePath
      ? assertExpectedStoragePath(announcementData.imagePath, `announcements/${id}`)
      : "";

    if (imagePath) {
      await bucket.file(imagePath).delete().catch(() => {});
    }

    await announcementRef.update({
      imageUrl: "",
      imagePath: "",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user.email || "",
    });

    return res.status(200).json({ message: "Announcement image removed successfully." });
  } catch (error) {
    console.error("[deleteAnnouncementImage]", error.message);
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Failed to remove announcement image.",
    });
  }
};

exports.deleteAnnouncement = async (req, res) => {
  try {
    if (req.user?.role !== "Admin") {
      return res.status(403).json({
        message: "Only Admin can delete announcements.",
      });
    }

    const { id } = req.params;
    const announcementRef = db.collection(ANNOUNCEMENT_COL).doc(id);
    const announcementDoc = await announcementRef.get();

    if (!announcementDoc.exists) {
      return res.status(404).json({
        message: "Announcement not found.",
      });
    }

    const announcementData = announcementDoc.data();
    const imagePath = announcementData.imagePath
      ? assertExpectedStoragePath(announcementData.imagePath, `announcements/${id}`)
      : "";
    await announcementRef.delete();

    if (imagePath) {
      await bucket.file(imagePath).delete().catch(() => {});
    }

    return res.status(200).json({
      message: "Announcement deleted successfully.",
    });
  } catch (error) {
    console.error("[deleteAnnouncement]", error.message);
    return res.status(error.statusCode || 500).json({
      message: error.statusCode ? error.message : "Failed to delete announcement.",
    });
  }
};
