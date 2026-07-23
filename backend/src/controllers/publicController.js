const { db } = require("../config/firebase");
const {
  buildShelterLabel,
} = require("../utils/animalIdentity");

const ANIMAL_COL = "animals";
const EVENT_COL = "events";

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

    // Current system flow:
    // Only animals already marked "Ready" are shown publicly.
    let query = db.collection(ANIMAL_COL).where("status", "==", "Ready");

    const snapshot = await query.get();

    let pets = snapshot.docs.map((doc) => {
      const data = doc.data();
      const displayLabel = buildShelterLabel(data, doc.id);

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
        photoURL: data.photoURL || "",
        source: data.source || "",
        intakeDate: data.intakeDate || "",
        intakeLocation: data.intakeLocation || "",
        initialCondition: data.initialCondition || "",
        conditionNotes: data.conditionNotes || "",
        vaccinated: data.vaccinated || "Unknown",
        alteredStatus: data.alteredStatus || "Unknown",
        visibleDefects: data.visibleDefects || "",
        behavioralAssessment: data.behavioralAssessment || null,
        status: data.status || "Ready",
      };
    });

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

/**
 * GET /api/public/pets/:id
 * Public-facing single pet details
 */
exports.getPublicPetById = async (req, res) => {
  try {
    const { id } = req.params;

    const doc = await db.collection(ANIMAL_COL).doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({
        message: "Pet not found.",
      });
    }

    const data = doc.data();
    const displayLabel = buildShelterLabel(data, doc.id);

    // Only allow public access to Ready animals
    if (data.status !== "Ready") {
      return res.status(404).json({
        message: "Pet not found.",
      });
    }

    const pet = {
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
      photoURL: data.photoURL || "",
      source: data.source || "",
      intakeDate: data.intakeDate || "",
      intakeLocation: data.intakeLocation || "",
      initialCondition: data.initialCondition || "",
      conditionNotes: data.conditionNotes || "",
      vaccinated: data.vaccinated || "Unknown",
      alteredStatus: data.alteredStatus || "Unknown",
      visibleDefects: data.visibleDefects || "",
      behavioralAssessment: data.behavioralAssessment || null,
      status: data.status || "Ready",
    };

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
