const { db, admin, bucket } = require("../config/firebase");
const { createNotificationForUsersBySetting } = require("../services/notificationService");

const ANNOUNCEMENT_COL = "announcements";

function isManagementRole(role) {
  return ["Admin", "Staff", "Veterinarian"].includes(role);
}

function normalizeAnnouncementType(value) {
  const type = String(value || "").toLowerCase().trim();
  if (type.includes("event")) return "Upcoming Events";
  if (type.includes("success")) return "Success Stories";
  return "News & Article";
}

function normalizeAnnouncementStatus(value) {
  return String(value || "Published").toLowerCase().trim() === "published"
    ? "Published"
    : "Draft";
}

function normalizeAnnouncement(data = {}) {
  const payload = {
    title: String(data.title || "").trim(),
    type: normalizeAnnouncementType(data.type),
    caption: String(data.caption || "").trim(),
    eventDate: String(data.eventDate || "").trim(),
    location: String(data.location || "").trim(),
    status: normalizeAnnouncementStatus(data.status),
    visibleToPublic: data.visibleToPublic !== false,
  };

  ["description", "body", "content", "summary", "source", "eventTime"].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      payload[field] = String(data[field] || "").trim();
    }
  });

  ["details", "storyParagraphs"].forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      payload[field] = Array.isArray(data[field]) ? data[field] : [];
    }
  });

  return payload;
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

    const announcements = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((item) => {
        // Older records did not always persist visibleToPublic. Management has
        // always treated those records as public, so the public endpoint must
        // use the same default instead of silently hiding them.
        return item.visibleToPublic !== false && normalizeAnnouncementStatus(item.status) === "Published";
      })
      .sort((a, b) => {
        const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return dateB - dateA;
      })
      .map((item) => ({
        id: item.id,
        title: item.title,
        type: normalizeAnnouncementType(item.type),
        caption: item.caption,
        description: item.description || "",
        body: item.body || "",
        content: item.content || "",
        summary: item.summary || "",
        details: Array.isArray(item.details) ? item.details : [],
        storyParagraphs: Array.isArray(item.storyParagraphs) ? item.storyParagraphs : [],
        imageUrl: item.imageUrl,
        eventDate: item.eventDate,
        eventTime: item.eventTime || "",
        location: item.location,
        source: item.source || item.createdByName || "ANIMUA City Government",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }));

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

    const announcements = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          type: normalizeAnnouncementType(data.type),
          status: normalizeAnnouncementStatus(data.status),
          visibleToPublic: data.visibleToPublic !== false,
        };
      })
      .sort((a, b) => {
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
    const extensionByMimeType = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const extension = extensionByMimeType[req.file.mimetype];
    if (!extension) {
      return res.status(400).json({ message: "Only JPG, PNG, and WebP images are allowed." });
    }

    uploadedImagePath = `announcements/${id}/cover-${Date.now()}.${extension}`;
    const imageFile = bucket.file(uploadedImagePath);
    await imageFile.save(req.file.buffer, {
      metadata: {
        contentType: req.file.mimetype,
        cacheControl: "public, max-age=31536000",
      },
      resumable: false,
    });
    await imageFile.makePublic();

    const imageUrl = `https://storage.googleapis.com/${bucket.name}/${uploadedImagePath}`;
    await announcementRef.update({
      imageUrl,
      imagePath: uploadedImagePath,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user.email || "",
    });

    if (announcementData.imagePath && announcementData.imagePath !== uploadedImagePath) {
      await bucket.file(announcementData.imagePath).delete().catch(() => {});
    }

    return res.status(200).json({
      message: "Announcement image uploaded successfully.",
      imageUrl,
    });
  } catch (error) {
    if (uploadedImagePath) {
      await bucket.file(uploadedImagePath).delete().catch(() => {});
    }
    console.error("[uploadAnnouncementImage]", error.message);
    return res.status(500).json({ message: "Failed to upload announcement image." });
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
    await announcementRef.update({
      imageUrl: "",
      imagePath: "",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user.email || "",
    });

    if (announcementData.imagePath) {
      await bucket.file(announcementData.imagePath).delete().catch(() => {});
    }

    return res.status(200).json({ message: "Announcement image removed successfully." });
  } catch (error) {
    console.error("[deleteAnnouncementImage]", error.message);
    return res.status(500).json({ message: "Failed to remove announcement image." });
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
    await announcementRef.delete();

    if (announcementData.imagePath) {
      await bucket.file(announcementData.imagePath).delete().catch(() => {});
    }

    return res.status(200).json({
      message: "Announcement deleted successfully.",
    });
  } catch (error) {
    console.error("[deleteAnnouncement]", error.message);
    return res.status(500).json({
      message: "Failed to delete announcement.",
    });
  }
};
