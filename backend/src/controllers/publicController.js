const { admin, db } = require("../config/firebase");
const nodemailer = require("nodemailer");
const path = require("path");
const sharp = require("sharp");
const { getSpecialNeedsStatus } = require("../services/specialNeedsService");
const {
  buildShelterLabel,
} = require("../utils/animalIdentity");
const { getSignedReadUrl } = require("../services/storageUrlService");
const {
  invalidateAttentionCache,
} = require("./dashboardController");
const { createUserNotification, createManagementNotification } = require("../services/notificationService");

const ANIMAL_COL = "animals";
const EVENT_COL = "events";
const CONTACT_COL = "contactMessages";
const CONTACT_RECIPIENT =
  process.env.CONTACT_EMAIL ||
  process.env.EMAIL_USER ||
  "AngelesCityVeterinaryOffice@animua.local";
const OPTIMIZED_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const OPTIMIZED_IMAGE_ALLOWED_HOSTS = new Set([
  "storage.googleapis.com",
  "firebasestorage.googleapis.com",
]);

const contactTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function updateContactNotification(reference, updates) {
  try {
    await reference.update({
      ...updates,
      notificationUpdatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[contactNotificationStatus]", error.message);
  }
}

const normalizeContactText = (value = "", maxLength = 1000) =>
  typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";

const escapeEmailHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const isValidEmail = (value = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());

function parseImageWidth(value) {
  const width = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(width)) return 380;
  return Math.min(900, Math.max(96, width));
}

exports.getOptimizedImage = async (req, res) => {
  try {
    const source = String(req.query.src || "").trim();
    const width = parseImageWidth(req.query.width);

    if (!source) {
      return res.status(400).json({ message: "Image source is required." });
    }

    let sourceUrl;
    try {
      sourceUrl = new URL(source);
    } catch {
      return res.status(400).json({ message: "Invalid image source." });
    }

    if (!OPTIMIZED_IMAGE_ALLOWED_HOSTS.has(sourceUrl.hostname)) {
      return res.status(400).json({ message: "Image source is not allowed." });
    }

    const upstream = await fetch(sourceUrl, {
      headers: { Accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ message: "Unable to load image." });
    }

    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return res.status(415).json({ message: "Source is not an image." });
    }

    const length = Number(upstream.headers.get("content-length") || 0);
    if (length > OPTIMIZED_IMAGE_MAX_BYTES) {
      return res.status(413).json({ message: "Image is too large to optimize." });
    }

    const input = Buffer.from(await upstream.arrayBuffer());
    if (input.length > OPTIMIZED_IMAGE_MAX_BYTES) {
      return res.status(413).json({ message: "Image is too large to optimize." });
    }

    const output = await sharp(input, { failOn: "none" })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 72, effort: 4 })
      .toBuffer();

    res.set({
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(output.length),
      "Vary": "Accept",
    });
    return res.status(200).send(output);
  } catch (error) {
    console.error("[getOptimizedImage]", error.message);
    return res.status(500).json({ message: "Failed to optimize image." });
  }
};

const getEventDateValue = (event = {}) => {
  const value =
    event.date ||
    event.eventDate ||
    event.startDate ||
    event.startsAt ||
    event.startAt ||
    "";

  if (value?.toDate) return value.toDate().getTime();
  if (value?._seconds) return value._seconds * 1000;
  if (typeof value === "number") return value;

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const serializeEventDate = (value) => {
  if (!value) return "";
  if (value?.toDate) return value.toDate().toISOString();
  if (value?._seconds) return new Date(value._seconds * 1000).toISOString();
  return value;
};

const serializeContactDate = (value) => {
  if (!value) return "";
  if (value?.toDate) return value.toDate().toISOString();
  if (value?._seconds) return new Date(value._seconds * 1000).toISOString();
  if (value?.seconds) return new Date(value.seconds * 1000).toISOString();
  return value;
};

const buildContactThread = (data = {}) => {
  const storedMessages = Array.isArray(data.messages) ? data.messages : [];
  const messages = storedMessages
    .map((item) => {
      const isManagementSender = ["admin", "staff"].includes(
        String(item.sender || "").trim().toLowerCase()
      );
      return {
        sender: isManagementSender ? "admin" : "user",
        name:
          item.name ||
          (isManagementSender ? "ANIMUA Team" : data.fullName || "User"),
        message: item.message || "",
        createdAt: serializeContactDate(item.createdAt),
      };
    })
    .filter((item) => item.message);

  if (!messages.length && data.message) {
    messages.push({
      sender: "user",
      name: data.fullName || "User",
      message: data.message,
      createdAt: serializeContactDate(data.createdAt),
    });
  }

  if (!storedMessages.length && data.replyMessage) {
    messages.push({
      sender: "admin",
      name: data.repliedBy || "ANIMUA Team",
      message: data.replyMessage,
      createdAt: serializeContactDate(data.repliedAt),
    });
  }

  return messages.sort((a, b) => {
    const dateA = Date.parse(a.createdAt) || 0;
    const dateB = Date.parse(b.createdAt) || 0;
    return dateA - dateB;
  });
};

const getLatestUserMessage = (messages = [], fallback = "") => {
  const latestUser = [...messages].reverse().find((item) => item.sender === "user");
  return latestUser?.message || fallback || "";
};

const isPublishedEvent = (event = {}) => {
  const status = String(event.status || event.state || event.publishStatus || "").toLowerCase();
  const archived =
    event.archived === true ||
    event.isArchived === true ||
    status.includes("archive");
  const unpublished =
    event.published === false ||
    event.isPublished === false ||
    status.includes("draft") ||
    status.includes("unpublish") ||
    status.includes("private");
  const published =
    event.published === true ||
    event.isPublished === true ||
    event.isPublic === true ||
    status.includes("publish") ||
    status.includes("upcoming") ||
    status.includes("active") ||
    status.includes("live");

  return published && !unpublished && !archived;
};

const normalizeAnimalStatus = (value = "") =>
  String(value || "").trim().toLowerCase().replace(/[_-]+/g, " ");

const isPublicReadyAnimal = (animal = {}) => {
  const status = normalizeAnimalStatus(animal.status);
  const currentStage = normalizeAnimalStatus(animal.currentStage);
  const adoptionStatus = normalizeAnimalStatus(animal.adoptionStatus);
  const visibility = normalizeAnimalStatus(animal.visibility || animal.publicStatus);

  const blocked =
    animal.archived === true ||
    animal.isArchived === true ||
    animal.isPublic === false ||
    animal.public === false ||
    [status, currentStage, adoptionStatus, visibility].some((value) =>
      value.includes("archive") ||
      value.includes("adopted") ||
      value.includes("unavailable") ||
      value.includes("reserved") ||
      value.includes("hidden") ||
      value.includes("private")
    );

  if (blocked) return false;

  return (
    status === "ready" ||
    status.includes("ready for adoption") ||
    status.includes("adoption ready") ||
    currentStage === "adoption" ||
    adoptionStatus === "ready" ||
    adoptionStatus.includes("ready for adoption") ||
    animal.readyForAdoption === true ||
    animal.availableForAdoption === true
  );
};

const serializePublicPet = async (doc) => {
  const data = doc.data();
  const displayLabel = buildShelterLabel(data, doc.id);
  const photoURL = await getSignedReadUrl({
    path: data.photoPath,
    legacyUrl: data.photoURL || data.photoUrl || data.imageUrl || "",
    expectedPrefix: `animals/${doc.id}`,
  });

  return {
    id: doc.id,
    name: data.adoptedName || "",
    displayLabel,
    shelterLabel: displayLabel,
    identifyingDescription:
      data.identifyingDescription || displayLabel,
    species: data.species || "",
    breed: data.breed || "",
    sex: data.sex || "Unknown",
    ageEstimate: data.ageEstimate || "",
    color: data.color || "",
    colorMarkings: data.colorMarkings || data.color || "",
    photoURL,
    source: data.source || "",
    intakeDate: data.intakeDate || "",
    readyForAdoptionAt: data.readyForAdoptionAt || "",
    createdAt: data.createdAt || "",
    updatedAt: data.updatedAt || "",
    intakeLocation: data.intakeLocation || "",
    initialCondition: data.initialCondition || "",
    conditionNotes: data.conditionNotes || "",
    publicDescription: data.publicDescription || "",
    vaccinated: data.vaccinated || "Unknown",
    alteredStatus: data.alteredStatus || "Unknown",
    visibleDefects: data.visibleDefects || "",
    specialNeedsStatus: getSpecialNeedsStatus(data),
    specialNeedsNotes: data.specialNeedsNotes || "",
    behavioralAssessment: data.behavioralAssessment || null,
    status: data.status || "Ready",
  };
};

const isAdoptedAnimal = (animal = {}) => {
  const status = String(animal.status || animal.adoptionStatus || "").toLowerCase();
  return status.includes("adopted") || status.includes("finalized");
};

const serializeAdoptedStory = async (doc) => {
  const data = doc.data() || {};
  const displayLabel = buildShelterLabel(data, doc.id);
  const photoURL = await getSignedReadUrl({
    path: data.photoPath,
    legacyUrl: data.photoURL || data.photoUrl || data.imageUrl || "",
    expectedPrefix: `animals/${doc.id}`,
  });
  return {
    id: doc.id,
    name: data.adoptedName || "",
    displayLabel,
    shelterLabel: displayLabel,
    species: data.species || "",
    breed: data.breed || "",
    sex: data.sex || "Unknown",
    ageEstimate: data.ageEstimate || "",
    photoURL,
    status: data.status || "",
    adoptionStatus: data.adoptionStatus || "",
    adoptionDate: data.adoptionDate || "",
    approvedAt: data.approvedAt || "",
    updatedAt: data.updatedAt || "",
    createdAt: data.createdAt || "",
  };
};

/**
 * GET /api/public/pets
 * Public-facing list of adoptable animals
 *
 * Optional query params:
 * - species=Dog
 * - sex=Male
 * - search=buddy
 */
exports.getPublicPets = async (req, res) => {
  try {
    const { species, sex, search } = req.query;
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

    const snapshot = await db.collection(ANIMAL_COL).get();

    let pets = await Promise.all(
      snapshot.docs
        .filter((doc) => isPublicReadyAnimal(doc.data() || {}))
        .map(serializePublicPet)
    );

    // Optional frontend filters
    if (species) {
      pets = pets.filter((pet) => pet.species === species);
    }

    if (sex) {
      pets = pets.filter((pet) => pet.sex === sex);
    }

    if (search) {
      const q = search.toLowerCase().trim();
      pets = pets.filter((pet) => {
        const label = (pet.displayLabel || "").toLowerCase();
        const breed = (pet.breed || "").toLowerCase();
        const speciesName = (pet.species || "").toLowerCase();

        return (
          label.includes(q) ||
          breed.includes(q) ||
          speciesName.includes(q)
        );
      });
    }

    res.status(200).json({
      pets,
      total: pets.length,
    });
  } catch (error) {
    console.error("[getPublicPets]", error.message);
    res.status(500).json({
      message: "Failed to fetch public pets.",
    });
  }
};

exports.getPublicAdoptedStories = async (_req, res) => {
  try {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    const snapshot = await db.collection(ANIMAL_COL).get();
    const stories = await Promise.all(
      snapshot.docs
        .filter((document) => isAdoptedAnimal(document.data() || {}))
        .map(serializeAdoptedStory)
    );
    return res.status(200).json({ stories, total: stories.length });
  } catch (error) {
    console.error("[getPublicAdoptedStories]", error.message);
    return res.status(500).json({ message: "Failed to fetch adopted animal stories." });
  }
};

/**
 * GET /api/public/pets/:id
 * Public-facing single pet details
 */
exports.getPublicPetById = async (req, res) => {
  try {
    const { id } = req.params;
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

    const doc = await db.collection(ANIMAL_COL).doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        message: "Pet not found.",
      });
    }

    const data = doc.data();

    // Only allow public access to adoption-ready animals.
    if (!isPublicReadyAnimal(data)) {
      return res.status(404).json({
        message: "Pet not found.",
      });
    }

    const pet = await serializePublicPet(doc);

    res.status(200).json({ pet });
  } catch (error) {
    console.error("[getPublicPetById]", error.message);
    res.status(500).json({
      message: "Failed to fetch pet details.",
    });
  }
};

/**
 * GET /api/public/events
 * Public-facing list of published upcoming events
 */
exports.getPublicEvents = async (req, res) => {
  try {
    const snapshot = await db.collection(EVENT_COL).get();
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const publishedEvents = snapshot.docs
      .map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          title: data.title || data.name || "Shelter Event",
          date: serializeEventDate(data.date || data.eventDate || data.startDate || data.startsAt || data.startAt),
          time: data.time || data.eventTime || data.startTime || "",
          location: data.location || data.venue || data.address || "",
          description: data.summary || data.shortDescription || data.description || "",
          image: data.image || data.imageUrl || data.imageURL || data.photoURL || data.coverImage || "",
          url: data.url || data.href || data.link || "",
          status: data.status || data.state || data.publishStatus || "",
          published: data.published,
          isPublished: data.isPublished,
          isPublic: data.isPublic,
          archived: data.archived,
          isArchived: data.isArchived,
        };
      })
      .filter((event) => {
        const dateValue = getEventDateValue(event);
        return isPublishedEvent(event) && Boolean(dateValue);
      });

    const upcomingEvents = publishedEvents
      .filter((event) => getEventDateValue(event) >= now.getTime())
      .sort((a, b) => getEventDateValue(a) - getEventDateValue(b));

    const recentEvents = publishedEvents
      .filter((event) => getEventDateValue(event) < now.getTime())
      .sort((a, b) => getEventDateValue(b) - getEventDateValue(a));

    const events = (upcomingEvents.length ? upcomingEvents : recentEvents).slice(0, 4);

    res.status(200).json({
      events,
      total: events.length,
    });
  } catch (error) {
    console.error("[getPublicEvents]", error.message);
    res.status(500).json({
      message: "Failed to fetch public events.",
    });
  }
};

/**
 * GET /api/public/contact/messages
 * Staff/Admin contact inquiry inbox.
 */
exports.getContactMessages = async (req, res) => {
  try {
    const snapshot = await db.collection(CONTACT_COL).get();

    const messages = snapshot.docs
      .map((doc) => {
        const data = doc.data() || {};
        const messages = buildContactThread(data);

        return {
          id: doc.id,
          userId: data.userId || data.accountId || "",
          fullName: data.fullName || "",
          email: data.email || "",
          subject: data.subject || "",
          message: getLatestUserMessage(messages, data.message),
          originalMessage: data.message || "",
          messages,
          status: data.status || "New",
          source: data.source || "Contact Us Page",
          recipient: data.recipient || CONTACT_RECIPIENT,
          createdAt: serializeContactDate(data.createdAt),
          repliedAt: serializeContactDate(data.repliedAt),
          repliedBy: data.repliedBy || "",
          replyMessage: data.replyMessage || "",
        };
      })
      .sort((a, b) => {
        const dateA = Date.parse(a.createdAt) || 0;
        const dateB = Date.parse(b.createdAt) || 0;
        return dateB - dateA;
      });

    return res.status(200).json({
      messages,
      total: messages.length,
    });
  } catch (error) {
    console.error("[getContactMessages]", error.message);
    return res.status(500).json({
      message: "Failed to load contact messages.",
    });
  }
};

/**
 * GET /api/public/contact/my-messages
 * Contact message history for the current logged-in user.
 */
exports.getMyContactMessages = async (req, res) => {
  try {
    const email = normalizeContactText(req.user?.email, 160).toLowerCase();

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        message: "A valid account email is required.",
      });
    }

    const snapshot = await db
      .collection(CONTACT_COL)
      .where("email", "==", email)
      .get();

    const messages = snapshot.docs
      .map((doc) => {
        const data = doc.data() || {};
        const thread = buildContactThread(data);

        return {
          id: doc.id,
          subject: data.subject || "Contact inquiry",
          message: getLatestUserMessage(thread, data.message),
          originalMessage: data.message || "",
          status: data.status || "New",
          createdAt: serializeContactDate(data.createdAt),
          repliedAt: serializeContactDate(data.repliedAt),
          replyMessage: data.replyMessage || "",
          fullName: data.fullName || "",
          messages: thread,
        };
      })
      .sort((a, b) => {
        const dateA = Date.parse(a.createdAt) || 0;
        const dateB = Date.parse(b.createdAt) || 0;
        return dateB - dateA;
      })
      .slice(0, 5);

    return res.status(200).json({
      messages,
      total: messages.length,
    });
  } catch (error) {
    console.error("[getMyContactMessages]", error.message);
    return res.status(500).json({
      message: "Failed to load your messages.",
    });
  }
};

/**
 * POST /api/public/contact
 * Public contact form submission.
 */
exports.submitContactMessage = async (req, res) => {
  try {
    const email = normalizeContactText(
      req.user?.email || req.body.email,
      160
    ).toLowerCase();
    const fullName =
      normalizeContactText(req.user?.fullName || req.body.fullName, 120) ||
      normalizeContactText(email.split("@")[0], 120);
    const subject = normalizeContactText(req.body.subject, 160);
    const message = normalizeContactText(req.body.message, 2000);

    if (!fullName || !email || !subject || !message) {
      return res.status(400).json({
        message: "Please complete all contact form fields.",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: "Please enter a valid email address.",
      });
    }

    const contactMessage = {
      userId: req.user?.id || email,
      fullName,
      email,
      subject,
      message,
      messages: [
        {
          sender: "user",
          name: fullName,
          message,
          createdAt: new Date().toISOString(),
        },
      ],
      recipient: CONTACT_RECIPIENT,
      status: "New",
      source: "Contact Us Page",
      notificationStatus: "Pending",
      createdAt: new Date().toISOString(),
    };

    const saved = await db.collection(CONTACT_COL).add(contactMessage);
    invalidateAttentionCache();
    await createManagementNotification({
      type: "contact_message_created",
      resourceType: "contact_message",
      relatedResourceId: saved.id,
      title: "New contact inquiry received",
      message: `${fullName} sent an inquiry about ${subject}.`,
    }).catch((error) => console.warn("[submitContactMessage notification]", error.message));
    const emailConfigured = Boolean(
      process.env.EMAIL_USER && process.env.EMAIL_PASS
    );

    const receivedAt = new Date(contactMessage.createdAt).toLocaleString("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Manila",
    });

    const emailHeaderPath = path.join(__dirname, "../assets/animua-contact-email-header.png");
    const emailHtml = `
      <div style="margin:0;padding:0;background:#ffffff;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#2f2a27;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#ffffff;margin:0;padding:0;">
          <tr>
            <td align="center" style="padding:28px 14px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="760" style="width:760px;max-width:100%;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #eadccc;border-radius:10px;box-shadow:0 12px 34px rgba(68,45,30,0.10);overflow:hidden;">
                <tr>
                  <td style="padding:0;margin:0;background:#ffffff;">
                    <img src="cid:animuaContactHeader" alt="ANIMUA - Angeles City Animal Welfare Portal" width="760" style="display:block;width:100%;max-width:760px;height:auto;border:0;outline:none;text-decoration:none;">
                  </td>
                </tr>

                <tr>
                  <td style="padding:0 46px 28px;background:#ffffff;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#ffffff;margin:0;">
                      <tr>
                        <td style="padding:28px 0 16px;">
                          <h1 style="margin:0;color:#7f130f;font-size:28px;line-height:1.12;font-weight:800;">Contact Inquiry</h1>
                          <div style="width:54px;height:3px;background:#d79a25;border-radius:99px;margin:8px 0 9px;"></div>
                          <p style="margin:0;color:#2f2a27;font-size:15px;line-height:1.45;">You have received a message from the ANIMUA Contact Us form.</p>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#ffffff;table-layout:fixed;">
                      <tr>
                        <td width="170" valign="middle" style="width:170px;padding:13px 0;border-bottom:1px solid #eadcca;color:#7f130f;font-size:15px;font-weight:800;">Name:</td>
                        <td valign="middle" style="padding:13px 0;border-bottom:1px solid #eadcca;color:#2f2a27;font-size:16px;line-height:1.35;">${escapeEmailHtml(fullName)}</td>
                      </tr>
                      <tr>
                        <td width="170" valign="middle" style="width:170px;padding:13px 0;border-bottom:1px solid #eadcca;color:#7f130f;font-size:15px;font-weight:800;">Email:</td>
                        <td valign="middle" style="padding:13px 0;border-bottom:1px solid #eadcca;color:#2f2a27;font-size:16px;line-height:1.35;"><a href="mailto:${escapeEmailHtml(email)}" style="color:#0b55cc;text-decoration:underline;">${escapeEmailHtml(email)}</a></td>
                      </tr>
                      <tr>
                        <td width="170" valign="middle" style="width:170px;padding:13px 0;border-bottom:1px solid #eadcca;color:#7f130f;font-size:15px;font-weight:800;">Topic:</td>
                        <td valign="middle" style="padding:13px 0;border-bottom:1px solid #eadcca;color:#2f2a27;font-size:16px;line-height:1.35;">${escapeEmailHtml(subject)}</td>
                      </tr>
                      <tr>
                        <td width="170" valign="middle" style="width:170px;padding:13px 0;border-bottom:1px solid #eadcca;color:#7f130f;font-size:15px;font-weight:800;">Date Received:</td>
                        <td valign="middle" style="padding:13px 0;border-bottom:1px solid #eadcca;color:#2f2a27;font-size:16px;line-height:1.35;">${escapeEmailHtml(receivedAt)}</td>
                      </tr>
                    </table>

                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#ffffff;">
                      <tr>
                        <td style="padding:18px 0 10px;color:#7f130f;font-size:17px;font-weight:800;">User's Message</td>
                      </tr>
                      <tr>
                        <td style="padding:0 0 26px;">
                          <div style="background:#ffffff;border:1px solid #ead7bf;border-radius:9px;padding:20px 22px;min-height:42px;color:#2f2a27;font-size:16px;line-height:1.55;">${escapeEmailHtml(message)}</div>
                        </td>
                      </tr>
                    </table>

                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#ffffff;padding:0 0 26px;">
                      <tr>
                        <td style="padding:0 0 13px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
                            <tr>
                              <td style="border-top:1px dashed #d8c2ac;height:1px;line-height:1px;font-size:1px;">&nbsp;</td>
                              <td width="70" align="center" style="width:70px;color:#8b100d;font-size:11px;font-weight:800;letter-spacing:0.08em;line-height:1;">ANIMUA</td>
                              <td style="border-top:1px dashed #d8c2ac;height:1px;line-height:1px;font-size:1px;">&nbsp;</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="color:#2f2a27;font-size:15px;line-height:1.55;">
                          <div>Reply directly to this email to respond to the sender.</div>
                          <div>This message was sent from the ANIMUA Contact Us page.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    let notificationSent = false;
    if (emailConfigured) {
      try {
        await contactTransporter.sendMail({
          from: `"ANIMUA Contact Form" <${process.env.EMAIL_USER}>`,
          to: CONTACT_RECIPIENT,
          replyTo: email,
          subject: `[ANIMUA Contact] ${subject} inquiry from ${fullName}`,
          text: [
            `Name: ${fullName}`,
            `Email: ${email}`,
            `Topic: ${subject}`,
            `Date Received: ${receivedAt}`,
            "",
            message,
          ].join("\n"),
          html: emailHtml,
          attachments: [
            {
              filename: "animua-contact-email-header.png",
              path: emailHeaderPath,
              cid: "animuaContactHeader",
            },
          ],
        });
        notificationSent = true;
        await updateContactNotification(saved, {
          notificationStatus: "Sent",
          notifiedAt: new Date().toISOString(),
        });
      } catch (notificationError) {
        console.error("[contactNotificationEmail]", notificationError.message);
        await updateContactNotification(saved, {
          notificationStatus: "Failed",
        });
      }
    } else {
      await updateContactNotification(saved, {
        notificationStatus: "Not configured",
      });
    }

    return res.status(201).json({
      message: "Your message has been received by the ANIMUA team.",
      id: saved.id,
      notificationSent,
    });
  } catch (error) {
    console.error("[submitContactMessage]", error.message);
    return res.status(500).json({
      message: "We could not receive your message. Please try again later.",
    });
  }
};

/**
 * POST /api/public/contact/:id/follow-up
 * User follow-up reply inside an existing Contact Us conversation.
 */
exports.addContactFollowUp = async (req, res) => {
  try {
    const contactId = String(req.params.id || "").trim();
    const email = normalizeContactText(
      req.user?.email,
      160
    ).toLowerCase();
    const message = normalizeContactText(req.body.message, 2000);

    if (!contactId || !email || !message) {
      return res.status(400).json({
        message: "Conversation ID, account email, and reply message are required.",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: "A valid account email is required.",
      });
    }

    const contactRef = db.collection(CONTACT_COL).doc(contactId);
    const contactDoc = await contactRef.get();

    if (!contactDoc.exists) {
      return res.status(404).json({
        message: "Conversation not found.",
      });
    }

    const contact = contactDoc.data() || {};
    const savedEmail = normalizeContactText(contact.email, 160).toLowerCase();

    if (savedEmail !== email) {
      return res.status(403).json({
        message: "This conversation does not belong to your account.",
      });
    }

    const createdAt = new Date().toISOString();

    await contactRef.update({
      status: "New",
      message,
      updatedAt: createdAt,
      messages: admin.firestore.FieldValue.arrayUnion({
        sender: "user",
        name: contact.fullName || req.user?.fullName || "User",
        message,
        createdAt,
      }),
    });
    invalidateAttentionCache();
    await createManagementNotification({
      type: "contact_message_follow_up",
      resourceType: "contact_message",
      relatedResourceId: contactId,
      title: "Unread contact reply",
      message: `${contact.fullName || req.user?.fullName || "A public user"} replied to ${contact.subject || "a contact inquiry"}.`,
    }).catch((notificationError) => {
      console.warn("[addContactFollowUp notification]", notificationError.message);
    });

    return res.status(200).json({
      message: "Your reply has been added to the conversation.",
    });
  } catch (error) {
    console.error("[addContactFollowUp]", error.message);
    return res.status(500).json({
      message: "Failed to save your reply. Please try again later.",
    });
  }
};

/**
 * POST /api/public/contact/:id/reply
 * Staff/Admin in-app reply for a saved Contact Us inquiry.
 */
exports.replyToContactMessage = async (req, res) => {
  try {
    const contactId = String(req.params.id || "").trim();
    const replyMessage = normalizeContactText(
      req.body.replyMessage || req.body.message,
      3000
    );

    if (!contactId || !replyMessage) {
      return res.status(400).json({
        message: "Contact message ID and reply message are required.",
      });
    }

    const contactRef = db.collection(CONTACT_COL).doc(contactId);
    const contactDoc = await contactRef.get();

    if (!contactDoc.exists) {
      return res.status(404).json({
        message: "Contact message not found.",
      });
    }

    const contact = contactDoc.data() || {};
    const recipientEmail = normalizeContactText(contact.email, 160).toLowerCase();
    const inquiryTopic = normalizeContactText(contact.subject, 160) || "your inquiry";

    if (!isValidEmail(recipientEmail)) {
      return res.status(400).json({
        message: "The saved contact email is invalid.",
      });
    }

    const repliedAt = new Date().toISOString();
    const repliedBy = req.user?.email || req.user?.uid || "ANIMUA Team";

    await contactRef.update({
      status: "Replied",
      replyMessage,
      repliedAt,
      repliedBy,
      messages: admin.firestore.FieldValue.arrayUnion({
        sender: "admin",
        name: req.user?.fullName || req.user?.email || "ANIMUA Team",
        message: replyMessage,
        createdAt: repliedAt,
      }),
      deliveryChannel: "in-app",
    });
    invalidateAttentionCache();

    try {
      await createUserNotification({
        userEmail: recipientEmail,
        category: "contact",
        type: "contact_reply",
        title: "Staff replied to your message",
        message: `ANIMUA replied about ${inquiryTopic}.`,
        link: "/pages/public/contact.html",
        referenceId: contactId,
        respectSettings: false,
      });
    } catch (notificationError) {
      console.error("[replyToContactMessage notification]", notificationError.message);
    }

    return res.status(200).json({
      message: "Reply saved to the user's ANIMUA account.",
      deliveryChannel: "in-app",
    });
  } catch (error) {
    console.error("[replyToContactMessage]", error.message);
    return res.status(500).json({
      message: "Failed to save reply. Please try again later.",
    });
  }
};
