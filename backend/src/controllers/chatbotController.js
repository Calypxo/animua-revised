
const { db } = require("../config/firebase");
const {
  buildShelterLabel,
} = require("../utils/animalIdentity");

const CHATBOT_PROVIDER = (process.env.CHATBOT_PROVIDER || "gemini").toLowerCase();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || process.env.CHATBOT_MODEL || "gpt-5.6-luna";
const OPENAI_API_URL = process.env.OPENAI_API_URL || "https://api.openai.com/v1/responses";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const GEMINI_API_URL =
  process.env.GEMINI_API_URL ||
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_MESSAGE_LENGTH = 700;
const MAX_HISTORY_ITEMS = 8;
const PUBLIC_CONTEXT_TIMEOUT_MS = 3500;
const PUBLIC_PET_FETCH_LIMIT = 50;
const PUBLIC_EVENT_FETCH_LIMIT = 4;
const rateLimitStore = new Map();
let publicContextCache = {
  expiresAt: 0,
  data: null
};

const OFFICE_INFO = {
  name: "Angeles City Veterinary Office",
  address: "City Hall Building, Pulung Maragul, Angeles City, Pampanga 2009",
  phone: "(045) 322-0485",
  hours: "Monday to Friday, 8:00 AM to 5:00 PM"
};

const ANGELES_BARANGAY_EVENT_NAMES = [
  "Agapito del Rosario", "Amsic", "Anunas", "Balibago", "Capaya", "Claro M. Recto",
  "Cuayan", "Cutcut", "Cutud", "Lourdes Norte", "Lourdes Sur", "Lourdes Sur Este",
  "Malabanias", "Margot", "Mining", "Ninoy Aquino", "Pampang", "Pandan", "Plaridel",
  "Pulung Cacutud", "Pulung Maragul", "Pulungbulu", "Salapungan", "San Jose",
  "San Nicolas", "Santa Teresita", "Santa Trinidad", "Santo Cristo", "Santo Domingo",
  "Santo Rosario", "Sapalibutad", "Sapangbato", "Sergio Bernal", "Silangan",
  "Tabun", "Virgen Delos Remedios"
];

const BARANGAY_EVENT_ALIASES = ANGELES_BARANGAY_EVENT_NAMES.map((name) => ({
  name,
  terms: name === "Lourdes Sur Este"
    ? ["lourdes sur este", "lourdes sur east"]
    : [name.toLowerCase()]
}));

const ANIMAL_COLOR_KEYWORDS = [
  { id: "black", english: "black", tagalog: "black/itim", terms: ["black", "itim", "maitim"] },
  { id: "white", english: "white", tagalog: "white/puti", terms: ["white", "puti", "maputi"] },
  { id: "brown", english: "brown", tagalog: "brown/kayumanggi", terms: ["brown", "kayumanggi", "tsokolate", "chocolate"] },
  { id: "gray", english: "gray", tagalog: "gray/abo", terms: ["gray", "grey", "abo", "kulay abo"] },
  { id: "orange", english: "orange", tagalog: "orange", terms: ["orange", "ginger"] },
  { id: "cream", english: "cream", tagalog: "cream", terms: ["cream", "beige"] },
  { id: "tan", english: "tan", tagalog: "tan", terms: ["tan"] },
  { id: "gold", english: "gold", tagalog: "gold/golden", terms: ["gold", "golden"] },
  { id: "tabby", english: "tabby", tagalog: "tabby", terms: ["tabby"] },
  { id: "calico", english: "calico", tagalog: "calico", terms: ["calico"] }
];

function getClientKey(req) {
  return req?.ip || req?.headers?.["x-forwarded-for"] || "unknown";
}

function isRateLimited(req) {
  const key = getClientKey(req);
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 18;
  const record = rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };

  if (record.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  record.count += 1;
  rateLimitStore.set(key, record);
  return record.count > maxRequests;
}

function cleanMessage(value = "") {
  return String(value).replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE_LENGTH);
}

function normalizeIntentText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(adapt|adpt|adpat|adpot|adobt|adop)\b/g, "adopt")
    .replace(/\b(adapts|adpots)\b/g, "adopts")
    .replace(/\b(adapted|adpotted)\b/g, "adopted")
    .replace(/\b(adapting|adpoting)\b/g, "adopting")
    .replace(/\b(adaption|adaptation|adoptation|adapation)\b/g, "adoption")
    .replace(/\b(aadapt|aadapt)\b/g, "aadopt")
    .replace(/\b(iadapt|iadapt)\b/g, "iadopt")
    .replace(/\b(inadapt|inadopt)\b/g, "inadopt")
    .replace(/\b(aapprove|maapprove|ma-aapprove)\b/g, "approve");
}

function cleanHistory(history = []) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-MAX_HISTORY_ITEMS)
    .map((item) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: cleanMessage(item?.content || "")
    }))
    .filter((item) => item.content);
}

function normalizeLanguage(value = "") {
  return String(value).toLowerCase() === "tagalog" ? "tagalog" : "english";
}

function hasTaglishSignal(text = "") {
  const lower = normalizeIntentText(text);

  return includesAnyWord(lower, [
    "magkano",
    "bayad",
    "gastos",
    "presyo",
    "singil",
    "libre",
    "paano",
    "ano",
    "anong",
    "nangyari",
    "kailan",
    "susunod",
    "sino",
    "pwede",
    "pwedeng",
    "puwede",
    "puwedeng",
    "kailangan",
    "aso",
    "pusa",
    "alaga",
    "ampon",
    "umampon",
    "saan",
    "oras",
    "tawag",
    "salamat",
    "kumusta",
    "kamusta",
    "po",
    "opo",
    "hindi",
    "wala",
    "gusto",
    "hanap",
    "itim",
    "puti"
  ]) || includesAnyPhrase(lower, [
    "pag adopt",
    "mag adopt",
    "pa adopt",
    "pag ampon",
    "may bayad",
    "walang bayad"
  ]);
}

function resolveReplyLanguage(value = "", message = "") {
  const rawValue = String(value || "").trim().toLowerCase();
  if (rawValue === "english" || rawValue === "tagalog") {
    return rawValue;
  }

  return hasTaglishSignal(message) ? "tagalog" : "english";
}

function localizedReply(language, english, tagalog) {
  return language === "tagalog" ? tagalog : english;
}

function getVerifiedFallback(language = "english") {
  return localizedReply(
    language,
    "I get you, but I am mainly here for ANIMUA and Angeles City Veterinary Office services. I can help with adoption, Find Furbabies, the Match Quiz, surrender requests, events, account help, donations, stray concerns, and contact details.",
    "Gets ko, pero pang-ANIMUA at Angeles City Veterinary Office services talaga ako. Matutulungan kita sa adoption, Find Furbabies, Match Quiz, surrender requests, events, account help, donations, stray concerns, at contact details."
  );
}

async function getPublicContext() {
  const now = Date.now();
  if (publicContextCache.data && publicContextCache.expiresAt > now) {
    return publicContextCache.data;
  }

  const [petsSnapshot, eventsSnapshot, announcementsSnapshot] = await Promise.all([
    db.collection("animals").where("status", "==", "Ready").limit(PUBLIC_PET_FETCH_LIMIT).get(),
    db.collection("events").get(),
    db.collection("announcements").get()
  ]);

  const pets = petsSnapshot.docs.map((doc) => normalizePet(doc.id, doc.data()));
  const eventCandidates = [
    ...eventsSnapshot.docs.map((doc) => normalizeEvent(doc.id, doc.data())),
    ...announcementsSnapshot.docs
      .map((doc) => normalizeAnnouncementEvent(doc.id, doc.data()))
      .filter(Boolean)
  ];
  const publishedEvents = deduplicatePublicEvents(eventCandidates.filter(isPublishedPublicEvent));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const hasUpcomingEvent = publishedEvents.some(
    (event) => getEventDateValue(event) >= today.getTime()
  );
  const events = selectPublicEvents(
    hasUpcomingEvent
      ? publishedEvents
      : [...publishedEvents, getHomeFallbackUpcomingEvent()]
  );

  publicContextCache = {
    expiresAt: now + 2 * 60 * 1000,
    data: {
      pets,
      events
    }
  };

  return publicContextCache.data;
}

async function getPublicContextForAi() {
  const context = await getPublicContext();

  return {
    pets: context.pets.slice(0, 4).map((pet) => ({
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      sex: pet.sex,
      age: pet.age,
      color: pet.color || pet.colorMarkings || ""
    })),
    events: context.events.slice(0, 2).map((event) => ({
      title: event.title,
      date: event.date,
      time: event.time,
      location: event.location
    }))
  };
}

function getEmptyPublicContext() {
  return {
    pets: [],
    events: [getHomeFallbackUpcomingEvent()]
  };
}

function getEmptyQuizContext() {
  return {
    loaded: false,
    authenticated: false,
    quizEnabled: true,
    retakeCooldownDays: 30,
    hasPreviousResult: false,
    canTakeQuiz: true,
    reason: "FIRST_ATTEMPT",
    lastCompletedAt: null,
    nextRetakeAt: null,
    remainingDays: 0
  };
}

async function getQuizContext(req = {}) {
  const settingsSnapshot = await db.collection("quizSettings").doc("compatibilityQuiz").get();
  const settingsData = settingsSnapshot.exists ? settingsSnapshot.data() || {} : {};
  const quizEnabled = typeof settingsData.quizEnabled === "boolean" ? settingsData.quizEnabled : true;
  const retakeCooldownDays = Number.isInteger(settingsData.retakeCooldownDays)
    ? settingsData.retakeCooldownDays
    : 30;
  const userId = String(req.user?.id || req.user?.email || "").trim();

  if (!userId) {
    return {
      ...getEmptyQuizContext(),
      loaded: true,
      quizEnabled,
      retakeCooldownDays,
      canTakeQuiz: quizEnabled,
      reason: quizEnabled ? "SIGN_IN_REQUIRED" : "QUIZ_DISABLED"
    };
  }

  const [userSnapshot, resultsSnapshot] = await Promise.all([
    db.collection("users").doc(userId).get(),
    db.collection("compatibilityResults").where("userId", "==", userId).get()
  ]);
  const user = userSnapshot.exists ? userSnapshot.data() || {} : {};
  const results = resultsSnapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .sort((a, b) => (parseAnyDate(b.completedAt)?.getTime() || 0) - (parseAnyDate(a.completedAt)?.getTime() || 0));
  const latest = results.find((item) => item.isLatest) || results[0] || null;
  const completedAt = parseAnyDate(latest?.completedAt);
  const fallbackRetakeAt = completedAt
    ? new Date(completedAt.getTime() + retakeCooldownDays * 86400000)
    : null;
  const nextRetakeAt = parseAnyDate(user.quizRetakeOverrideAt) ||
    parseAnyDate(latest?.nextRetakeAt) ||
    fallbackRetakeAt;
  const now = new Date();
  const hasPreviousResult = Boolean(latest);
  const cooldownActive = hasPreviousResult && nextRetakeAt && now < nextRetakeAt;
  const canTakeQuiz = quizEnabled && !cooldownActive;

  return {
    loaded: true,
    authenticated: true,
    quizEnabled,
    retakeCooldownDays,
    hasPreviousResult,
    canTakeQuiz,
    reason: !quizEnabled
      ? "QUIZ_DISABLED"
      : cooldownActive
        ? "RETAKE_COOLDOWN"
        : hasPreviousResult
          ? "RETAKE_AVAILABLE"
          : "FIRST_ATTEMPT",
    lastCompletedAt: completedAt?.toISOString() || null,
    nextRetakeAt: nextRetakeAt?.toISOString() || null,
    remainingDays: canTakeQuiz || !nextRetakeAt
      ? 0
      : Math.max(1, Math.ceil((nextRetakeAt.getTime() - now.getTime()) / 86400000))
  };
}

async function getQuizContextSafely(req = {}) {
  const fallback = getEmptyQuizContext();
  const guardedContext = getQuizContext(req).catch((error) => {
    console.warn("[Chatbot Quiz Context Warning]", error.message);
    return fallback;
  });

  return withTimeout(
    guardedContext,
    PUBLIC_CONTEXT_TIMEOUT_MS,
    fallback,
    () => console.warn(`[Chatbot Quiz Context Warning] timed out after ${PUBLIC_CONTEXT_TIMEOUT_MS}ms.`)
  );
}

function withTimeout(promise, timeoutMs, fallbackValue, onTimeout) {
  let timeoutId;

  return Promise.race([
    promise.finally(() => clearTimeout(timeoutId)),
    new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        if (typeof onTimeout === "function") onTimeout();
        resolve(fallbackValue);
      }, timeoutMs);
    })
  ]);
}

async function getPublicContextSafely(label = "Context") {
  const fallback = getEmptyPublicContext();
  const guardedContext = getPublicContext().catch((error) => {
    console.warn(`[Chatbot ${label} Warning]`, error.message);
    return fallback;
  });

  return withTimeout(
    guardedContext,
    PUBLIC_CONTEXT_TIMEOUT_MS,
    fallback,
    () => console.warn(`[Chatbot ${label} Warning] timed out after ${PUBLIC_CONTEXT_TIMEOUT_MS}ms.`)
  );
}

async function getPublicContextForAiSafely() {
  const fallback = getEmptyPublicContext();
  const guardedContext = getPublicContextForAi().catch((error) => {
    console.warn("[Chatbot AI Context Warning]", error.message);
    return fallback;
  });

  return withTimeout(
    guardedContext,
    PUBLIC_CONTEXT_TIMEOUT_MS,
    fallback,
    () => console.warn(`[Chatbot AI Context Warning] timed out after ${PUBLIC_CONTEXT_TIMEOUT_MS}ms.`)
  );
}

function normalizePet(id, pet = {}) {
  return {
    id,
    name: buildShelterLabel(pet, id),
    species: pet.species || pet.type || "",
    breed: pet.breed || "",
    sex: pet.sex || "Unknown",
    age: pet.ageEstimate || pet.age || "",
    color: pet.color || "",
    colorMarkings: pet.colorMarkings || pet.markings || pet.color || "",
    description: pet.description || pet.notes || "",
    source: pet.source || "",
    condition: pet.initialCondition || pet.conditionNotes || "",
    status: pet.status || "Ready"
  };
}

function normalizeEvent(id, event = {}) {
  const status = String(event.status || event.state || event.publishStatus || "").toLowerCase();

  return {
    id,
    type: event.type || event.category || "",
    title: event.title || event.name || "Shelter event",
    date: serializeDate(event.date || event.eventDate || event.startDate || event.startsAt || event.startAt),
    time: event.time || event.eventTime || event.startTime || "",
    location: event.location || event.venue || event.address || "",
    description: event.summary || event.shortDescription || event.description || event.caption || event.body || event.content || "",
    status: event.status || event.state || event.publishStatus || "",
    published: event.published,
    isPublished: event.isPublished,
    isPublic: event.isPublic === false || event.visibleToPublic === false
      ? false
      : event.isPublic === true || event.visibleToPublic === true
        ? true
        : undefined,
    isArchived: event.archived === true || event.isArchived === true || status.includes("archive"),
    isDraft:
      event.published === false ||
      event.isPublished === false ||
      event.isPublic === false ||
      event.visibleToPublic === false ||
      status.includes("draft") ||
      status.includes("unpublish") ||
      status.includes("private")
  };
}

function normalizeAnnouncementEvent(id, announcement = {}) {
  const type = String(announcement.type || announcement.category || "").toLowerCase();
  if (!type.includes("event")) return null;

  return normalizeEvent(id, announcement);
}

function getEventDateValue(event = {}) {
  const value = event.date || event.eventDate || event.startDate || event.startsAt || event.startAt || "";
  if (value?.toDate) return value.toDate().getTime();
  if (value?._seconds) return value._seconds * 1000;
  if (value?.seconds) return value.seconds * 1000;
  if (typeof value === "number") return value;

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isPublishedPublicEvent(event = {}) {
  const status = String(event.status || event.state || event.publishStatus || "").toLowerCase();
  const archived = event.isArchived === true || event.archived === true || status.includes("archive");
  const unpublished =
    event.isDraft === true ||
    event.published === false ||
    event.isPublished === false ||
    event.isPublic === false ||
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

  return published && !unpublished && !archived && Boolean(getEventDateValue(event));
}

function deduplicatePublicEvents(events = []) {
  const seen = new Set();

  return events.filter((event) => {
    const key = [
      String(event.title || "").trim().toLowerCase(),
      getEventDateValue(event),
      String(event.location || "").trim().toLowerCase()
    ].join("|");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getHomeFallbackUpcomingEvent() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  date.setHours(9, 0, 0, 0);

  return {
    id: "demo-upcoming-event",
    title: "Veterinary Services Brought Closer to Angelenos",
    date: date.toISOString(),
    time: "9:00 AM - 3:00 PM",
    location: "Savannah Phase 1, Savannah Phase 2, and Green Plain Phase 3",
    description: "The City of Angeles, through the City Veterinary Office, continues its free anti-rabies vaccination program to protect pets and help prevent the spread of rabies in local communities.",
    status: "Upcoming",
    isPublic: true,
    isDemo: true
  };
}

function selectPublicEvents(events = []) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const upcomingEvents = events
    .filter((event) => getEventDateValue(event) >= now.getTime())
    .sort((a, b) => getEventDateValue(a) - getEventDateValue(b));
  const recentEvents = events
    .filter((event) => getEventDateValue(event) < now.getTime())
    .sort((a, b) => getEventDateValue(b) - getEventDateValue(a));

  return (upcomingEvents.length ? upcomingEvents : recentEvents).slice(0, PUBLIC_EVENT_FETCH_LIMIT);
}

function serializeDate(value) {
  if (!value) return "";
  if (value?.toDate) return value.toDate().toISOString();
  if (value?._seconds) return new Date(value._seconds * 1000).toISOString();
  if (value?.seconds) return new Date(value.seconds * 1000).toISOString();
  return String(value);
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function formatTime(value = "") {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return String(value || "").trim();

  const hour = Number(match[1]);
  if (Number.isNaN(hour)) return String(value || "").trim();

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${match[2]} ${suffix}`;
}

function formatPet(pet = {}) {
  const color = pet.colorMarkings || pet.color || "";
  const details = [
    pet.species,
    pet.breed,
    pet.sex,
    pet.age,
    color
  ].filter(Boolean);

  return `${pet.name}${details.length ? ` (${details.join(", ")})` : ""}`;
}

function getRequestedAnimalSpecies(text = "") {
  if (includesAnyWord(text, ["dog", "dogs", "aso"])) return "dog";
  if (includesAnyWord(text, ["cat", "cats", "pusa"])) return "cat";
  return "";
}

function getRequestedAnimalColor(text = "") {
  return ANIMAL_COLOR_KEYWORDS.find((color) => includesAnyPhrase(text, color.terms)) || null;
}

function hasAnimalAttributeSearchIntent(text = "") {
  return hasAnimalMentionIntent(text) && Boolean(getRequestedAnimalColor(text));
}

function getPetColorText(pet = "") {
  return [pet.color, pet.colorMarkings, pet.description, pet.breed].filter(Boolean).join(" ");
}

function petMatchesAnimalSearch(pet = {}, filters = {}) {
  const speciesMatch = !filters.species ||
    String(pet.species || "").toLowerCase().includes(filters.species);

  if (!speciesMatch) return false;
  if (!filters.color) return true;

  const colorText = normalizeIntentText(getPetColorText(pet));
  return filters.color.terms.some((term) => includesAnyPhrase(colorText, [term]));
}

function filterPetsForMessage(pets = [], text = "") {
  const filters = {
    species: getRequestedAnimalSpecies(text),
    color: getRequestedAnimalColor(text)
  };

  return {
    filters,
    pets: pets.filter((pet) => petMatchesAnimalSearch(pet, filters))
  };
}

function describeAnimalSearch(filters = {}, language = "english") {
  const species = filters.species
    ? language === "tagalog"
      ? filters.species === "dog" ? "aso" : "pusa"
      : filters.species
    : language === "tagalog"
      ? "animal"
      : "animal";
  const color = filters.color ? filters.color[language] : "";

  return [color, species].filter(Boolean).join(" ");
}

function formatEvent(event = {}) {
  const details = [
    formatDate(event.date),
    event.time,
    event.location
  ].filter(Boolean);

  return `${event.title}${details.length ? ` - ${details.join(", ")}` : ""}`;
}

function getEventSearchText(event = {}) {
  return normalizeIntentText([
    event.title,
    event.name,
    event.description,
    event.summary,
    event.shortDescription,
    event.location,
    event.venue
  ].filter(Boolean).join(" "));
}

function eventMatchesVaccination(event = {}) {
  const text = getEventSearchText(event);
  return text.includes("vaccin") ||
    includesAnyWord(text, ["vaccine", "bakuna", "rabies"]) ||
    includesAnyPhrase(text, ["anti rabies", "anti-rabies"]);
}

function eventMentionsFreeService(event = {}) {
  const text = getEventSearchText(event);
  return includesAnyWord(text, ["free", "libre"]) ||
    includesAnyPhrase(text, ["walang bayad", "no fee"]);
}

function asksFreeService(text = "") {
  return includesAnyWord(text, ["free", "libre"]) ||
    includesAnyPhrase(text, ["walang bayad", "no fee"]);
}

function getMatchingVaccinationEvents(events = [], text = "") {
  const vaccinationEvents = events.filter(eventMatchesVaccination);

  if (!asksFreeService(text)) return vaccinationEvents;

  const freeVaccinationEvents = vaccinationEvents.filter(eventMentionsFreeService);
  return freeVaccinationEvents.length ? freeVaccinationEvents : vaccinationEvents;
}

function includesAny(text, words = []) {
  return words.some((word) => text.includes(word));
}

function getMessageTokens(text = "") {
  return text.toLowerCase().match(/[a-z0-9]+/g) || [];
}

function includesAnyWord(text, words = []) {
  const tokens = getMessageTokens(text);
  return words.some((word) => tokens.includes(word));
}

function includesAnyPhrase(text, phrases = []) {
  const normalized = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  return phrases.some((phrase) => normalized.includes(` ${phrase.toLowerCase()} `));
}

function getMentionedBarangay(text = "") {
  const normalized = ` ${String(text).toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;

  return BARANGAY_EVENT_ALIASES
    .slice()
    .sort((a, b) => b.name.length - a.name.length)
    .find((barangay) => barangay.terms.some((term) => normalized.includes(` ${term} `))) || null;
}

function eventMatchesBarangay(event = {}, barangay = null) {
  if (!barangay) return false;
  const eventText = ` ${getEventSearchText(event).replace(/[^a-z0-9]+/g, " ")} `;
  return barangay.terms.some((term) => eventText.includes(` ${term} `));
}

function hasBarangayEventIntent(text = "") {
  if (!getMentionedBarangay(text)) return false;

  return includesAnyWord(text, [
    "when", "kailan", "next", "upcoming", "event", "events", "schedule",
    "date", "time", "announcement", "announcements"
  ]) || includesAnyPhrase(text, [
    "when will", "when is", "how about", "what about", "may event", "may announcement"
  ]);
}

function hasApplicationIntent(text = "") {
  return includesAnyWord(text, ["application", "applications", "apply", "applied", "submit", "submitted", "submitting"]);
}

function hasMultipleIntent(text = "") {
  return includesAnyWord(text, ["two", "2", "three", "3", "multiple", "many", "another", "several", "dalawa", "dalawang", "tatlo", "tatlong", "marami", "ibang"]) ||
    includesAnyPhrase(text, ["more than one"]);
}

function hasGreetingIntent(text = "") {
  return includesAnyWord(text, ["hi", "hello", "hey", "kumusta", "kamusta"]) ||
    includesAnyPhrase(text, ["good morning", "good afternoon", "good evening", "magandang araw"]);
}

function hasThanksIntent(text = "") {
  return includesAnyWord(text, ["thanks", "thank", "salamat"]) ||
    includesAnyPhrase(text, ["thank you"]);
}

function hasGoodbyeIntent(text = "") {
  return includesAnyWord(text, ["bye", "goodbye", "paalam"]) ||
    includesAnyPhrase(text, ["see you"]);
}

function hasAssistantHelpIntent(text = "") {
  const tokens = getMessageTokens(text);

  if (includesAnyPhrase(text, ["who are you", "what can you do", "ano ka"])) return true;
  if (includesAnyWord(text, ["assistant"])) return true;

  return includesAnyWord(text, ["help", "assist", "tulong"]) &&
    tokens.length <= 3;
}

function hasStatusIntent(text = "") {
  return includesAnyWord(text, ["status", "check", "track", "view", "update", "updates", "pending", "approved", "rejected"]);
}

function hasApplicationStatusIntent(text = "") {
  if (!hasApplicationIntent(text)) return false;

  return hasStatusIntent(text) ||
    (
      includesAnyWord(text, ["happen", "happened", "happening", "news", "progress", "nangyari", "kamusta"]) &&
      includesAnyWord(text, ["my", "mine", "ko", "aking"])
    ) ||
    includesAnyPhrase(text, [
      "what happen to my application",
      "what happened to my application",
      "what is happening with my application",
      "what s happening with my application",
      "what about my application",
      "where is my application",
      "any news on my application",
      "how is my application",
      "ano na ang application ko",
      "ano nangyari sa application ko",
      "anong nangyari sa application ko"
    ]);
}

function hasStatusExplanationIntent(text = "") {
  return includesAnyWord(text, ["status", "pending", "approved", "rejected", "cancelled", "canceled", "completed"]) ||
    includesAnyPhrase(text, ["under review", "what does pending", "what does approved", "what does rejected"]);
}

function hasRequirementIntent(text = "") {
  return includesAnyWord(text, [
    "requirement",
    "requirements",
    "required",
    "qualify",
    "eligible",
    "eligibility",
    "kailangan",
    "requirements"
  ]);
}

function hasFeeIntent(text = "") {
  return includesAnyWord(text, ["fee", "fees", "cost", "price", "amount", "payment", "pay", "paid", "charge", "charges", "bayad", "gastos", "presyo", "singil", "magkano"]) ||
    includesAnyPhrase(text, ["how much", "do i need to pay", "need to pay", "may bayad", "walang bayad"]) ||
    ((text.includes("adopt") || text.includes("adoption")) && includesAnyWord(text, ["free", "libre"]));
}

function hasAdoptionMentionIntent(text = "") {
  return text.includes("adopt") ||
    includesAnyWord(text, ["adoption", "adopter", "iadopt", "iadapt", "aadopt", "aadapt", "inadopt", "inadapt", "ampon", "umampon"]) ||
    includesAnyPhrase(text, [
      "pag adopt",
      "pag adapt",
      "mag adopt",
      "mag adapt",
      "mag aadopt",
      "mag aadapt",
      "mag aadop",
      "pa adopt",
      "pa adapt",
      "pag ampon"
    ]);
}

function hasAdoptionFeeIntent(text = "") {
  return hasFeeIntent(text) && (hasAdoptionMentionIntent(text) || hasAnimalMentionIntent(text));
}

function hasAdoptionMotivationIntent(text = "") {
  if (!hasAdoptionMentionIntent(text)) return false;
  if (hasApplicationIntent(text)) return false;

  return includesAnyWord(text, [
    "why",
    "bakit",
    "reason",
    "reasons",
    "benefit",
    "benefits",
    "advantage",
    "advantages",
    "should"
  ]) ||
    includesAnyPhrase(text, [
      "why adopt",
      "why should i adopt",
      "why do i adopt",
      "bakit ako mag adopt",
      "bakit ako mag aadopt",
      "bakit kailangan mag adopt",
      "bakit maganda mag adopt"
    ]);
}

function hasDonationIntent(text = "") {
  return includesAnyWord(text, [
    "donate",
    "donation",
    "donations",
    "magdonate",
    "mag-donate",
    "donating",
    "gcash",
    "bank",
    "card",
    "money",
    "donasyon"
  ]) || includesAnyPhrase(text, [
    "mag donate",
    "mag-donate",
    "send money",
    "online payment",
    "in kind",
    "in-kind",
    "do you accept food",
    "donate food",
    "donate dog food",
    "donate cat food",
    "dog and cat food",
    "cat and dog food",
    "donate medicine",
    "donate supplies",
    "donate blankets",
    "donate towels",
    "donate cages"
  ]);
}

function hasGeneralAnimuaIntent(text = "") {
  return includesAnyWord(text, ["pwa"]) ||
    includesAnyPhrase(text, ["what is animua", "what animua means", "what does animua mean", "meaning of animua", "animua meaning", "ano ang animua", "ibig sabihin ng animua", "ano ibig sabihin ng animua", "ano meaning ng animua", "who manages animua", "who manages it", "main services", "public user features", "progressive web", "progressive web application", "mobile access", "desktop access", "how to use animua"]);
}

function hasAnimalMentionIntent(text = "") {
  return includesAnyWord(text, [
    "aso",
    "pusa",
    "alaga",
    "dog",
    "dogs",
    "cat",
    "cats",
    "pet",
    "pets",
    "animal",
    "animals",
    "furbaby",
    "furbabies"
  ]);
}

function hasAnimalListIntent(text = "") {
  return hasAnimalMentionIntent(text) || includesAnyPhrase(text, ["find furbabies"]);
}

function hasAnimalAvailabilityIntent(text = "") {
  if (hasPersonalPetVaccinationRequestIntent(text)) return false;
  if (hasAnimalAttributeSearchIntent(text)) return true;

  const mentionsAnimal = hasAnimalMentionIntent(text) || includesAnyPhrase(text, ["find furbabies"]);
  const asksWhoCanBeAdopted =
    hasAdoptionMentionIntent(text) &&
    (
      includesAnyWord(text, ["who", "which", "sino", "alin"]) ||
      includesAnyPhrase(text, [
        "sino ang mga",
        "sino pwede",
        "sino pwedeng",
        "sino puwede",
        "sino puwedeng",
        "pwede iadopt",
        "pwedeng iadopt",
        "puwede iadopt",
        "puwedeng iadopt",
        "can be adopted"
      ])
    );

  if (asksWhoCanBeAdopted) return true;
  if (!mentionsAnimal) return false;

  const tokens = getMessageTokens(text);
  const asksAvailability =
    includesAnyWord(text, ["available", "adoptable", "ready", "browse", "find", "show", "list", "view", "see", "want", "looking", "gusto", "hanap", "meron", "pwede", "pwedeng", "puwede", "puwedeng"]) ||
    includesAnyPhrase(text, [
      "find furbabies",
      "ready for adoption",
      "for adoption",
      "looking for",
      "may aso",
      "may mga aso",
      "may pusa",
      "may mga pusa",
      "may pet",
      "may pets",
      "may animal",
      "may animals",
      "may furbaby",
      "may furbabies",
      "meron aso",
      "merong aso",
      "meron pusa",
      "merong pusa",
      "available pa",
      "pwede iadopt",
      "pwedeng iadopt",
      "puwede iadopt",
      "puwedeng iadopt"
    ]);
  const shortAnimalOnly = tokens.length <= 3 && mentionsAnimal;

  return asksAvailability || shortAnimalOnly;
}

function hasAccountIntent(text = "") {
  return includesAnyWord(text, [
    "login",
    "register",
    "account",
    "otp",
    "code",
    "verify",
    "password",
    "captcha"
  ]) || includesAnyPhrase(text, ["log in", "sign in", "create account", "forgot password", "reset password", "email already registered", "email verification", "email otp"]);
}

function hasAccountTroubleIntent(text = "") {
  return (
    hasAccountIntent(text) &&
    includesAnyWord(text, ["forgot", "reset", "expired", "resend", "received", "receive", "incorrect", "wrong", "already", "registered", "suspended", "delete", "deletion", "change", "update"])
  ) || includesAnyPhrase(text, [
    "cannot log in",
    "can't log in",
    "cant log in",
    "did not receive",
    "not received",
    "otp expired",
    "wrong password",
    "incorrect credentials",
    "change email",
    "change password",
    "update profile",
    "email already registered"
  ]);
}

function hasEventIntent(text = "") {
  return includesAnyWord(text, ["event", "events", "schedule", "activity", "activities"]) ||
    includesAnyPhrase(text, ["vaccination drive", "vaccination event", "upcoming vaccination", "adoption campaign", "community veterinary"]) ||
    hasVaccinationScheduleIntent(text) ||
    hasBarangayEventIntent(text);
}

function hasNextEventIntent(text = "") {
  return hasEventIntent(text) && (
    includesAnyWord(text, ["next", "susunod"]) ||
    includesAnyPhrase(text, ["next event", "susunod na event"])
  );
}

function hasVaccinationIntent(text = "") {
  return text.includes("vaccine") ||
    text.includes("vaccin") ||
    text.includes("bakuna") ||
    includesAnyWord(text, ["bakuna", "rabies"]) ||
    includesAnyPhrase(text, ["na vaccine", "na-vaccine", "may bakuna"]);
}

function hasPersonalPetVaccinationRequestIntent(text = "") {
  if (!hasAnimalMentionIntent(text) || !hasVaccinationIntent(text)) return false;

  return includesAnyPhrase(text, [
    "i want to vaccine my",
    "i want to vaccinate my",
    "want to vaccine my",
    "want to vaccinate my",
    "get my dog vaccinated",
    "get my cat vaccinated",
    "get my pet vaccinated",
    "vaccinate my dog",
    "vaccinate my cat",
    "vaccinate my pet",
    "vaccine my dog",
    "vaccine my cat",
    "vaccine my pet",
    "can you vaccinate my",
    "can the vet vaccinate my",
    "pabakunahan ang aso ko",
    "pabakunahan ang pusa ko",
    "pabakunahan ang pet ko",
    "magpabakuna ng aso",
    "magpabakuna ng pusa",
    "magpabakuna ng pet"
  ]);
}

function hasVaccinationScheduleIntent(text = "") {
  const mentionsVaccination = hasVaccinationIntent(text);
  if (!mentionsVaccination) return false;

  return includesAnyWord(text, ["when", "kailan", "schedule", "event", "drive", "happen", "date", "time", "where", "saan", "oras"]) ||
    includesAnyPhrase(text, [
      "when will",
      "when is",
      "when are",
      "vaccine happen",
      "vaccination happen",
      "vaccination schedule",
      "vaccine schedule",
      "vaccination drive",
      "vaccine drive",
      "upcoming vaccination",
      "free vaccine",
      "free vaccination",
      "libreng bakuna",
      "kailan ang bakuna",
      "kailan may bakuna",
      "saan ang bakuna",
      "saan may bakuna"
    ]);
}

function hasCheckupRequestIntent(text = "") {
  const mentionsAnimalOrVet =
    hasAnimalMentionIntent(text) ||
    includesAnyWord(text, ["vet", "veterinarian", "clinic"]) ||
    includesAnyPhrase(text, ["veterinary office", "city vet", "cityvet"]);
  const asksCheckup =
    includesAnyWord(text, ["checkup", "pacheck", "pacheckup", "consult", "consultation"]) ||
    includesAnyPhrase(text, [
      "check up",
      "pa check",
      "pa check up",
      "pacheck up",
      "medical check",
      "medical check up",
      "health check",
      "health check up",
      "vet check",
      "vet check up",
      "veterinary check",
      "veterinary check up"
    ]);

  return mentionsAnimalOrVet && asksCheckup;
}

function hasVetVisitScheduleIntent(text = "") {
  const mentionsVet = includesAnyWord(text, ["vet", "veterinarian", "clinic"]) ||
    includesAnyPhrase(text, ["veterinary office", "city vet", "cityvet"]);

  return mentionsVet && (
    includesAnyWord(text, ["when", "kailan", "schedule", "appointment", "visit", "pupunta", "punta", "open", "hours", "oras"]) ||
    includesAnyPhrase(text, [
      "when should i go",
      "when can i go",
      "when to visit",
      "kailan pupunta",
      "kailan ako pupunta",
      "anong oras",
      "ano oras"
    ])
  );
}

async function getMyAdoptionContext(email = "") {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return { adoptions: [] };

  const snapshot = await db.collection("adoptions").get();
  const adoptions = snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((item) => {
      const applicantEmail = String(
        item.account?.email ||
        item.applicant?.email ||
        item.userEmail ||
        ""
      ).trim().toLowerCase();

      return applicantEmail === normalizedEmail;
    })
    .map((item) => ({
      id: item.id,
      applicationId: item.applicationId || item.id,
      petName: item.pet_label || item.pet_name || item.selected_pet?.name || "your selected animal",
      status: item.status || "Pending",
      approvedAt: item.approvedAt || null,
      adoptionDate: item.adoptionDate || "",
      pickupSchedule: item.pickupSchedule || null,
      pickupRescheduleRequest: item.pickupRescheduleRequest || null,
      attendanceDeadlineAt: item.attendanceDeadlineAt || null,
      deadlineStatus: item.deadlineStatus || "",
      arrivalConfirmedAt: item.arrivalConfirmedAt || null,
      submittedAt: item.submittedAt || null,
      updatedAt: item.updatedAt || null
    }));

  adoptions.sort((a, b) => getSortableDate(b).getTime() - getSortableDate(a).getTime());
  return { adoptions };
}

function getSortableDate(item = {}) {
  return parseAnyDate(item.updatedAt) ||
    parseAnyDate(item.submittedAt) ||
    parseAnyDate(item.approvedAt) ||
    new Date(0);
}

function parseAnyDate(value) {
  if (!value) return null;
  if (value?.toDate) return value.toDate();
  if (value?._seconds) return new Date(value._seconds * 1000);
  if (value?.seconds) return new Date(value.seconds * 1000);

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatQuizDate(value, language = "english") {
  const date = parseAnyDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat(language === "tagalog" ? "fil-PH" : "en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila"
  }).format(date);
}

async function getMyAdoptionContextSafely(req) {
  if (!req.user?.email) return { adoptions: [] };

  return getMyAdoptionContext(req.user.email).catch((error) => {
    console.warn("[Chatbot User Adoption Context Warning]", error.message);
    return { adoptions: [] };
  });
}

function selectRelevantAdoption(adoptions = []) {
  return adoptions.find((item) => hasScheduleValue(item.pickupSchedule)) ||
    adoptions.find((item) => isApprovedStatus(item.status)) ||
    adoptions[0] ||
    null;
}

function hasScheduleValue(schedule = {}) {
  return Boolean(schedule?.date || schedule?.time);
}

function isApprovedStatus(status = "") {
  const lower = String(status || "").toLowerCase();
  return lower.includes("approved") || lower.includes("finalized");
}

function isPendingStatus(status = "") {
  const lower = String(status || "").toLowerCase();
  return lower.includes("pending") || lower.includes("review");
}

function getScheduledPickupReply(adoption, language = "english") {
  if (!adoption) {
    return localizedReply(
      language,
      "I cannot see an adoption application under your signed-in account yet. Please open My Applications to confirm your records, or sign in with the account you used for the application.",
      "Wala pa akong nakikitang adoption application sa signed-in account mo. Buksan ang My Applications para i-check ang records mo, o mag-sign in gamit ang account na ginamit mo sa application."
    );
  }

  const schedule = adoption.pickupSchedule || {};
  const scheduleDate = schedule.date || adoption.adoptionDate || "";
  const scheduleTime = formatTime(schedule.time);
  const scheduleText = [formatDate(scheduleDate), scheduleTime].filter(Boolean).join(" at ");
  const deadlineText = formatDate(adoption.attendanceDeadlineAt);
  const petName = adoption.petName || "your selected animal";
  const reference = adoption.applicationId ? ` (${adoption.applicationId})` : "";

  if (scheduleText) {
    return localizedReply(
      language,
      `Your pickup schedule for ${petName}${reference} is ${scheduleText}. Please go to the Angeles City Veterinary Office on that schedule and bring the required documents shown in My Applications.`,
      `Ang pickup schedule mo para kay ${petName}${reference} ay ${scheduleText}. Pumunta sa Angeles City Veterinary Office sa schedule na iyon at dalhin ang required documents na nakalagay sa My Applications.`
    );
  }

  if (isApprovedStatus(adoption.status)) {
    return localizedReply(
      language,
      `Your application for ${petName}${reference} is approved, but I do not see a pickup schedule yet. Please open My Applications and use Schedule Pickup. ${deadlineText ? `Choose a date on or before ${deadlineText}.` : "Please schedule within the allowed attendance deadline shown there."}`,
      `Approved na ang application mo para kay ${petName}${reference}, pero wala pa akong nakikitang pickup schedule. Buksan ang My Applications at gamitin ang Schedule Pickup. ${deadlineText ? `Pumili ng petsa hanggang ${deadlineText}.` : "Mag-schedule sa loob ng attendance deadline na nakalagay doon."}`
    );
  }

  if (isPendingStatus(adoption.status)) {
    return localizedReply(
      language,
      `Your application for ${petName}${reference} is still ${adoption.status}. Check My Applications for updates. Schedule Pickup will only appear after the Angeles City Veterinary Office approves the application.`,
      `Ang application mo para kay ${petName}${reference} ay ${adoption.status} pa. Tingnan ang My Applications para sa updates. Lalabas lang ang Schedule Pickup kapag approved na ng Angeles City Veterinary Office ang application.`
    );
  }

  return localizedReply(
    language,
    `Your latest adoption application for ${petName}${reference} is marked ${adoption.status}. Please open My Applications for the full details and next steps.`,
    `Ang latest adoption application mo para kay ${petName}${reference} ay marked ${adoption.status}. Buksan ang My Applications para sa buong details at next steps.`
  );
}

function hasContactIntent(text = "") {
  return includesAnyWord(text, ["contact", "office", "location", "address", "phone", "help", "hours", "saan", "oras", "tawag"]) ||
    includesAnyPhrase(text, ["office email", "contact email", "email address", "send an email"]);
}

function hasOfficeLocationIntent(text = "") {
  const mentionsOffice = includesAnyWord(text, ["vet", "veterinarian", "cityvet"]) ||
    includesAnyPhrase(text, [
      "angeles city vet",
      "angeles city veterinary office",
      "city veterinary office",
      "city vet",
      "veterinary office"
    ]);
  const asksLocation = includesAnyWord(text, ["where", "location", "address", "located", "saan"]) ||
    includesAnyPhrase(text, [
      "where is",
      "where can i find",
      "how do i get to",
      "exact location",
      "saan ang",
      "saan located",
      "nasaan"
    ]);

  return mentionsOffice && asksLocation;
}

function hasPublicAccountLimitIntent(text = "") {
  return (
    includesAnyWord(text, ["guest", "public", "without", "account", "login", "signin", "sign-in", "anonymous", "visitor", "walang"]) ||
    includesAnyPhrase(text, ["not logged in", "without logging in", "without an account", "walang account", "hindi naka login", "di naka login"])
  ) && (
    includesAnyWord(text, ["animua"]) ||
    hasAdoptionMentionIntent(text) ||
    hasSurrenderIntent(text) ||
    hasApplicationIntent(text) ||
    includesAnyWord(text, ["status", "schedule", "pickup", "apply", "submit"])
  );
}

function hasApplicationEditIntent(text = "") {
  return hasApplicationIntent(text) && (
    includesAnyWord(text, ["edit", "change", "update", "correct", "wrong", "mistake", "revise", "modify", "palit", "baguhin", "mali", "ayusin"]) ||
    includesAnyPhrase(text, ["change my application", "edit my application", "wrong information", "maling information", "maling details"])
  );
}

function hasApplicationRejectedIntent(text = "") {
  return hasApplicationIntent(text) && (
    includesAnyWord(text, ["rejected", "declined", "denied", "failed", "reject", "bakit", "why"]) ||
    includesAnyPhrase(text, ["not approved", "hindi approved", "hindi na approve", "na reject", "na-reject"])
  );
}

function hasApplicationWithdrawIntent(text = "") {
  return (hasApplicationIntent(text) || hasAdoptionMentionIntent(text)) && (
    includesAnyWord(text, ["cancel", "cancelled", "canceled", "withdraw", "remove", "delete", "stop", "bawiin", "icancel"]) ||
    includesAnyPhrase(text, [
      "cancel my application",
      "withdraw my application",
      "cancel my adoption",
      "withdraw my adoption",
      "i-cancel application",
      "i-cancel adoption",
      "icancel application",
      "icancel adoption"
    ])
  );
}

function hasPickupMissedIntent(text = "") {
  const mentionsPickup = hasAdoptionPickupIntent(text) || includesAnyWord(text, ["pickup", "late", "missed", "absent", "no-show", "nalate", "nahuli"]);

  return mentionsPickup && (
    includesAnyWord(text, ["late", "missed", "miss", "absent", "no-show", "noshow", "huli", "late", "nalate", "nahuli", "hindi"]) ||
    includesAnyPhrase(text, ["miss my pickup", "missed my pickup", "late for pickup", "hindi nakapunta", "di nakapunta", "na miss ko"])
  );
}

function hasAdoptionScheduleLocationIntent(text = "") {
  return (
    hasApplicationIntent(text) ||
    hasAdoptionMentionIntent(text) ||
    includesAnyWord(text, ["pickup", "schedule", "appointment", "release", "date", "time", "oras", "kailan", "iskedyul"])
  ) && (
    includesAnyWord(text, ["where", "see", "view", "find", "check", "saan", "makikita", "tingnan"]) ||
    includesAnyPhrase(text, ["where can i see", "where do i see", "saan makikita", "saan ko makikita", "my applications"])
  ) && (
    includesAnyWord(text, ["schedule", "appointment", "pickup", "release", "date", "time", "oras", "iskedyul"]) ||
    includesAnyPhrase(text, ["my applications"])
  );
}

function hasReservationIntent(text = "") {
  return (
    hasAnimalMentionIntent(text) ||
    hasAdoptionMentionIntent(text)
  ) && (
    includesAnyWord(text, ["reserve", "reservation", "hold", "reserved", "ipareserve", "ireserve", "pareserve"]) ||
    includesAnyPhrase(text, ["can i reserve", "hold the animal", "hold the pet", "pa reserve", "pa-reserve"])
  );
}

function hasLostPetIntent(text = "") {
  return includesAnyWord(text, ["lost", "missing", "nawala", "hinahanap"]) ||
    includesAnyPhrase(text, ["lost my dog", "lost my cat", "lost my pet", "nawala aso", "nawala pusa", "nawala ang aso", "nawala ang pusa"]);
}

function hasAgeRequirementIntent(text = "") {
  return (
    hasAdoptionMentionIntent(text) ||
    hasApplicationIntent(text)
  ) && (
    includesAnyWord(text, ["age", "minor", "adult", "student", "underage", "edad", "bata"]) ||
    includesAnyPhrase(text, ["how old", "ilang taon", "legal age"])
  );
}

function hasAnimalDetailsQuestionIntent(text = "") {
  return (
    hasAnimalMentionIntent(text) ||
    includesAnyPhrase(text, ["find furbabies"])
  ) && (
    includesAnyWord(text, ["photo", "photos", "picture", "details", "breed", "age", "sex", "gender", "temperament", "behavior", "size", "weight", "history", "medical", "vaccination", "larawan", "detalye", "edad", "lahi"]) ||
    includesAnyPhrase(text, ["more info", "more information", "animal profile", "pet profile"])
  );
}

function hasUrgentMedicalIntent(text = "") {
  return includesAnyWord(text, [
    "emergency",
    "dying",
    "poison",
    "poisonous",
    "chocolate",
    "bleeding",
    "breathe",
    "breathing",
    "seizure",
    "seizures",
    "unconscious",
    "vehicle",
    "hit",
    "vomiting",
    "blood",
    "sick",
    "injured",
    "bite",
    "bitten",
    "rabies",
    "kagat",
    "nakagat",
    "sugat"
  ]) || includesAnyPhrase(text, ["may sakit", "cannot breathe", "can't breathe", "cant breathe", "ate poison", "ate chocolate", "hit by a vehicle", "vomiting blood"]);
}

function hasStrayIntent(text = "") {
  return includesAnyWord(text, ["stray", "abandoned", "rescue", "rescued", "found", "pound", "ligaw", "napulot"]) ||
    includesAnyPhrase(text, ["report a stray", "found a dog", "found a cat", "found an animal", "abandoned dog", "abandoned cat", "can animua rescue"]);
}

function hasSurrenderIntent(text = "") {
  return includesAnyWord(text, [
    "surrender",
    "surrendered",
    "surrendering",
    "magsurrender",
    "sinurrender",
    "isurrender",
    "isusurrender",
    "isuko",
    "isusuko",
    "susuko",
    "rehome",
    "rehoming",
    "return",
    "returned",
    "returning",
    "landlord",
    "relocation",
    "afford",
    "financial",
    "hardship",
    "ibalik",
    "ibinalik",
    "ibabalik",
    "binalik",
    "balik",
    "isoli",
    "isauli",
    "maalagaan"
  ]) ||
    includesAnyPhrase(text, [
      "give up my dog",
      "give up my cat",
      "give back my dog",
      "give back my cat",
      "give back the dog",
      "give back the cat",
      "return my dog",
      "return my cat",
      "return the dog",
      "return the cat",
      "bring back my dog",
      "bring back my cat",
      "bring back my pet",
      "bring back my animal",
      "bring back the dog",
      "bring back the cat",
      "bring back the pet",
      "bring back the animal",
      "give back my pet",
      "give back my animal",
      "give back the pet",
      "give back the animal",
      "return my pet",
      "return my animal",
      "return the pet",
      "return the animal",
      "cannot keep",
      "can't keep",
      "cant keep",
      "cannot care",
      "can't care",
      "cant care",
      "no longer care",
      "no longer afford",
      "cannot afford",
      "can't afford",
      "cant afford",
      "financial hardship",
      "not allow pets",
      "ayaw na",
      "ayaw ko na",
      "hindi ko na kaya",
      "hindi ko na maalagaan",
      "di ko na maalagaan",
      "ibalik yung",
      "ibalik ang",
      "ibalik ko",
      "ibinalik ko",
      "binalik ko",
      "isoli yung",
      "isoli ang",
      "isauli yung",
      "isauli ang",
      "ibalik yung aso",
      "ibalik ang aso",
      "ibalik yung pusa",
      "ibalik ang pusa",
      "ibalik sa inyo",
      "ibalik sainyo",
      "sa inyo yung aso",
      "sainyo yung aso",
      "sa inyo ang aso",
      "sainyo ang aso"
    ]);
}

function hasSurrenderCareIntent(text = "") {
  if (!hasSurrenderIntent(text) || !hasAnimalMentionIntent(text)) return false;

  return includesAnyPhrase(text, [
    "take care of my",
    "take care of the",
    "care for my",
    "care for the",
    "look after my",
    "look after the",
    "will you take care",
    "will the shelter take care",
    "will the shelter care",
    "aalagaan niyo",
    "aalagaan ninyo",
    "aalagaan ba",
    "alagaan ang pet",
    "alagaan ang aso",
    "alagaan ang pusa"
  ]);
}

function hasAdoptedAnimalSurrenderIntent(text = "") {
  const mentionsAdoptedAnimal =
    includesAnyPhrase(text, [
      "dog i adopted",
      "cat i adopted",
      "pet i adopted",
      "animal i adopted",
      "dog i adopt",
      "cat i adopt",
      "pet i adopt",
      "animal i adopt",
      "adopted dog",
      "adopted cat",
      "adopted pet",
      "adopted animal",
      "adopt from you",
      "adopted from you",
      "adopt from animua",
      "adopted from animua",
      "got from animua",
      "got from you",
      "from your shelter",
      "from the shelter",
      "inadopt ko",
      "na adopt ko",
      "na-adopt ko",
      "ampon ko"
    ]) ||
    (
      includesAnyWord(text, ["adopt", "adopted", "adoption"]) &&
      hasAnimalMentionIntent(text)
    );

  return hasSurrenderIntent(text) && mentionsAdoptedAnimal;
}

function hasSurrenderThenAdoptIntent(text = "") {
  const mentionsAdoption =
    text.includes("adopt") ||
    includesAnyWord(text, ["adoption", "adopter", "iadopt", "umampon", "ampon"]);

  return hasSurrenderIntent(text) && mentionsAdoption &&
    (
      includesAnyWord(text, [
        "if",
        "then",
        "after",
        "again",
        "later",
        "still",
        "future",
        "another",
        "new",
        "next",
        "allowed",
        "allow",
        "eligible",
        "eligibility",
        "ban",
        "banned",
        "blacklist",
        "blacklisted",
        "blocked",
        "disqualify",
        "disqualified",
        "affect",
        "record",
        "history",
        "ulit"
      ]) ||
      includesAnyPhrase(text, [
        "then i adopt",
        "then adopt",
        "after surrender",
        "after i surrender",
        "after surrendering",
        "after surrendered",
        "surrender then adopt",
        "surrender and adopt",
        "can i still adopt",
        "can i adopt later",
        "can i adopt again",
        "can i adopt another",
        "can i adopt a new",
        "allowed to adopt",
        "eligible to adopt",
        "will surrender affect",
        "affect my adoption",
        "future adoption",
        "next adoption",
        "adoption application later",
        "am i banned",
        "will i be banned",
        "will i get banned",
        "will i be blacklisted",
        "am i blacklisted",
        "does surrender disqualify",
        "does surrendering disqualify",
        "adopt again",
        "mag adopt ulit",
        "mag-adopt ulit",
        "umampon ulit",
        "pwede pa ba mag adopt",
        "pwede pa mag adopt",
        "pwede pa ba ako mag adopt",
        "makakapag adopt pa ba",
        "bawal na ba mag adopt",
        "blacklisted ba",
        "ma blacklist",
        "ma ban",
        "banned ba",
        "pagkatapos mag surrender",
        "pagkatapos ko mag surrender"
      ])
    );
}

function hasSurrenderConsequenceIntent(text = "") {
  return hasSurrenderIntent(text) && (
    includesAnyWord(text, [
      "ban",
      "banned",
      "blacklist",
      "blacklisted",
      "blocked",
      "disqualify",
      "disqualified",
      "affect",
      "record",
      "history",
      "penalty",
      "violation",
      "future"
    ]) ||
    includesAnyPhrase(text, [
      "am i banned",
      "will i be banned",
      "will i get banned",
      "am i blacklisted",
      "will i be blacklisted",
      "blacklisted ba",
      "banned ba",
      "ma blacklist",
      "ma ban",
      "bawal na ba",
      "may penalty",
      "affect my account",
      "affect future",
      "affect my record"
    ])
  );
}

function hasSurrenderAvailabilityIntent(text = "") {
  return hasSurrenderIntent(text) && (
    includesAnyWord(text, ["available", "accepting", "open", "closed", "pause", "paused", "full", "cage", "cages", "space", "slot", "slots"]) ||
    includesAnyPhrase(text, [
      "can i submit",
      "are you accepting",
      "accept surrender",
      "shelter full",
      "may space",
      "may cage",
      "may cages",
      "open ba",
      "tumatanggap ba",
      "pwede ba magsurrender",
      "puwede ba magsurrender"
    ])
  );
}

function hasSurrenderDocumentIntent(text = "") {
  return hasSurrenderIntent(text) && (
    includesAnyWord(text, ["requirement", "requirements", "document", "documents", "bring", "prepare", "id", "proof", "record", "records", "vaccination", "kailangan", "dala", "dalhin"]) ||
    includesAnyPhrase(text, [
      "what to bring",
      "what should i bring",
      "what do i need",
      "ano kailangan",
      "ano ang kailangan",
      "anong kailangan",
      "ano dadalhin",
      "valid id",
      "vaccination record",
      "proof of residence"
    ])
  );
}

function hasSurrenderAppointmentIntent(text = "") {
  return hasSurrenderIntent(text) && (
    includesAnyWord(text, ["appointment", "schedule", "dropoff", "drop-off", "bring", "deliver", "date", "time", "reschedule", "walkin", "pupunta", "punta", "dalhin"]) ||
    includesAnyPhrase(text, [
      "when can i bring",
      "when do i bring",
      "bring my pet",
      "bring the animal",
      "drop off",
      "walk in",
      "walk-in",
      "walk in surrender",
      "walk-in surrender",
      "walk in yung surrender",
      "walk-in yung surrender",
      "schedule surrender",
      "surrender appointment",
      "kailan dadalhin",
      "kailan ko dadalhin",
      "kailan pupunta"
    ])
  );
}

function getMentionedAnimalLabel(text = "", language = "english") {
  if (includesAnyWord(text, ["cat", "cats", "pusa"])) {
    return language === "tagalog" ? "cat" : "cat";
  }

  if (includesAnyWord(text, ["dog", "dogs", "aso"])) {
    return language === "tagalog" ? "dog" : "dog";
  }

  return language === "tagalog" ? "pet" : "pet";
}

function hasOutsideAngelesIntent(text = "") {
  return includesAnyWord(text, ["nonresident", "non-resident"]) ||
    (
      includesAnyWord(text, ["outside"]) &&
      includesAnyWord(text, ["angeles"])
    ) ||
    (
      includesAnyWord(text, ["not", "hindi", "di"]) &&
      (includesAnyWord(text, ["from", "froma", "taga", "resident"]) || includesAnyPhrase(text, ["from a"])) &&
      includesAnyWord(text, ["angeles"])
    ) ||
    hasNonAngelesTagaIntent(text) ||
    includesAnyPhrase(text, [
      "not from angeles",
      "not from angeles city",
      "not froma angeles",
      "not froma angeles city",
      "not from a angeles",
      "not from a angeles city",
      "outside angeles",
      "outside angeles city",
      "outside of angeles",
      "outside of angeles city",
      "not an angeles resident",
      "not angeles resident",
      "hindi taga angeles",
      "di taga angeles",
      "hindi taga angeles city",
      "taga ibang city",
      "ibang city"
    ]);
}

function hasNonAngelesTagaIntent(text = "") {
  if (!hasNonAngelesResidenceMention(text)) {
    return false;
  }

  return hasSurrenderIntent(text) ||
    includesAnyWord(text, ["resident", "residence", "city", "municipality", "barangay", "pampanga"]);
}

function hasNonAngelesResidenceMention(text = "") {
  const normalized = ` ${String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  const match =
    normalized.match(/\b(taga|from)\s+([a-z0-9]+)/) ||
    normalized.match(/\b(live|lives|living|reside|resides|residing)\s+in\s+([a-z0-9]+)/) ||
    normalized.match(/\bresident\s+of\s+([a-z0-9]+)/);

  if (!match) {
    return false;
  }

  const place = match[2] || match[1];
  const nonPlaceWords = new Set(["a", "an", "my", "the", "this", "that", "your", "our", "pet", "dog", "cat", "animal", "shelter", "office", "you", "here", "there"]);

  if (place === "angeles" || nonPlaceWords.has(place)) {
    return false;
  }

  return true;
}

function hasNavigationIntent(text = "") {
  return includesAnyWord(text, ["where", "page", "find", "navigate", "track", "edit", "profile"]) ||
    includesAnyPhrase(text, ["where can i", "where is", "where are", "saan makikita", "saan ang", "track my application", "edit my profile"]);
}

function hasUserProfileIntent(text = "") {
  return includesAnyWord(text, ["profile"]) && (
    includesAnyWord(text, ["my", "edit", "update", "change", "account"]) ||
    includesAnyPhrase(text, ["my profile", "edit my profile", "update my profile", "change my profile"])
  );
}

function hasTermsPrivacyIntent(text = "") {
  return includesAnyWord(text, ["terms", "privacy", "policy", "personal", "information", "documents", "data", "credentials", "impersonation", "misuse"]) ||
    includesAnyPhrase(text, ["why collect", "personal information", "uploaded documents", "false information", "accurate information"]);
}

function hasPetCareIntent(text = "") {
  const hasAnimalContext =
    hasAnimalMentionIntent(text) ||
    hasAdoptionMentionIntent(text) ||
    includesAnyPhrase(text, [
      "pet care",
      "care for a pet",
      "care for my pet",
      "care for my dog",
      "care for my cat",
      "before adoption",
      "after adoption",
      "responsible pet",
      "first week"
    ]);

  const hasVeterinaryCareTopic = includesAnyWord(text, [
    "vaccination",
    "vaccinations",
    "vaccine",
    "bakuna",
    "deworming",
    "spay",
    "spaying",
    "neuter",
    "neutering",
    "quarantine",
    "rabies"
  ]) || hasVaccinationIntent(text);

  const hasGeneralCareTopic = includesAnyWord(text, [
    "food",
    "water",
    "health",
    "shelter",
    "exercise",
    "hygiene",
    "temperament",
    "behavior",
    "behaviour",
    "introduce",
    "adjustment",
    "prepare",
    "home"
  ]);

  return hasVeterinaryCareTopic || (hasAnimalContext && hasGeneralCareTopic);
}

function hasQuizIntent(text = "") {
  return includesAnyWord(text, [
    "match",
    "matching",
    "quiz",
    "compatibility",
    "compatible",
    "accurate",
    "accuracy",
    "recommend",
    "recommended",
    "recommendation",
    "recommendations",
    "score",
    "ranked",
    "ranking",
    "preferred",
    "preference",
    "preferences",
    "retake",
    "lifestyle"
  ]) || includesAnyPhrase(text, [
    "match quiz",
    "matching accurate",
    "matching accuracy",
    "is matching accurate",
    "compatibility score",
    "preferred pet",
    "preferred animal",
    "not recommended",
    "why not recommend",
    "take the quiz",
    "retake the quiz"
  ]);
}

function hasQuizRetakeIntent(text = "") {
  if (!hasQuizIntent(text)) return false;

  return includesAnyWord(text, ["retake", "retakes", "retaking", "again", "ulit", "ulitin", "muli"]) ||
    includesAnyPhrase(text, [
      "take the quiz again",
      "take quiz again",
      "when can i retake",
      "when can i take the quiz",
      "next retake",
      "quiz again",
      "quiz ulit",
      "ulitin ang quiz",
      "kailan pwede mag quiz",
      "kailan pwedeng mag quiz",
      "kailan puwede mag quiz",
      "kailan maaaring mag quiz"
    ]);
}

function hasQuizAccuracyIntent(text = "") {
  return hasQuizIntent(text) && (
    includesAnyWord(text, ["accurate", "accuracy", "reliable", "guarantee", "guaranteed"]) ||
    includesAnyPhrase(text, ["how accurate", "is the quiz accurate", "matching accurate"])
  );
}

function getAdoptionRescheduleAccountReply(adoption, language = "english") {
  if (!adoption) return "";

  const petName = adoption.petName || "your selected animal";
  const reference = adoption.applicationId ? ` (${adoption.applicationId})` : "";
  const status = String(adoption.status || "").trim();
  const schedule = adoption.pickupSchedule || {};

  if (status.toLowerCase() !== "approved") {
    return localizedReply(
      language,
      `Your application for ${petName}${reference} is ${status || "not approved yet"}. Only an approved application with an existing pickup schedule can use Reschedule. Check My Applications for the official status and next step.`,
      `Ang application mo para kay ${petName}${reference} ay ${status || "hindi pa approved"}. Approved application na may existing pickup schedule lang ang maaaring gumamit ng Reschedule. Tingnan ang My Applications para sa official status at next step.`
    );
  }

  if (!hasScheduleValue(schedule)) {
    return localizedReply(
      language,
      `Your application for ${petName}${reference} is approved, but it does not have a pickup schedule yet. Open My Applications and use Schedule Pickup first; Reschedule becomes available only after an initial schedule is saved.`,
      `Approved ang application mo para kay ${petName}${reference}, pero wala pa itong pickup schedule. Buksan ang My Applications at gamitin muna ang Schedule Pickup; magiging available lang ang Reschedule kapag may initial schedule nang naka-save.`
    );
  }

  const explicitCount = Number(schedule.rescheduleCount || 0);
  const usedCount = Math.max(0, explicitCount || (schedule.rescheduledAt ? 1 : 0));
  const remaining = Math.max(0, 1 - usedCount);

  if (!remaining) {
    return localizedReply(
      language,
      `You have already used your one pickup reschedule for ${petName}${reference}. The current pickup schedule is final and the Reschedule option is disabled. Your account will be disabled if the 14-day attendance deadline passes without a confirmed pickup.`,
      `Nagamit mo na ang isang pickup reschedule para kay ${petName}${reference}. Final na ang current pickup schedule at disabled na ang Reschedule option. Made-disable ang account mo kapag lumampas ang 14-day attendance deadline nang walang confirmed pickup.`
    );
  }

  return localizedReply(
    language,
    `You have one pickup reschedule remaining for ${petName}${reference}. Open My Applications and use Reschedule. Choose today or a later date within the active 14-day attendance deadline; the valid change is saved immediately without a separate review. Your next change will be final.`,
    `May isang pickup reschedule ka pang natitira para kay ${petName}${reference}. Buksan ang My Applications at gamitin ang Reschedule. Pumili ng date ngayong araw o mas huli na pasok sa active 14-day attendance deadline; agad mase-save ang valid change nang walang hiwalay na review. Final na ang susunod mong pagbabago.`
  );
}

function hasQuizProcessIntent(text = "") {
  if (!hasQuizIntent(text)) return false;

  return includesAnyWord(text, ["how", "paano", "process", "steps", "start", "begin", "answer", "answers", "language"]) ||
    includesAnyPhrase(text, [
      "how does the quiz work",
      "how to take the quiz",
      "how do i take",
      "quiz process",
      "quiz steps",
      "take the quiz"
    ]);
}

function hasLiveCommunicationIntent(text = "") {
  return includesAnyWord(text, ["staff", "employee", "chat", "video", "consultation", "transfer"]) ||
    includesAnyPhrase(text, ["live chat", "video consult", "talk to staff", "transfer me"]);
}

function hasAnimalProfileIntent(text = "") {
  return includesAnyWord(text, ["profile", "temperament", "medical", "history", "behavior", "behaviour", "care", "breed", "age", "sex", "surrendered", "impounded", "reserved", "unavailable", "adopted", "under-care", "disappear", "disappeared", "missing"]) ||
    includesAnyPhrase(text, ["why disappeared", "why did a pet disappear", "why did pet disappear", "no longer appear", "what does rescued mean", "what does surrendered mean", "what does impounded mean"]);
}

function hasAdoptionQuantityIntent(text = "") {
  const hasMultipleCount = /\b(?:[2-9]|[1-9]\d+)\b/.test(text) ||
    includesAnyWord(text, [
      "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
      "dalawa", "dalawang", "tatlo", "tatlong", "apat", "apat na", "lima", "limang"
    ]);

  return (
    (text.includes("adopt") || includesAnyWord(text, ["application", "apply"])) &&
    (
      hasMultipleCount ||
      includesAnyWord(text, ["multiple", "several", "limit", "maximum", "max", "number", "ilan", "dami", "marami"]) ||
      includesAnyPhrase(text, [
        "how many",
        "more than one",
        "higit sa isa",
        "higit sa isang",
        "higit sa isang pet",
        "higit sa isang animal",
        "more than 1",
        "ilang pet",
        "ilang pets",
        "ilang aso",
        "ilang pusa"
      ])
    )
  );
}

function hasOfflineAdoptionIntent(text = "") {
  const mentionsAdoption =
    text.includes("adopt") ||
    includesAnyWord(text, ["adoption", "iadopt", "ampon", "umampon"]) ||
    includesAnyPhrase(text, ["mag adopt", "pag adopt", "pa adopt"]);

  return mentionsAdoption && (
    includesAnyWord(text, ["offline", "walkin", "walk-in", "onsite", "inperson"]) ||
    includesAnyPhrase(text, [
      "in person",
      "in-person",
      "at the office",
      "sa office",
      "sa shelter",
      "pumunta sa office",
      "pumunta sa shelter",
      "walk in",
      "walk-in adoption",
      "offline adoption"
    ])
  );
}

function hasAdoptionProcessIntent(text = "") {
  if (
    hasAdoptionMentionIntent(text) &&
    (
      includesAnyWord(text, ["who", "which", "sino", "alin"]) ||
      includesAnyPhrase(text, ["sino ang mga", "sino pwede", "sino pwedeng", "sino puwede", "sino puwedeng", "can be adopted"])
    )
  ) {
    return false;
  }

  return (
    text.includes("adopt") ||
    includesAnyWord(text, ["adoption", "adopter", "ampon", "umampon", "iadopt"]) ||
    includesAnyPhrase(text, ["i want a dog", "i want a cat", "i want a pet", "get a pet"])
  ) && (
    includesAnyWord(text, ["how", "guide", "process", "steps", "procedure", "start", "begin", "need", "needs", "do", "pwede", "pwedeng", "puwede", "puwedeng", "paano", "ano", "gagawin", "puppy", "kitten", "senior", "adult"]) ||
    includesAnyPhrase(text, ["how do i", "how can i", "what do i need to do", "what should i do", "what do i do", "can i adopt", "pwede ba", "puwede ba", "ano gagawin", "anong gagawin"])
  );
}

function hasPostAdoptionIntent(text = "") {
  if (hasApplicationWithdrawIntent(text)) return false;

  const mentionsAdoption =
    text.includes("adopt") ||
    includesAnyWord(text, ["adoption", "adopter", "inadopt", "iadopt"]);

  return mentionsAdoption && (
    includesAnyWord(text, ["approved", "approval", "after", "monitoring", "followup", "follow-up"]) ||
    includesAnyPhrase(text, ["after approval", "after adoption", "post adoption", "post-adoption", "follow up", "what happens after"])
  );
}

function hasAdoptionPickupIntent(text = "") {
  const mentionsAdoption =
    text.includes("adopt") ||
    includesAnyWord(text, ["adoption", "adopter", "inadopt", "iadopt", "ampon"]) ||
    hasAnimalMentionIntent(text);

  return mentionsAdoption && (
    includesAnyWord(text, [
      "pickup",
      "pipick",
      "pipickup",
      "ipick",
      "ipickup",
      "magpickup",
      "claim",
      "release",
      "kunin",
      "kuha",
      "makukuha"
    ]) ||
    includesAnyPhrase(text, [
      "pick up",
      "pipick up",
      "pi pick up",
      "ipick up",
      "mag pick up",
      "get the pet",
      "get my pet",
      "get the animal",
      "get my animal",
      "kunin ang",
      "kunin yung",
      "kunin ko",
      "pwede kunin",
      "pwedeng kunin",
      "puwede kunin",
      "puwedeng kunin"
    ])
  );
}

function hasAdoptionPickupDocumentIntent(text = "") {
  const mentionsAdoptionPickup =
    hasAdoptionPickupIntent(text) ||
    includesAnyPhrase(text, ["pick up"]) ||
    includesAnyWord(text, ["pickup", "release", "kunin", "kuha"]) ||
    (hasAdoptionMentionIntent(text) && includesAnyWord(text, ["pickup", "release", "kunin", "kuha"]));

  return mentionsAdoptionPickup && (
    includesAnyWord(text, ["bring", "document", "documents", "requirement", "requirements", "id", "prepare", "dala", "dalhin", "kailangan"]) ||
    includesAnyPhrase(text, [
      "what to bring",
      "what should i bring",
      "what do i bring",
      "ano dadalhin",
      "ano ang dadalhin",
      "anong dadalhin",
      "valid id",
      "adoption agreement"
    ])
  );
}

function hasAdoptionPickupRescheduleIntent(text = "") {
  const mentionsPickup =
    hasAdoptionPickupIntent(text) ||
    includesAnyWord(text, ["pickup", "release", "kunin"]);

  return mentionsPickup && (
    includesAnyWord(text, ["reschedule", "reschedules", "rescheduled", "rescheduling", "resched", "change", "move", "cancel", "palit", "lipat", "ilipat", "ililipat", "iba"]) ||
    includesAnyPhrase(text, [
      "change pickup",
      "change my pickup",
      "move pickup",
      "request resched",
      "request re sched",
      "request re-sched",
      "palit schedule",
      "lipat schedule",
      "ilipat schedule",
      "ibang schedule"
    ])
  );
}

function hasScheduleChangeIntent(text = "") {
  return includesAnyWord(text, ["reschedule", "reschedules", "rescheduled", "rescheduling", "resched", "change", "move", "palit", "lipat", "ilipat", "ililipat"]) ||
    includesAnyPhrase(text, [
      "request resched",
      "request re sched",
      "request re-sched",
      "change schedule",
      "move schedule",
      "palit schedule",
      "lipat schedule",
      "ilipat schedule",
      "ibang schedule"
    ]);
}

function hasSurrenderAppointmentRescheduleIntent(text = "") {
  const mentionsSurrenderAppointment = hasSurrenderIntent(text) ||
    includesAnyWord(text, ["dropoff"]) ||
    includesAnyPhrase(text, ["drop off", "drop-off"]);

  return mentionsSurrenderAppointment && hasScheduleChangeIntent(text) &&
    !hasAdoptionPickupRescheduleIntent(text);
}

function hasGeneralRescheduleIntent(text = "") {
  const explicitlyAsksToReschedule = includesAnyWord(text, ["reschedule", "reschedules", "rescheduled", "rescheduling", "resched"]) ||
    includesAnyPhrase(text, [
      "request resched",
      "request re sched",
      "request re-sched",
      "palit schedule",
      "lipat schedule",
      "ilipat schedule",
      "ibang schedule"
    ]);

  return explicitlyAsksToReschedule &&
    !hasAdoptionPickupRescheduleIntent(text) &&
    !hasSurrenderAppointmentRescheduleIntent(text);
}

function hasBlockedRescheduleQuestion(text = "") {
  return (
    hasAdoptionPickupRescheduleIntent(text) ||
    hasSurrenderAppointmentRescheduleIntent(text) ||
    hasGeneralRescheduleIntent(text)
  ) && (
    includesAnyWord(text, ["why", "bakit", "cannot", "cant", "unable", "limit", "reached", "hindi", "ayaw", "wala"]) ||
    includesAnyPhrase(text, [
      "can't reschedule",
      "cannot reschedule",
      "can not reschedule",
      "no longer reschedule",
      "hindi na makapag resched",
      "di na makapag resched",
      "hindi makapag reschedule",
      "di makapag reschedule"
    ])
  );
}

function hasAdoptionApprovalTimingIntent(text = "") {
  const mentionsApplication =
    hasApplicationIntent(text) ||
    includesAnyWord(text, ["application", "apply", "submitted"]);
  const mentionsApproval =
    includesAnyWord(text, ["approve", "approved", "approval"]) ||
    includesAnyPhrase(text, ["ma approve", "ma-approve", "ma aapprove", "ma-aapprove"]);

  return mentionsApplication && mentionsApproval && (
    includesAnyWord(text, ["when", "kailan", "time", "date", "days", "hours", "long"]) ||
    includesAnyPhrase(text, ["how long", "gaano katagal"])
  );
}

function hasAdoptionHomePreparationIntent(text = "") {
  if (includesAnyWord(text, ["meet", "visit", "walk-in", "walkin"]) ||
    includesAnyPhrase(text, ["meet the animal", "meet the pet", "visit the animal", "visit the pet"])) {
    return false;
  }

  return hasAdoptionMentionIntent(text) && (
    includesAnyWord(text, ["prepare", "home", "house", "before", "needs", "supplies", "gamit", "handa", "bahay", "iuwi", "iuuwi"]) ||
    includesAnyPhrase(text, [
      "before bringing",
      "before adoption",
      "get ready to adopt",
      "prepare my home",
      "ready my home",
      "ano ihahanda",
      "anong ihahanda",
      "ihanda sa bahay",
      "bago iuwi",
      "bago iuuwi"
    ])
  );
}

function hasAdoptionEligibilityIntent(text = "") {
  return (
    text.includes("adopt") ||
    includesAnyWord(text, ["adopter", "application", "apply", "eligible", "qualify"])
  ) && (
    hasNonAngelesResidenceMention(text) ||
    includesAnyWord(text, ["student", "students", "renter", "renters", "family", "families", "household", "outside", "existing", "resident", "nonresident", "angeles"]) ||
    includesAnyPhrase(text, ["outside angeles", "outside angeles city", "not from angeles", "existing pets", "may alaga", "nangungupahan"])
  );
}

function hasVisitAnimalIntent(text = "") {
  if (hasApplicationIntent(text) || hasStatusIntent(text)) {
    return false;
  }

  return (
    hasAnimalMentionIntent(text) ||
    text.includes("adopt")
  ) && (
    includesAnyWord(text, ["visit", "meet", "appointment", "walk-in", "walkin"]) ||
    includesAnyPhrase(text, [
      "meet the animal",
      "meet the pet",
      "visit the animal",
      "visit the pet",
      "see the animal",
      "see the pet",
      "see the dog",
      "see the cat"
    ])
  );
}

function isLikelyGibberish(message = "") {
  const compact = message.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!compact) return true;
  if (compact.length <= 2) return true;
  if (/^(.)\1{4,}$/.test(compact)) return true;
  if (compact.length >= 8) {
    const vowelCount = (compact.match(/[aeiou]/g) || []).length;
    if (vowelCount / compact.length < 0.12) return true;
  }

  const words = message.toLowerCase().match(/[a-z0-9]+/g) || [];
  return words.length >= 2 && words.every((word) => word.length >= 5 && !/[aeiou]/.test(word));
}

function isOnTopic(message = "") {
  const normalizedMessage = normalizeIntentText(message);
  const topicWords = [
    "animua",
    "adopt",
    "adoption",
    "iadopt",
    "aadopt",
    "adopter",
    "ampon",
    "umampon",
    "ibalik",
    "sainyo",
    "isurrender",
    "isusurrender",
    "maalagaan",
    "pwede",
    "pwedeng",
    "puwede",
    "puwedeng",
    "ilan",
    "application",
    "apply",
    "requirement",
    "requirements",
    "fee",
    "free",
    "donate",
    "donation",
    "gcash",
    "stray",
    "abandoned",
    "rescue",
    "rescued",
    "pound",
    "impounded",
    "surrendered",
    "unavailable",
    "under-care",
    "animal",
    "animals",
    "pet",
    "pets",
    "furbaby",
    "furbabies",
    "dog",
    "dogs",
    "cat",
    "cats",
    "shelter",
    "cityvet",
    "veterinary",
    "vet",
    "angeles",
    "office",
    "surrender",
    "match",
    "quiz",
    "compatibility",
    "login",
    "register",
    "account",
    "otp",
    "verify",
    "email",
    "password",
    "contact",
    "location",
    "address",
    "phone",
    "event",
    "events",
    "vaccination",
    "vaccine",
    "vaccinated",
    "navaccine",
    "bakuna",
    "rabies",
    "hours",
    "privacy",
    "terms",
    "personal",
    "information",
    "collect",
    "documents",
    "data",
    "credentials",
    "profile",
    "status",
    "pending",
    "approved",
    "rejected",
    "cancelled",
    "completed",
    "available",
    "browse",
    "kailan",
    "sino",
    "kunin",
    "pickup",
    "release"
  ];

  return includesAnyWord(normalizedMessage, topicWords) ||
    hasGreetingIntent(normalizedMessage) ||
    hasThanksIntent(normalizedMessage) ||
    hasGoodbyeIntent(normalizedMessage) ||
    hasStrayIntent(normalizedMessage) ||
    hasSurrenderIntent(normalizedMessage) ||
    hasSurrenderAppointmentRescheduleIntent(normalizedMessage) ||
    hasGeneralRescheduleIntent(normalizedMessage) ||
    hasDonationIntent(normalizedMessage) ||
    hasPublicAccountLimitIntent(normalizedMessage) ||
    hasApplicationEditIntent(normalizedMessage) ||
    hasApplicationRejectedIntent(normalizedMessage) ||
    hasApplicationWithdrawIntent(normalizedMessage) ||
    hasAdoptionScheduleLocationIntent(normalizedMessage) ||
    hasPickupMissedIntent(normalizedMessage) ||
    hasAgeRequirementIntent(normalizedMessage) ||
    hasReservationIntent(normalizedMessage) ||
    hasAnimalDetailsQuestionIntent(normalizedMessage) ||
    hasLostPetIntent(normalizedMessage) ||
    hasAccountTroubleIntent(normalizedMessage) ||
    hasStatusExplanationIntent(normalizedMessage) ||
    hasEventIntent(normalizedMessage) ||
    hasPetCareIntent(normalizedMessage) ||
    hasQuizIntent(normalizedMessage) ||
    hasTermsPrivacyIntent(normalizedMessage) ||
    hasAnimalProfileIntent(normalizedMessage) ||
    hasNavigationIntent(normalizedMessage) ||
    hasGeneralAnimuaIntent(normalizedMessage) ||
    hasAssistantHelpIntent(normalizedMessage) ||
    hasAdoptionMotivationIntent(normalizedMessage) ||
    includesAnyPhrase(normalizedMessage, ["log in", "sign in", "find furbabies", "match quiz", "contact us", "may sakit", "live chat"]);
}

function getGuardReply(message = "", language = "english") {
  if (hasGreetingIntent(message) || hasThanksIntent(message) || hasGoodbyeIntent(message)) {
    return "";
  }

  if (isLikelyGibberish(message)) {
    return localizedReply(
      language,
      "I could not understand that. Please ask about ANIMUA adoption, Find Furbabies, surrender requests, the Match Quiz, account help, OTP verification, events, or contact information.",
      "Hindi ko naintindihan iyon. Maaari kang magtanong tungkol sa ANIMUA adoption, Find Furbabies, surrender requests, Match Quiz, account help, OTP verification, events, o contact information."
    );
  }

  if (!isOnTopic(message)) {
    return getVerifiedFallback(language);
  }

  return "";
}

function shouldUseLocalReply(message = "") {
  const lower = normalizeIntentText(message);

  return (
    hasGreetingIntent(lower) ||
    hasThanksIntent(lower) ||
    hasGoodbyeIntent(lower) ||
    hasAssistantHelpIntent(lower) ||
    hasStrayIntent(lower) ||
    hasDonationIntent(lower) ||
    hasGeneralAnimuaIntent(lower) ||
    hasPublicAccountLimitIntent(lower) ||
    hasApplicationEditIntent(lower) ||
    hasApplicationRejectedIntent(lower) ||
    hasApplicationWithdrawIntent(lower) ||
    hasApplicationIntent(lower) ||
    hasAdoptionMotivationIntent(lower) ||
    hasAdoptionFeeIntent(lower) ||
    hasOfflineAdoptionIntent(lower) ||
    hasAdoptionScheduleLocationIntent(lower) ||
    hasAdoptionPickupIntent(lower) ||
    hasAdoptionPickupDocumentIntent(lower) ||
    hasAdoptionPickupRescheduleIntent(lower) ||
    hasSurrenderAppointmentRescheduleIntent(lower) ||
    hasGeneralRescheduleIntent(lower) ||
    hasPickupMissedIntent(lower) ||
    hasAdoptionApprovalTimingIntent(lower) ||
    hasAdoptionHomePreparationIntent(lower) ||
    hasPostAdoptionIntent(lower) ||
    hasAdoptionProcessIntent(lower) ||
    hasAdoptionEligibilityIntent(lower) ||
    hasAgeRequirementIntent(lower) ||
    hasReservationIntent(lower) ||
    hasVisitAnimalIntent(lower) ||
    hasRequirementIntent(lower) ||
    hasFeeIntent(lower) ||
    hasSurrenderIntent(lower) ||
    hasQuizIntent(lower) ||
    hasAccountTroubleIntent(lower) ||
    hasAccountIntent(lower) ||
    hasStatusExplanationIntent(lower) ||
    hasEventIntent(lower) ||
    hasCheckupRequestIntent(lower) ||
    hasVetVisitScheduleIntent(lower) ||
    hasOfficeLocationIntent(lower) ||
    hasContactIntent(lower) ||
    hasUrgentMedicalIntent(lower) ||
    hasNavigationIntent(lower) ||
    hasUserProfileIntent(lower) ||
    hasTermsPrivacyIntent(lower) ||
    hasPetCareIntent(lower) ||
    hasLiveCommunicationIntent(lower) ||
    hasAnimalProfileIntent(lower) ||
    hasAnimalDetailsQuestionIntent(lower) ||
    hasLostPetIntent(lower) ||
    hasAdoptionQuantityIntent(lower) ||
    hasAnimalAvailabilityIntent(lower) ||
    (lower.includes("adopt") && !includesAny(lower, ["why", "should", "best", "recommend", "compare"]))
  );
}

function needsPublicContext(message = "") {
  const lower = normalizeIntentText(message);

  if (hasAdoptionProcessIntent(lower)) {
    return false;
  }

  if (hasCheckupRequestIntent(lower)) {
    return false;
  }

  if (hasAdoptionQuantityIntent(lower)) {
    return false;
  }

  if (hasAnimalAvailabilityIntent(lower)) {
    return true;
  }

  if (hasVaccinationScheduleIntent(lower)) {
    return true;
  }

  if (
    hasStrayIntent(lower) ||
    hasDonationIntent(lower) ||
    hasUrgentMedicalIntent(lower) ||
    hasCheckupRequestIntent(lower) ||
    hasSurrenderIntent(lower) ||
    hasAdoptionProcessIntent(lower) ||
    hasAdoptionMotivationIntent(lower) ||
    hasOfflineAdoptionIntent(lower) ||
    hasPostAdoptionIntent(lower) ||
    hasAdoptionEligibilityIntent(lower) ||
    hasVisitAnimalIntent(lower) ||
    hasRequirementIntent(lower) ||
    hasAdoptionFeeIntent(lower) ||
    hasFeeIntent(lower) ||
    hasAdoptionPickupIntent(lower) ||
    hasAdoptionPickupDocumentIntent(lower) ||
    hasAdoptionPickupRescheduleIntent(lower) ||
    hasAdoptionApprovalTimingIntent(lower) ||
    hasAdoptionHomePreparationIntent(lower) ||
    hasVetVisitScheduleIntent(lower) ||
    hasPetCareIntent(lower) ||
    hasTermsPrivacyIntent(lower) ||
    hasLiveCommunicationIntent(lower) ||
    hasAnimalProfileIntent(lower) ||
    hasNavigationIntent(lower)
  ) {
    return false;
  }

  return hasEventIntent(lower);
}

function needsUserAdoptionContext(message = "") {
  const lower = normalizeIntentText(message);
  return hasAdoptionPickupIntent(lower) ||
    hasAdoptionPickupDocumentIntent(lower) ||
    hasAdoptionPickupRescheduleIntent(lower) ||
    hasAdoptionApprovalTimingIntent(lower) ||
    hasPostAdoptionIntent(lower);
}

function buildSystemPrompt(context = {}, language = "english") {
  return [
    "You are ANIMUA Assistant for the Angeles City Veterinary Office animal adoption system.",
    language === "tagalog"
      ? "Answer in natural Tagalog or Taglish. Keep official page names like Find Furbabies, Match Quiz, Surrender, and Contact Us in English."
      : "Answer in English.",
    "Help users with adoption browsing, compatibility matching, surrender requests, account registration, email OTP verification, login, and general shelter service navigation.",
    "ANIMUA means Animal Unified Approach. It is one system for shelter operations and public services managed through the Angeles City Veterinary Office. Never invent a different expansion of ANIMUA.",
    "Use simple, everyday words and short sentences. Answer the user's question in the first sentence, then give only the next essential detail. Prefer one or two short sentences and usually stay under 45 words. State each fact once: do not repeat dates, page names, requirements, warnings, or next steps. Add a third sentence only for an essential safety warning or exception. Avoid policy-style wording, jargon, long lists, and unnecessary explanations. Sound like a helpful shelter front desk. Do not use markdown formatting, bullets, or bold markers. Do not add a generic follow-up question unless the user needs to choose a next step.",
    "For stray, found, or abandoned animal concerns, direct users to message staff through Contact Us. Do not add feature-history explanations unless the user asks for them.",
    "Adoption through ANIMUA has no adoption fee. Do not invent other fees or payment requirements.",
    "ANIMUA does not process online donation payments, GCash, bank, card, or payment gateway transactions. For donations, direct users to the Angeles City Veterinary Office for official procedures and current needs.",
    "Do not invent schedules, requirements, contact details, fees, policies, animal availability, or event information. If verified information is unavailable, direct users to Contact Us or the office.",
    "If the user asks about unrelated topics such as food ordering, entertainment, homework, coding, politics, shopping, or general trivia, politely say you can only help with ANIMUA services.",
    "If the user enters gibberish or unclear text, ask them to rephrase and mention the ANIMUA topics you can help with.",
    "Do not pretend to approve adoptions, accept surrender requests, diagnose animals, provide emergency medical advice, or make official government decisions.",
    "For medical emergencies, tell users to contact a licensed veterinarian or the Angeles City Veterinary Office directly.",
    "If asked about private account data, tell users to sign in and use the correct page instead of asking for passwords or OTP codes.",
    "Never ask for passwords, OTP codes, or sensitive documents in chat.",
    "Known public pages: Home, Find Furbabies, Match Quiz, Surrender, Contact Us.",
    "Official FAQ rules to follow:",
    "If the user asks how to adopt or what to do to adopt, explain the steps: open Find Furbabies, open an animal profile, review details, submit the adoption application from that profile, then wait for Angeles City Veterinary Office review. Do not list ready animals unless the user asks who/which animals are available.",
    "If the user asks who or which animals can be adopted, list only animals currently marked Ready in the provided public context. If none are provided, tell them to check Find Furbabies or contact the office.",
    "If the user asks about adoption fees, say adoption through ANIMUA has no adoption fee, but application review is still required.",
    "If the user asks about adoption status, approval timing, pickup schedule, pickup requirements, or rescheduling, tell them to sign in and check My Applications. Never invent a date, time, approval result, or private status.",
    "If the user is logged in and adoption context is provided, use that context for pickup schedule or latest application status. If no private context is provided, do not pretend to know their record.",
    "For an approved adoption pickup, a user may reschedule in My Applications only once. The valid change saves immediately without staff approval, must be today or later and within the active 14-day attendance deadline, and the rescheduled pickup is final.",
    "ANIMUA does not provide a cancel or withdraw option for submitted adoption applications. If an application is approved, the applicant must follow the 14-day attendance deadline; the account is automatically disabled when the deadline passes without confirmed pickup attendance. Remind users to apply only when they are ready to adopt.",
    "For an approved surrender drop-off appointment, a user may submit only one reschedule request in My Submissions. It must be today or later and within the active 14-day attendance deadline, requires staff approval, and does not replace the official appointment unless approved. The account is automatically disabled if the deadline passes without confirmed drop-off attendance.",
    "If the user asks what to bring for pickup, say the official list is shown in the adoption application details in My Applications and may include valid ID, adoption agreement, and office instructions.",
    "If the user asks about multiple applications, say they may submit more than one application for different animals, but each is reviewed separately and approval is not guaranteed.",
    "If the user asks about surrender eligibility, say only qualified Angeles City residents may submit surrender requests through ANIMUA. Users from other cities or municipalities should contact their local city or municipal veterinary office, animal welfare office, or nearest shelter.",
    "If the user asks how to surrender, explain the Surrender page form, required truthful owner/contact/barangay/animal/vaccination/reason details, review by the office, and that submission does not guarantee acceptance.",
    "If the user asks about bringing an animal to the shelter, say not to bring it unless the office has approved or confirmed the next step.",
    "If the user asks about animal vaccination records, medical history, age, sex, breed, photos, or behavior, direct them to the animal profile in Find Furbabies and to contact the office if details are missing or unclear.",
    "If the user asks when vaccination, anti-rabies, spay/neuter, or other public service events happen, direct them to the Home page event section and Contact Us for official confirmation. Do not treat event schedules as an individual animal vaccination record.",
    "If the user asks about a stray, found, or abandoned animal, direct them to message staff through Contact Us. Keep the response brief.",
    "If the user asks what can be done without an account, say Home, Find Furbabies, Surrender information, and Contact Us can be browsed without signing in, but taking the Match Quiz, applications, surrender requests, private statuses, and schedules require a Public account.",
    "If the user asks about reservations, say ANIMUA does not guarantee pet reservations through chat; they should submit an adoption application from the animal profile if available.",
    "For the Match Quiz process, tell users to sign in to a Public account, open Match Quiz, choose English or Tagalog, set their pet filters, answer all five sections honestly, submit, and view the ranked compatibility results saved to their account.",
    "A completed Match Quiz starts the configured retake cooldown (30 days by default, although the current system setting may differ). The old result remains in account history, and the next completed attempt becomes the current result.",
    "Never invent a user's retake date. If verified quiz eligibility context is unavailable, explain the configured cooldown and tell the user to sign in and check Match Quiz or My Submissions for the exact Next allowed retake date. The quiz may also be paused or have an account-specific retake date.",
    "If the user asks in Tagalog or Taglish, answer in natural Tagalog or Taglish. If the selected language is English, answer in English even if the user writes Taglish.",
    `Ready animals shown publicly right now: ${context.pets?.length ? context.pets.map(formatPet).join("; ") : "No live animal list available in context."}`,
    `Published or recent events in context: ${context.events?.length ? context.events.map(formatEvent).join("; ") : "No event list available in context."}`
  ].join("\n");
}

function getLocalReply(message, context = {}, language = "english") {
  const lower = normalizeIntentText(message);
  const pets = Array.isArray(context.pets) ? context.pets : [];
  const events = Array.isArray(context.events) ? context.events : [];
  const userAdoptions = Array.isArray(context.userAdoptions) ? context.userAdoptions : [];
  const quizContext = context.quiz || getEmptyQuizContext();

  if (hasGreetingIntent(lower)) {
    return localizedReply(
      language,
      "Hello! I can help with ANIMUA adoption, Find Furbabies, the Match Quiz, surrender requests, events, account help, and contact information. What would you like to ask?",
      "Kumusta! Makakatulong ako sa ANIMUA adoption, Find Furbabies, Match Quiz, surrender requests, events, account help, at contact information. Ano ang gusto mong itanong?"
    );
  }

  if (hasThanksIntent(lower)) {
    return localizedReply(
      language,
      "You're welcome. You can ask me anytime about adoption, available animals, surrender requests, events, or account help.",
      "Walang anuman. Maaari mo akong tanungin tungkol sa adoption, available animals, surrender requests, events, o account help."
    );
  }

  if (hasGoodbyeIntent(lower)) {
    return localizedReply(
      language,
      "Goodbye. You can return anytime if you need help with ANIMUA services or office guidance.",
      "Paalam. Maaari kang bumalik anumang oras kung kailangan mo ng tulong tungkol sa ANIMUA services o office guidance."
    );
  }

  if (hasAssistantHelpIntent(lower)) {
    return localizedReply(
      language,
      "I am the ANIMUA Assistant, a virtual front desk for the Angeles City Veterinary Office adoption system. I can guide you on adoption, Find Furbabies, the Match Quiz, surrender requests, events, account help, donations, stray concerns, contact details, and basic pet-care reminders.",
      "Ako ang ANIMUA Assistant, virtual front desk para sa adoption system ng Angeles City Veterinary Office. Makakatulong ako sa adoption, Find Furbabies, Match Quiz, surrender requests, events, account help, donations, stray concerns, contact details, at basic pet-care reminders."
    );
  }

  if (includesAnyPhrase(lower, ["what does rescued mean", "what is rescued", "rescued mean", "meaning of rescued"])) {
    return localizedReply(
      language,
      "Rescued means the animal was helped or brought into care because of a welfare concern, unsafe situation, or similar case. It may need assessment, treatment, or clearance before becoming available for adoption.",
      "Ang rescued ay ibig sabihin natulungan o nailagay sa care ang animal dahil sa welfare concern, unsafe situation, o katulad na kaso. Maaaring kailangan muna ng assessment, treatment, o clearance bago maging available for adoption."
    );
  }

  if (hasUrgentMedicalIntent(lower)) {
    return localizedReply(
      language,
      `This may be an animal health emergency. Please contact ${OFFICE_INFO.name} or the nearest licensed veterinarian immediately. I can guide ANIMUA navigation, but I cannot diagnose, prescribe medicine, give dosage, or replace emergency veterinary care.`,
      `Maaaring emergency ito sa kalusugan ng animal. Makipag-ugnayan agad sa ${OFFICE_INFO.name} o sa pinakamalapit na licensed veterinarian. Makakatulong ako sa ANIMUA navigation, pero hindi ako makakapag-diagnose, magreseta, magbigay ng dosage, o pumalit sa emergency veterinary care.`
    );
  }

  if (hasLostPetIntent(lower)) {
    return localizedReply(
      language,
      `For a lost pet, ANIMUA does not have a lost-pet posting or tracking feature. Please contact or visit the Angeles City Dog Pound and ${OFFICE_INFO.name}, and prepare clear photos, last-seen location, date and time, color or markings, collar or tag details, and your contact number.`,
      `Para sa nawawalang pet, walang lost-pet posting o tracking feature ang ANIMUA. Makipag-ugnayan o bumisita sa Angeles City Dog Pound at ${OFFICE_INFO.name}, at maghanda ng malinaw na photos, last-seen location, date at time, kulay o markings, collar o tag details, at contact number mo.`
    );
  }

  if (hasStrayIntent(lower)) {
    return localizedReply(
      language,
      "Please message the staff through Contact Us for assistance with the stray animal.",
      "Paki-message ang staff sa Contact Us para sa tulong sa stray animal."
    );
  }

  if (hasDonationIntent(lower)) {
    return localizedReply(
      language,
      `For dog food, cat food, or other donations, please message the staff through Contact Us so they can coordinate current needs, drop-off details, and official procedures. ANIMUA does not process donation payments through chat.`,
      `Para sa dog food, cat food, o ibang donations, paki-message ang staff sa Contact Us para ma-coordinate ang current needs, drop-off details, at official procedures. Hindi nagpo-process ang ANIMUA ng donation payments sa chat.`
    );
  }

  if (hasGeneralAnimuaIntent(lower)) {
    return localizedReply(
      language,
      "ANIMUA means Animal Unified Approach. It is one system for shelter operations and public services under the Angeles City Veterinary Office, including adoption, Find Furbabies, the Match Quiz, surrender requests, events, and account access from mobile or desktop.",
      "Ang ANIMUA ay nangangahulugang Animal Unified Approach. Isa itong system para sa shelter operations at public services ng Angeles City Veterinary Office, tulad ng adoption, Find Furbabies, Match Quiz, surrender requests, events, at account access gamit ang mobile o desktop."
    );
  }

  if (hasPublicAccountLimitIntent(lower)) {
    return localizedReply(
      language,
      "You can browse public ANIMUA pages without signing in, such as Home, Find Furbabies, Surrender information, and Contact Us. To take the Match Quiz, submit an adoption application or surrender request, view My Applications, see private status updates, or manage pickup schedules, you need to sign in or create an account. These actions require a Public account.",
      "Maaari mong tingnan ang public ANIMUA pages kahit hindi naka-sign in, tulad ng Home, Find Furbabies, Surrender information, at Contact Us. Para sagutan ang Match Quiz, mag-submit ng adoption application o surrender request, makita ang My Applications at private status updates, o i-manage ang pickup schedules, kailangan mong mag-sign in o gumawa ng Public account."
    );
  }

  if (hasSurrenderAppointmentRescheduleIntent(lower)) {
    return localizedReply(
      language,
      hasBlockedRescheduleQuestion(lower)
        ? "You may have used your one surrender reschedule. Reschedule also requires an approved request and an existing appointment. Check My Submissions to see the reason."
        : "You can change an approved surrender appointment once. Go to My Submissions and select Reschedule. Choose a date within your 14-day deadline. Follow the old schedule until the change is accepted.",
      hasBlockedRescheduleQuestion(lower)
        ? "Baka nagamit mo na ang isang surrender reschedule. Kailangan ding approved ang request at may existing appointment. Tingnan ang My Submissions para makita ang dahilan."
        : "Isang beses puwedeng baguhin ang approved surrender appointment. Pumunta sa My Submissions at piliin ang Reschedule. Pumili ng date na pasok sa 14-day deadline. Sundin muna ang dating schedule hangga't hindi accepted ang pagbabago."
    );
  }

  if (hasGeneralRescheduleIntent(lower)) {
    return localizedReply(
      language,
      hasBlockedRescheduleQuestion(lower)
        ? "You may have reached the reschedule limit. Adoption pickup: 1 change. Surrender appointment: 1 change. Check My Applications or My Submissions for your current schedule."
        : "Yes. You can change an adoption pickup once or a surrender appointment once. Use My Applications or My Submissions to reschedule.",
      hasBlockedRescheduleQuestion(lower)
        ? "Baka naabot mo na ang reschedule limit. Adoption pickup: 1 change. Surrender appointment: 1 change lang. Tingnan ang My Applications o My Submissions para sa current schedule mo."
        : "Oo. Isang beses puwedeng baguhin ang adoption pickup at surrender appointment. Gamitin ang My Applications o My Submissions para mag-reschedule."
    );
  }

  if (hasSurrenderIntent(lower)) {
    if (hasOutsideAngelesIntent(lower)) {
      return localizedReply(
        language,
        "No. ANIMUA surrender requests are only for qualified Angeles City residents. If you live in another city or municipality, contact your local city or municipal veterinary office.",
        "Hindi. Para lang sa qualified Angeles City residents ang ANIMUA surrender requests. Kung taga-ibang lungsod o munisipyo ka, kontakin ang local city o municipal veterinary office."
      );
    }

    if (hasSurrenderAvailabilityIntent(lower)) {
      return localizedReply(
        language,
        "Only qualified Angeles City residents may submit surrender requests through ANIMUA. If the Surrender page shows that requests are paused or the shelter is not accepting new requests, please contact the Angeles City Veterinary Office for guidance instead of bringing the animal directly to the shelter.",
        "Qualified Angeles City residents lang ang maaaring magsumite ng surrender request sa ANIMUA. Kung naka-pause o hindi tumatanggap ng new requests ang Surrender page, kontakin muna ang Angeles City Veterinary Office para sa guidance sa halip na dalhin agad ang animal sa shelter."
      );
    }

    if (hasSurrenderCareIntent(lower)) {
      return localizedReply(
        language,
        "Yes. Once your surrender request is approved and your pet is accepted, the shelter team will do their best to care for your pet and keep them safe. Submit the Surrender form and wait for official confirmation before bringing your pet to the shelter.",
        "Oo. Kapag approved ang surrender request at tinanggap ang pet mo, gagawin ng shelter team ang kanilang makakaya para maalagaan at mapanatiling ligtas ang pet mo. Isumite ang Surrender form at hintayin ang official confirmation bago dalhin ang pet sa shelter."
      );
    }

    if (hasSurrenderAppointmentIntent(lower)) {
      return localizedReply(
        language,
        "No. Do not walk in or bring the animal for surrender unless the Angeles City Veterinary Office has approved the surrender request and given appointment or drop-off instructions. Submit the Surrender form first, then wait for the official next step.",
        "Hindi. Huwag mag-walk in o dalhin ang animal for surrender hangga't hindi approved ng Angeles City Veterinary Office ang surrender request at wala pang appointment o drop-off instructions. Mag-submit muna sa Surrender form, pagkatapos hintayin ang official next step."
      );
    }

    if (hasSurrenderDocumentIntent(lower)) {
      return localizedReply(
        language,
        "For a surrender request, prepare accurate owner and contact details, Angeles City barangay/address information, animal details, vaccination or medical records if available, photos or supporting details, and an honest reason for surrender. The office still reviews every request, so submission is not automatic acceptance.",
        "Para sa surrender request, ihanda ang tamang owner at contact details, Angeles City barangay/address information, animal details, vaccination o medical records kung meron, photos o supporting details, at tapat na reason for surrender. Ire-review pa rin ng office ang bawat request, kaya hindi automatic acceptance ang submission."
      );
    }

    if (hasSurrenderThenAdoptIntent(lower)) {
      return localizedReply(
        language,
        "Surrendering an animal does not automatically ban you from adopting later, but surrender and adoption are reviewed as separate matters. A surrender request must be truthful and is not guaranteed to be accepted. A future adoption application is also not guaranteed; the Angeles City Veterinary Office may review your history, reason for surrender, current readiness, home setup, and the animal's welfare needs before deciding. If you are not ready to keep a pet long-term, it is better to wait before applying again.",
        "Ang pag-surrender ng animal ay hindi automatic na ban sa future adoption, pero hiwalay na nire-review ang surrender at adoption. Kailangang totoo ang surrender reason at hindi garantiya na maa-accept ang request. Hindi rin guaranteed ang future adoption application; maaaring i-review ng Angeles City Veterinary Office ang history mo, reason ng surrender, current readiness, home setup, at welfare needs ng animal bago magdesisyon. Kung hindi ka pa ready mag-alaga long-term, mas mabuting maghintay muna bago mag-apply ulit."
      );
    }

    if (hasSurrenderConsequenceIntent(lower)) {
      return localizedReply(
        language,
        "Submitting an honest surrender request does not automatically blacklist or ban you from ANIMUA. However, the Angeles City Veterinary Office may review the reason for surrender, the animal's welfare, your previous records, and any false information, abandonment, or misuse before deciding on current or future requests. Use the Surrender page and wait for official instructions before bringing the animal to the shelter.",
        "Ang pagsumite ng tapat na surrender request ay hindi automatic na blacklist o ban sa ANIMUA. Pero maaaring i-review ng Angeles City Veterinary Office ang reason ng surrender, welfare ng animal, previous records, at anumang false information, abandonment, o misuse bago magdesisyon sa current o future requests. Gamitin ang Surrender page at hintayin ang official instructions bago dalhin ang animal sa shelter."
      );
    }

    if (hasAdoptedAnimalSurrenderIntent(lower)) {
      const animalLabel = getMentionedAnimalLabel(lower, language);

      return localizedReply(
        language,
        `Yes, if you can no longer care for a ${animalLabel} you adopted through ANIMUA, you may submit a surrender request through the Surrender page, but only if you are a qualified Angeles City resident. Explain that the ${animalLabel} was previously adopted, give the reason honestly, and provide complete owner, contact, barangay, animal, vaccination, and supporting details. The Angeles City Veterinary Office will review the case, so submission does not guarantee acceptance. Please do not abandon the ${animalLabel} or bring it to the shelter unless the office confirms the next step.`,
        `Oo, kung hindi mo na kayang alagaan ang ${animalLabel} na na-adopt mo through ANIMUA, maaari kang magsumite ng surrender request sa Surrender page kung qualified Angeles City resident ka. Ilagay na previously adopted ang ${animalLabel}, ipaliwanag nang tapat ang reason, at kumpletuhin ang owner, contact, barangay, animal, vaccination, at supporting details. Ire-review pa rin ng Angeles City Veterinary Office ang case, kaya hindi garantiya ng acceptance ang submission. Huwag iwan o dalhin agad ang ${animalLabel} sa shelter hangga't walang confirmation mula sa office.`
      );
    }

    if (includesAnyWord(lower, ["afford", "financial", "hardship"]) || includesAnyPhrase(lower, ["no longer afford", "cannot afford", "can't afford", "cant afford", "financial hardship"])) {
      return localizedReply(
        language,
        "If you can no longer afford to care for your dog, you may submit a surrender request through the Surrender page if you are a qualified Angeles City resident. Explain the financial hardship and provide accurate owner, contact, barangay, animal, vaccination, and reason details. The request will still be reviewed by the Angeles City Veterinary Office, so submission does not guarantee acceptance. Please do not bring the dog to the shelter unless the office confirms the next step.",
        "Kung hindi mo na kayang tustusan ang pag-aalaga sa dog mo, maaari kang magsumite ng surrender request sa Surrender page kung qualified Angeles City resident ka. Ipaliwanag ang financial hardship at ilagay ang tamang owner, contact, barangay, animal, vaccination, at reason details. Ire-review pa rin ito ng Angeles City Veterinary Office, kaya hindi garantiya ng acceptance ang submission. Huwag dalhin ang dog sa shelter hangga't walang confirmation mula sa office."
      );
    }

    if (hasStatusIntent(lower) || includesAnyWord(lower, ["cancel", "cancelled", "canceled"])) {
      return localizedReply(
        language,
        "For surrender request status or cancellation, sign in and check the surrender request area shown by ANIMUA, or contact the Angeles City Veterinary Office for official updates. A request may be Pending, Under Review, Approved, Rejected, Cancelled, or Completed. Approval may lead to a shelter intake record, but the office decides the final action.",
        "Para sa surrender request status o cancellation, mag-sign in at tingnan ang surrender request area sa ANIMUA, o kontakin ang Angeles City Veterinary Office para sa official updates. Maaaring Pending, Under Review, Approved, Rejected, Cancelled, o Completed ang request. Kapag approved, maaari itong maging shelter intake record, pero office pa rin ang magdedesisyon ng final action."
      );
    }

    return localizedReply(
      language,
      "For surrender requests, open the Surrender page and complete the form with accurate owner, contact, barangay, animal, vaccination, and reason details. Only qualified Angeles City residents may submit through ANIMUA. Each request is reviewed individually, and submission does not guarantee acceptance. Do not bring the animal to the shelter unless the office confirms the next step.",
      "Para sa surrender request, buksan ang Surrender page at kumpletuhin ang owner, contact, barangay, animal, vaccination, at reason details. Qualified Angeles City residents lang ang maaaring magsumite sa ANIMUA. Bawat request ay hiwalay na nire-review, at hindi garantiya ng acceptance ang submission. Huwag dalhin agad ang animal sa shelter hangga't walang confirmation mula sa office."
    );
  }

  if (hasAdoptionHomePreparationIntent(lower)) {
    return localizedReply(
      language,
      "Before bringing an adopted pet home, prepare food and clean water, a safe sleeping area, basic hygiene supplies, a collar or carrier if needed, time for adjustment, and a plan for veterinary care. Keep the first days calm and follow any care notes shown in the animal profile or given by the office.",
      "Bago iuwi ang adopted pet, maghanda ng pagkain at malinis na tubig, ligtas na tulugan, basic hygiene supplies, collar o carrier kung kailangan, oras para maka-adjust, at plano para sa veterinary care. Panatilihing kalmado ang unang mga araw at sundin ang care notes sa animal profile o instructions ng office."
    );
  }

  if (hasAdoptionMotivationIntent(lower)) {
    return localizedReply(
      language,
      "Adopting is worth considering because you give a shelter animal a safer home, free up space so the office can care for more animals, and gain a companion whose needs match your lifestyle. Through ANIMUA, you can check Find Furbabies, use the Match Quiz, and submit an application with no adoption fee. The best reason to adopt is not just that it feels kind, but that you are ready to give steady care, time, patience, and a long-term home.",
      "Maganda mag-adopt kung ready ka na, kasi nabibigyan mo ng mas ligtas na tahanan ang shelter animal, nakakatulong ka rin na magkaroon ng space para maalagaan pa ang ibang animals, at maaari kang makahanap ng companion na tugma sa lifestyle mo. Sa ANIMUA, puwede mong tingnan ang Find Furbabies, gamitin ang Match Quiz, at mag-submit ng application nang walang adoption fee. Pinakamahalaga: mag-adopt kapag kaya mong magbigay ng consistent na care, oras, pasensya, at long-term home."
    );
  }

  if (hasAdoptionFeeIntent(lower) || hasFeeIntent(lower)) {
    return localizedReply(
      language,
      "Adopting dogs or cats through ANIMUA is free; there is no adoption fee. You still need to submit an adoption application, and the Angeles City Veterinary Office reviews every application before approval.",
      "Walang bayad ang pag-adopt ng aso o pusa through ANIMUA; walang adoption fee. Kailangan pa ring magsumite ng adoption application, at ire-review muna ng Angeles City Veterinary Office bago ma-approve."
    );
  }

  if (hasOfflineAdoptionIntent(lower)) {
    return localizedReply(
      language,
      "ANIMUA adoption applications are submitted online through Find Furbabies. If you want offline or in-person adoption assistance, please contact or visit the Angeles City Veterinary Office first to confirm the official procedure and requirements. Do not assume walk-in adoption is available unless the office confirms it. Adoption through ANIMUA has no adoption fee, and final approval still belongs to the office.",
      "Ang adoption applications sa ANIMUA ay isinusumite online through Find Furbabies. Kung gusto mo ng offline o in-person adoption assistance, makipag-ugnayan o bumisita muna sa Angeles City Veterinary Office para kumpirmahin ang opisyal na proseso at requirements. Huwag mag-assume na available ang walk-in adoption hangga't hindi kinukumpirma ng office. Walang adoption fee sa ANIMUA, at office pa rin ang final approval."
    );
  }

  if (hasQuizIntent(lower)) {
    if (hasQuizAccuracyIntent(lower) && !hasQuizRetakeIntent(lower)) {
      return localizedReply(
        language,
        "The Match Quiz gives compatibility suggestions based on your answers and available animal data. Use it as a guide only; it does not guarantee approval or availability. The Angeles City Veterinary Office still makes the final decision.",
        "Ang Match Quiz ay nagbibigay ng compatibility suggestions batay sa sagot mo at available animal data. Guide lang ito; hindi nito ginagarantiya ang approval o availability. Angeles City Veterinary Office pa rin ang final decision."
      );
    }

    const cooldownDays = Number.isInteger(quizContext.retakeCooldownDays)
      ? quizContext.retakeCooldownDays
      : 30;
    const nextRetakeDate = formatQuizDate(quizContext.nextRetakeAt, language);
    let retakeGuidance;

    if (quizContext.quizEnabled === false) {
      retakeGuidance = localizedReply(
        language,
        quizContext.hasPreviousResult
          ? "The Match Quiz is temporarily paused by the shelter. Your saved result remains in your account; check Match Quiz again later for availability."
          : "The Match Quiz is temporarily paused by the shelter. Check Match Quiz again later for availability.",
        quizContext.hasPreviousResult
          ? "Pansamantalang naka-pause ng shelter ang Match Quiz. Nasa account mo pa rin ang saved result; tingnan muli ang Match Quiz later kung available na."
          : "Pansamantalang naka-pause ng shelter ang Match Quiz. Tingnan muli ang Match Quiz later kung available na."
      );
    } else if (quizContext.authenticated && !quizContext.hasPreviousResult) {
      retakeGuidance = localizedReply(
        language,
        "You can take your first Match Quiz now. Open Match Quiz to begin.",
        "Maaari mong sagutan ang first Match Quiz mo ngayon. Buksan ang Match Quiz para magsimula."
      );
    } else if (quizContext.authenticated && quizContext.hasPreviousResult && quizContext.canTakeQuiz) {
      retakeGuidance = localizedReply(
        language,
        "You can retake the Match Quiz now. Open Match Quiz to begin; your previous result will remain in your account history.",
        "Maaari mo nang ulitin ang Match Quiz ngayon. Buksan ang Match Quiz para magsimula; mananatili sa account history ang previous result mo."
      );
    } else if (quizContext.authenticated && quizContext.hasPreviousResult && nextRetakeDate) {
      const daysText = quizContext.remainingDays > 0
        ? localizedReply(
            language,
            `, about ${quizContext.remainingDays} day${quizContext.remainingDays === 1 ? "" : "s"} from now`,
            `, humigit-kumulang ${quizContext.remainingDays} araw mula ngayon`
          )
        : "";
      retakeGuidance = localizedReply(
        language,
        `You can retake the Match Quiz on ${nextRetakeDate}${daysText}. Open Match Quiz on or after that date to begin.`,
        `Maaari mong ulitin ang Match Quiz sa ${nextRetakeDate}${daysText}. Buksan ang Match Quiz sa araw na iyon o pagkatapos nito.`
      );
    } else {
      retakeGuidance = localizedReply(
        language,
        `The usual Match Quiz retake wait is ${cooldownDays} day${cooldownDays === 1 ? "" : "s"}. Sign in and check Next allowed retake in Match Quiz for your exact date.`,
        `Ang karaniwang hintayan bago ulitin ang Match Quiz ay ${cooldownDays} araw. Mag-sign in at tingnan ang Next allowed retake sa Match Quiz para sa eksaktong date.`
      );
    }

    if (hasQuizRetakeIntent(lower)) {
      return retakeGuidance;
    }

    return localizedReply(
      language,
      `Sign in, open Match Quiz, set your preferences, and answer all five sections. Retakes normally require a ${cooldownDays}-day wait; check Next allowed retake in Match Quiz for your date.`,
      `Mag-sign in, buksan ang Match Quiz, itakda ang preferences, at sagutan ang limang sections. Karaniwang may ${cooldownDays}-day wait bago mag-retake; tingnan ang Next allowed retake sa Match Quiz para sa date mo.`
    );
  }

  if (hasRequirementIntent(lower)) {
    return localizedReply(
      language,
      "Common adoption requirements are an ANIMUA account, complete and truthful application details, valid contact information, and a home setup suitable for the animal. Students, renters, families, and households with existing pets may apply, but the office reviews readiness, consent, living situation, and the animal's welfare needs before approval.",
      "Karaniwang kailangan sa adoption ang ANIMUA account, kumpleto at totoong application details, valid contact information, at home setup na angkop sa animal. Puwedeng mag-apply ang students, renters, families, at households na may existing pets, pero ire-review ng office ang readiness, consent, living situation, at welfare needs ng animal bago mag-approve."
    );
  }

  if (hasAgeRequirementIntent(lower)) {
    return localizedReply(
      language,
      "Adoption applications should be submitted by someone who can legally and responsibly commit to the animal's care. If you are a student, minor, or dependent on your household, include truthful household and guardian or family support details in the application. The Angeles City Veterinary Office reviews readiness and consent before approval.",
      "Ang adoption application ay dapat manggaling sa taong kayang legal at responsableng mag-commit sa pag-aalaga ng animal. Kung student, minor, o dependent ka sa household mo, ilagay nang tapat ang household at guardian o family support details sa application. Ire-review ng Angeles City Veterinary Office ang readiness at consent bago mag-approve."
    );
  }

  if (hasAdoptionEligibilityIntent(lower)) {
    return localizedReply(
      language,
      "Yes. Applicants from inside or outside Angeles City may submit an adoption application, but every application is evaluated by the Angeles City Veterinary Office. Students, renters, families, and people with existing pets should provide honest details about consent, housing, schedule, resources, and pet-care readiness.",
      "Oo. Maaaring magsumite ng adoption application ang applicants mula sa loob o labas ng Angeles City, pero bawat application ay ie-evaluate ng Angeles City Veterinary Office. Kung student, renter, family, o may existing pets, magbigay ng tapat na detalye tungkol sa consent, tirahan, schedule, kakayahan, at readiness sa pet care."
    );
  }

  if (hasReservationIntent(lower)) {
    return localizedReply(
      language,
      "ANIMUA does not guarantee pet reservations through chat. If an animal is available, open its Find Furbabies profile and submit an adoption application. The office reviews applications and animal availability can change, so applying or asking to reserve does not guarantee approval or holding the animal.",
      "Hindi naggagarantiya ang ANIMUA ng pet reservation through chat. Kung available ang animal, buksan ang profile nito sa Find Furbabies at magsumite ng adoption application. Ire-review pa rin ng office ang applications at maaaring magbago ang availability, kaya hindi garantiya ng approval o pag-hold ng animal ang pag-apply o pagpa-reserve."
    );
  }

  if (hasAnimalDetailsQuestionIntent(lower)) {
    return localizedReply(
      language,
      "Open the animal's profile in Find Furbabies to see the details available in ANIMUA, such as photos, species, age, sex, breed, temperament, behavior notes, medical or vaccination details, and care needs. If a detail is missing or unclear, contact the Angeles City Veterinary Office before applying.",
      "Buksan ang animal profile sa Find Furbabies para makita ang available details sa ANIMUA, tulad ng photos, species, age, sex, breed, temperament, behavior notes, medical o vaccination details, at care needs. Kung may kulang o hindi malinaw na detalye, kontakin ang Angeles City Veterinary Office bago mag-apply."
    );
  }

  if (hasVisitAnimalIntent(lower)) {
    return localizedReply(
      language,
      "To ask about visiting or meeting an animal, check the animal profile first and contact the Angeles City Veterinary Office for confirmation. Do not assume walk-in visits or meet-and-greets are available unless the office confirms them.",
      "Para magtanong tungkol sa pagbisita o pagkikita sa animal, tingnan muna ang animal profile at kontakin ang Angeles City Veterinary Office para sa confirmation. Huwag mag-assume na available ang walk-in visits o meet-and-greet hangga't hindi kinukumpirma ng office."
    );
  }

  if (hasAdoptionScheduleLocationIntent(lower)) {
    return localizedReply(
      language,
      "For adoption schedules and private application updates, sign in and open My Applications. Pickup dates, pickup requirements, reschedule options, and official next steps are shown there when the Angeles City Veterinary Office has added them.",
      "Para sa adoption schedules at private application updates, mag-sign in at buksan ang My Applications. Makikita doon ang pickup dates, pickup requirements, reschedule options, at official next steps kapag nailagay na ng Angeles City Veterinary Office."
    );
  }

  if (hasAdoptionPickupDocumentIntent(lower)) {
    return localizedReply(
      language,
      "You can see what to bring in your adoption application details in My Applications. Follow the documents and reminders shown there, such as valid ID, adoption agreement, and any office instructions. If you already have a pickup schedule, attend on that date and time.",
      "Makikita mo ang mga kailangan dalhin sa adoption application details sa My Applications. Sundin ang documents at reminders na nakalagay doon, tulad ng valid ID, adoption agreement, at anumang office instructions. Kung may pickup schedule ka na, pumunta sa nakatakdang date at time."
    );
  }

  if (hasPickupMissedIntent(lower)) {
    return localizedReply(
      language,
      "If you are late or missed your adoption pickup schedule, contact the Angeles City Veterinary Office as soon as possible and check My Applications for any available action. Do not assume the animal will still be released or that the schedule is automatically extended; the office must confirm the next step.",
      "Kung na-late ka o hindi ka nakapunta sa adoption pickup schedule, kontakin agad ang Angeles City Veterinary Office at tingnan ang My Applications kung may available action. Huwag mag-assume na ire-release pa rin ang animal o automatic na extended ang schedule; kailangan munang kumpirmahin ng office ang next step."
    );
  }

  if (hasAdoptionPickupRescheduleIntent(lower)) {
    const accountReply = getAdoptionRescheduleAccountReply(
      selectRelevantAdoption(userAdoptions),
      language
    );
    if (accountReply) return accountReply;

    return localizedReply(
      language,
      hasBlockedRescheduleQuestion(lower)
        ? "The Reschedule button may be unavailable because the adoption is not approved, there is no pickup schedule, or you already used your one change. Check My Applications to see the reason."
        : "You can change an approved adoption pickup once. Go to My Applications and select Reschedule. The valid change is saved immediately without admin approval and must be within your 14-day deadline. The new schedule is final. Your account will be disabled if that deadline passes without a confirmed pickup.",
      hasBlockedRescheduleQuestion(lower)
        ? "Maaaring walang Reschedule button dahil hindi approved ang adoption, wala pang pickup schedule, o nagamit mo na ang isang change. Tingnan ang My Applications para makita ang dahilan."
        : "Isang beses puwedeng baguhin ang approved adoption pickup. Pumunta sa My Applications at piliin ang Reschedule. Agad mase-save ang valid na pagbabago nang walang admin approval at dapat pasok ito sa 14-day deadline. Final ang bagong schedule. Made-disable ang account kapag lumampas ang deadline nang walang confirmed pickup."
    );
  }

  if (hasAdoptionPickupIntent(lower)) {
    if (userAdoptions.length) {
      return getScheduledPickupReply(selectRelevantAdoption(userAdoptions), language);
    }

    return localizedReply(
      language,
      "Sign in and open My Applications. Check whether your adoption application is Approved. If it is approved, open it and select Schedule Pickup to choose your pickup date and time. If it is not approved yet, wait for the official update because pickup scheduling is not available yet.",
      "Mag-sign in at buksan ang My Applications. Tingnan kung Approved ang adoption application mo. Kapag Approved, buksan ito at piliin ang Schedule Pickup para pumili ng pickup date at time. Kung hindi pa Approved, hintayin muna ang official update dahil hindi pa available ang pickup scheduling."
    );
  }

  if (hasAdoptionApprovalTimingIntent(lower)) {
    if (userAdoptions.length) {
      return getScheduledPickupReply(selectRelevantAdoption(userAdoptions), language);
    }

    return localizedReply(
      language,
      "There is no guaranteed approval time for adoption applications. The Angeles City Veterinary Office reviews each application based on your details, home readiness, and the animal's welfare needs. Sign in to ANIMUA to check official status updates, or contact the office if you need confirmation.",
      "Walang guaranteed na oras o araw kung kailan maa-approve ang adoption application. Nire-review ng Angeles City Veterinary Office ang bawat application batay sa iyong details, home readiness, at welfare needs ng animal. Mag-sign in sa ANIMUA para tingnan ang official status updates, o kontakin ang office kung kailangan mo ng confirmation."
    );
  }

  if (hasPostAdoptionIntent(lower)) {
    if (userAdoptions.length) {
      return getScheduledPickupReply(selectRelevantAdoption(userAdoptions), language);
    }

    return localizedReply(
      language,
      "After an adoption is approved, follow the official instructions shown in ANIMUA or provided by the Angeles City Veterinary Office. The office may give pickup, release, care, or post-adoption monitoring and follow-up instructions. Approval still comes from the office, and the chatbot cannot confirm private records or final decisions.",
      "Kapag approved ang adoption, sundin ang official instructions na ipinapakita sa ANIMUA o ibibigay ng Angeles City Veterinary Office. Maaaring may pickup, release, care, o post-adoption monitoring at follow-up instructions mula sa office. Office pa rin ang final approval, at hindi kayang kumpirmahin ng chatbot ang private records o final decisions."
    );
  }

  if (hasAdoptionQuantityIntent(lower)) {
    const animalLabel = getMentionedAnimalLabel(lower, language);

    return localizedReply(
      language,
      `You may apply for more than one pet. Open each ${animalLabel}'s profile in Find Furbabies and submit a separate adoption application for each ${animalLabel}. Then wait for the Angeles City Veterinary Office to review and approve each application; submission does not guarantee approval.`,
      `Maaari kang mag-apply para sa higit sa isang pet. Buksan ang profile ng bawat ${animalLabel} sa Find Furbabies at magsumite ng hiwalay na adoption application para sa bawat isa. Bawat application ay ire-review ng shelter o Angeles City Veterinary Office, kaya hintayin ang approval; hindi guaranteed ang approval ng bawat application.`
    );
  }

  if (hasApplicationEditIntent(lower)) {
    return localizedReply(
      language,
      "To correct or update an adoption application, sign in and open My Applications. Use any edit or action button shown by ANIMUA. If the application is already under review or there is no edit option, contact the Angeles City Veterinary Office and explain what needs to be corrected. Do not submit false or duplicate details just to replace a mistake.",
      "Para itama o i-update ang adoption application, mag-sign in at buksan ang My Applications. Gamitin ang edit o action button kung ipinapakita ng ANIMUA. Kung under review na ang application o walang edit option, kontakin ang Angeles City Veterinary Office at ipaliwanag kung ano ang kailangang itama. Huwag magsumite ng maling o duplicate details para lang palitan ang mistake."
    );
  }

  if (hasApplicationRejectedIntent(lower)) {
    return localizedReply(
      language,
      "If your adoption application was rejected or not approved, check My Applications for the official status or remarks. You may apply again for another animal if the system allows it, but approval is still not guaranteed. Improve the next application by giving truthful details about your home, schedule, resources, consent, and readiness for the animal's needs.",
      "Kung rejected o hindi na-approve ang adoption application mo, tingnan ang My Applications para sa official status o remarks. Maaari kang mag-apply ulit para sa ibang animal kung pinapayagan ng system, pero hindi pa rin guaranteed ang approval. Mas pagandahin ang next application sa pamamagitan ng tapat na details tungkol sa bahay, schedule, resources, consent, at readiness mo sa needs ng animal."
    );
  }

  if (hasApplicationWithdrawIntent(lower)) {
    return localizedReply(
      language,
      "ANIMUA does not have a cancel or withdraw option for adoption applications. If your application is approved, you must follow the 14-day attendance rule; your account will be disabled if the deadline passes without confirmed pickup attendance. Apply only when you are fully ready to adopt.",
      "Walang cancel o withdraw option ang ANIMUA para sa adoption applications. Kapag approved ang application mo, kailangan mong sundin ang 14-day attendance rule; made-disable ang account kapag lumampas ang deadline nang walang confirmed pickup. Mag-apply lamang kapag handa ka nang mag-adopt."
    );
  }

  if (hasApplicationIntent(lower)) {
    if (hasApplicationStatusIntent(lower)) {
      return localizedReply(
        language,
        "For adoption application status, sign in to your ANIMUA account and check the official updates shown in My Applications. The chatbot cannot access, approve, or confirm private application records.",
        "Para sa status ng adoption application, mag-sign in sa iyong ANIMUA account at tingnan ang official updates sa My Applications. Hindi kayang i-access, i-approve, o kumpirmahin ng chatbot ang private application records."
      );
    }

    if (hasMultipleIntent(lower)) {
      return localizedReply(
        language,
        "You may apply for more than one pet by submitting separate adoption applications. Each application will be reviewed by the shelter or Angeles City Veterinary Office, so applying for multiple pets does not guarantee approval.",
        "Maaari kang mag-apply para sa higit sa isang pet sa pamamagitan ng hiwalay na adoption applications. Bawat application ay ire-review ng shelter o Angeles City Veterinary Office, kaya hindi guaranteed ang approval kahit higit sa isang pet ang applyan."
      );
    }

    return localizedReply(
      language,
      "For adoption applications, open Find Furbabies, choose an animal, and submit the adoption form from that animal's profile. The Angeles City Veterinary Office reviews each application, so submission does not guarantee approval.",
      "Para sa adoption application, buksan ang Find Furbabies, pumili ng animal, at isumite ang adoption form mula sa profile nito. Nire-review ng Angeles City Veterinary Office ang bawat application, kaya hindi garantiya ng approval ang pagsumite."
    );
  }

  if (hasAdoptionProcessIntent(lower)) {
    return localizedReply(
      language,
      "To adopt a dog or cat through ANIMUA, go to Find Furbabies, open the animal's profile, review the details, then submit the adoption application from that profile. There is no adoption fee. The Angeles City Veterinary Office reviews your home readiness and the animal's welfare needs before approval, so submitting an application does not guarantee approval.",
      "Para mag-adopt ng aso o pusa through ANIMUA, pumunta sa Find Furbabies, buksan ang animal profile, basahin ang details, pagkatapos isumite ang adoption application mula sa profile na iyon. Walang adoption fee. Ire-review ng Angeles City Veterinary Office ang home readiness mo at welfare needs ng animal bago ang approval, kaya hindi garantiya ng approval ang submission."
    );
  }

  if (hasCheckupRequestIntent(lower)) {
    return localizedReply(
      language,
      "ANIMUA does not have a pet check-up booking feature in the system. Please message the staff through Contact Us or contact the Angeles City Veterinary Office directly so they can confirm if check-up service is available, what schedule to follow, and what details to bring. For urgent symptoms, contact a licensed veterinarian immediately.",
      "Walang pet check-up booking feature sa ANIMUA system. Paki-message ang staff sa Contact Us o direktang kontakin ang Angeles City Veterinary Office para makumpirma kung available ang check-up service, anong schedule ang susundin, at anong details ang kailangan dalhin. Kung urgent ang symptoms, agad na kumontak sa licensed veterinarian."
    );
  }

  if (hasPersonalPetVaccinationRequestIntent(lower)) {
    return localizedReply(
      language,
      "Please contact the shelter staff through Contact Us. They can confirm whether pet vaccination is available, the schedule and requirements, and where to bring your dog.",
      "Paki-contact ang shelter staff through Contact Us. Makukumpirma nila kung available ang pet vaccination, ang schedule at requirements, at kung saan dadalhin ang aso mo."
    );
  }

  if (hasAnimalAvailabilityIntent(lower)) {
    const { filters, pets: visiblePets } = filterPetsForMessage(pets, lower);
    const searchDescription = describeAnimalSearch(filters, language);

    if (!visiblePets.length) {
      if (language === "tagalog") {
        return searchDescription !== "animal"
          ? `Wala akong nakikitang Ready na ${searchDescription} sa live Find Furbabies list ngayon. Pakitingnan muli ang Find Furbabies mamaya o kontakin ang Angeles City Veterinary Office para sa updates.`
          : "Wala akong nakikitang ready animals sa live public list ngayon. Buksan ang Find Furbabies o kontakin ang Angeles City Veterinary Office para sa pinakabagong availability.";
      }

      return searchDescription !== "animal"
        ? `I do not see any Ready ${searchDescription}s in the live Find Furbabies list right now. Please check Find Furbabies again later or contact the Angeles City Veterinary Office for updates.`
        : "I cannot see ready animals in the live public list right now. Please open Find Furbabies or contact the Angeles City Veterinary Office for the latest availability.";
    }

    return language === "tagalog"
      ? [
          filters.color || filters.species
            ? `Narito ang animals sa Find Furbabies na tumutugma sa hinahanap mo (${searchDescription}):`
            : "Narito ang animals na kasalukuyang marked Ready sa ANIMUA:",
          ...visiblePets.slice(0, 5).map((pet) => `- ${formatPet(pet)}`),
          "Buksan ang Find Furbabies para makita ang photos, details, at adoption actions. Kailangan pa rin ng shelter review bago ma-approve ang adoption."
        ].join("\n")
      : [
          filters.color || filters.species
            ? `Here are Find Furbabies animals that match your search (${searchDescription}):`
            : `Here are animals currently marked Ready in ANIMUA:`,
          ...visiblePets.slice(0, 5).map((pet) => `- ${formatPet(pet)}`),
          "Open Find Furbabies to view photos, details, and adoption actions. Shelter review is still required before adoption approval."
        ].join("\n");
  }

  if (hasUserProfileIntent(lower)) {
    return localizedReply(
      language,
      "To edit your profile, sign in to your ANIMUA account and open the account or profile area shown by the system. Use only options currently available in ANIMUA. If an email or profile field cannot be changed there, contact the Angeles City Veterinary Office through Contact Us for guidance.",
      "Para i-edit ang profile mo, mag-sign in sa ANIMUA account at buksan ang account o profile area na ipinapakita ng system. Gamitin lang ang options na available sa ANIMUA. Kung hindi mabago ang email o profile field doon, kontakin ang Angeles City Veterinary Office sa Contact Us para sa guidance."
    );
  }

  if (hasAnimalProfileIntent(lower)) {
    if (includesAnyWord(lower, ["impounded"])) {
      return localizedReply(
        language,
        "Impounded means the animal was taken into official custody or care by the Angeles City animal welfare office or pound. Its availability can change while the office checks records, health, ownership, or next steps.",
        "Ang impounded ay ibig sabihin ang animal ay nasa official custody o care ng Angeles City animal welfare office o pound. Maaaring magbago ang availability nito habang chine-check ng office ang records, health, ownership, o next steps."
      );
    }

    if (includesAnyWord(lower, ["rescued"])) {
      return localizedReply(
        language,
        "Rescued means the animal was helped or brought into care because of a welfare concern, unsafe situation, or similar case. It may need assessment, treatment, or clearance before becoming available for adoption.",
        "Ang rescued ay ibig sabihin natulungan o nailagay sa care ang animal dahil sa welfare concern, unsafe situation, o katulad na kaso. Maaaring kailangan muna ng assessment, treatment, o clearance bago maging available for adoption."
      );
    }

    if (includesAnyWord(lower, ["surrendered"])) {
      return localizedReply(
        language,
        "Surrendered means an owner or caretaker turned over, or requested to turn over, an animal to the office. A surrendered animal is not automatically available for adoption; the office still reviews its records, health, and status.",
        "Ang surrendered ay ibig sabihin itinurn over, o nag-request mag-turn over, ang owner o caretaker ng animal sa office. Hindi automatic na available for adoption ang surrendered animal; chine-check pa rin ng office ang records, health, at status nito."
      );
    }

    if (includesAnyWord(lower, ["reserved", "unavailable", "adopted", "under-care"])) {
      return localizedReply(
        language,
        "That status means the animal may not be open for a new adoption application right now. It may already be adopted, reserved, unavailable, or under care. Please check Find Furbabies again later or contact the office for official confirmation.",
        "Ibig sabihin ng status na iyon, maaaring hindi open ang animal para sa bagong adoption application ngayon. Maaaring adopted, reserved, unavailable, o under care na ito. Pakitingnan muli ang Find Furbabies mamaya o kontakin ang office para sa official confirmation."
      );
    }

    return localizedReply(
      language,
      "Find Furbabies profiles may show details such as species, age, sex, breed, temperament, behavior notes, medical history, and care needs when those details are available. A pet may disappear or become unavailable if its status changes, such as adopted, reserved, unavailable, under care, surrendered, rescued, or impounded.",
      "Sa Find Furbabies profiles, maaaring makita ang species, age, sex, breed, temperament, behavior notes, medical history, at care needs kapag available ang details. Maaaring mawala o maging unavailable ang pet kung nagbago ang status nito, tulad ng adopted, reserved, unavailable, under care, surrendered, rescued, o impounded."
    );
  }

  if (hasAccountTroubleIntent(lower)) {
    return localizedReply(
      language,
      "For account issues, use the Login or Create Account flow shown in ANIMUA. If your OTP expired or was not received, wait for the resend timer, request a new OTP, and check Spam or Promotions. If the email is already registered, log in instead or use a different email. For password or profile changes, use only settings currently available in the system. Never share your OTP or password in chat.",
      "Para sa account issues, gamitin ang Login o Create Account flow sa ANIMUA. Kung expired o hindi dumating ang OTP, hintayin ang resend timer, humingi ng bagong OTP, at tingnan ang Spam o Promotions. Kung registered na ang email, mag-log in na lang o gumamit ng ibang email. Para sa password o profile changes, gamitin lang ang settings na available sa system. Huwag ibahagi ang OTP o password sa chat."
    );
  }

  if (hasAccountIntent(lower)) {
    return localizedReply(
      language,
      "For accounts: choose Login or Create Account, complete the required fields and CAPTCHA, then enter the email OTP sent to your inbox. Never share your OTP or password with anyone, including chat.",
      "Para sa account: piliin ang Login o Create Account, kumpletuhin ang required fields at CAPTCHA, pagkatapos ilagay ang email OTP na ipinadala sa inbox mo. Huwag ibahagi ang OTP o password kahit kanino, kahit sa chat."
    );
  }

  if (hasStatusExplanationIntent(lower)) {
    return localizedReply(
      language,
      "Common statuses are: Pending means submitted and waiting for review; Under Review means the office is evaluating it; Approved means the request passed review; Rejected means it was not accepted; Cancelled means it was withdrawn or stopped; Completed means the process has been finished. These statuses do not promise a processing time.",
      "Karaniwang statuses: Pending ibig sabihin submitted at naghihintay ng review; Under Review ibig sabihin sinusuri na ng office; Approved ibig sabihin pumasa sa review; Rejected ibig sabihin hindi tinanggap; Cancelled ibig sabihin na-withdraw o nahinto; Completed ibig sabihin tapos na ang process. Hindi nangangako ng processing time ang mga status na ito."
    );
  }

  if (hasTermsPrivacyIntent(lower)) {
    return localizedReply(
      language,
      "ANIMUA collects personal information for account management, compatibility matching, adoption processing, surrender processing, request updates, and service improvement. Users must provide accurate information, protect login credentials, and avoid impersonation or false adoption/surrender details. Please read the Terms and Privacy Notice for complete details.",
      "Nangongolekta ang ANIMUA ng personal information para sa account management, compatibility matching, adoption processing, surrender processing, request updates, at service improvement. Kailangang magbigay ng tamang impormasyon, protektahan ang login credentials, at iwasan ang impersonation o maling adoption/surrender details. Basahin ang Terms and Privacy Notice para sa buong detalye."
    );
  }

  if (hasEventIntent(lower)) {
    const mentionedBarangay = getMentionedBarangay(lower);

    if (mentionedBarangay && hasBarangayEventIntent(lower)) {
      const barangayEvents = events.filter((event) => eventMatchesBarangay(event, mentionedBarangay));
      const matchingEvents = hasVaccinationScheduleIntent(lower)
        ? getMatchingVaccinationEvents(barangayEvents, lower)
        : barangayEvents;

      if (!matchingEvents.length) {
        return localizedReply(
          language,
          `There is no published event announcement for Barangay ${mentionedBarangay.name} yet. Please check the Home page again later for official updates.`,
          `Wala pang published event announcement para sa Barangay ${mentionedBarangay.name}. Pakitingnan muli ang Home page para sa official updates.`
        );
      }

      return language === "tagalog"
        ? [
            `Narito ang published event para sa Barangay ${mentionedBarangay.name}:`,
            ...matchingEvents.slice(0, 3).map((event) => `- ${formatEvent(event)}`),
            "Tingnan ang Home page event section para sa buong detalye."
          ].join("\n")
        : [
            `Here is the published event for Barangay ${mentionedBarangay.name}:`,
            ...matchingEvents.slice(0, 3).map((event) => `- ${formatEvent(event)}`),
            "Check the Home page event section for full details."
          ].join("\n");
    }

    if (hasVaccinationScheduleIntent(lower)) {
      const matchingEvents = getMatchingVaccinationEvents(events, lower);

      if (matchingEvents.length) {
        return language === "tagalog"
          ? [
              "Oo. May nakikita akong vaccination event sa Home page events:",
              ...matchingEvents.slice(0, 3).map((event) => `- ${formatEvent(event)}`),
              asksFreeService(lower) && matchingEvents.every(eventMentionsFreeService)
                ? "Marked free/libre ito batay sa event details. Tingnan ang Home page event section para sa buong requirements at updates."
                : "Tingnan ang Home page event section para makumpirma ang buong details, requirements, at kung libre ang service."
            ].join("\n")
          : [
              "Yes. I can see this vaccination event in the Home page events:",
              ...matchingEvents.slice(0, 3).map((event) => `- ${formatEvent(event)}`),
              asksFreeService(lower) && matchingEvents.every(eventMentionsFreeService)
                ? "It is marked free based on the event details. Check the Home page event section for full requirements and updates."
                : "Check the Home page event section to confirm the full details, requirements, and whether the service is free."
            ].join("\n");
      }

      return localizedReply(
        language,
        "I do not see a published vaccination or free-vaccine event in the Home page events right now. Please check the Home page again later or contact the Angeles City Veterinary Office for official confirmation.",
        "Wala akong nakikitang published vaccination o free-vaccine event sa Home page events ngayon. Pakitingnan muli ang Home page mamaya o kontakin ang Angeles City Veterinary Office para sa official confirmation."
      );
    }

    if (!events.length) {
      return localizedReply(
        language,
        "Events are shown in the Home page event section. There are no published upcoming events available right now, so please check the Home page again later or contact the Angeles City Veterinary Office for official confirmation about dates, time, location, requirements, and whether a service is free.",
        "Makikita ang events sa Home page event section. Wala pang published upcoming events na available ngayon, kaya pakitingnan muli ang Home page mamaya o kontakin ang Angeles City Veterinary Office para sa official confirmation tungkol sa date, time, location, requirements, at kung libre ang service."
      );
    }

    if (hasNextEventIntent(lower)) {
      const nextEvent = events
        .slice()
        .sort((a, b) => getEventDateValue(a) - getEventDateValue(b))[0];

      return localizedReply(
        language,
        `The next published event I can see is ${formatEvent(nextEvent)}. Check the Home page event section for full details.`,
        `Ang susunod na published event na nakikita ko ay ${formatEvent(nextEvent)}. Tingnan ang Home page event section para sa buong detalye.`
      );
    }

    return language === "tagalog"
      ? [
          "Narito ang public events o announcements na nakikita ko:",
          ...events.slice(0, 4).map((event) => `- ${formatEvent(event)}`),
          "Tingnan ang Home page event section para sa buong detalye."
        ].join("\n")
      : [
          "Here are public events or announcements I can see:",
          ...events.slice(0, 4).map((event) => `- ${formatEvent(event)}`),
          "Check the Home page event section for full details."
        ].join("\n");
  }

  if (hasVetVisitScheduleIntent(lower)) {
    return localizedReply(
      language,
      `For visits to the vet office, please contact ${OFFICE_INFO.name} first so they can confirm the right day, time, and whether you need an appointment. The office details in ANIMUA are: ${OFFICE_INFO.address}; phone ${OFFICE_INFO.phone}; hours ${OFFICE_INFO.hours}.`,
      `Para sa pagpunta sa vet office, mas mabuting kontakin muna ang ${OFFICE_INFO.name} para makumpirma ang tamang araw, oras, at kung kailangan ng appointment. Details sa ANIMUA: ${OFFICE_INFO.address}; phone ${OFFICE_INFO.phone}; office hours ${OFFICE_INFO.hours}.`
    );
  }

  if (hasOfficeLocationIntent(lower)) {
    return localizedReply(
      language,
      `${OFFICE_INFO.name} is located at ${OFFICE_INFO.address}. It is inside the Angeles City Hall compound.`,
      `Ang ${OFFICE_INFO.name} ay matatagpuan sa ${OFFICE_INFO.address}. Nasa loob ito ng Angeles City Hall compound.`
    );
  }

  if (hasContactIntent(lower)) {
    return localizedReply(
      language,
      `For official help, use the Contact Us page or contact ${OFFICE_INFO.name}. Verified details in ANIMUA: ${OFFICE_INFO.address}; phone ${OFFICE_INFO.phone}; office hours ${OFFICE_INFO.hours}. I do not have a verified office email in the project, so please use the Contact Us page for any email option shown there.`,
      `Para sa official help, gamitin ang Contact Us page o direktang makipag-ugnayan sa ${OFFICE_INFO.name}. Verified details sa ANIMUA: ${OFFICE_INFO.address}; phone ${OFFICE_INFO.phone}; office hours ${OFFICE_INFO.hours}. Wala akong verified office email sa project, kaya gamitin ang Contact Us page para sa email option kung mayroon doon.`
    );
  }

  if (hasNavigationIntent(lower)) {
    return localizedReply(
      language,
      "Use the public navigation links: Home for highlights and events, Find Furbabies for adoptable animals and animal profiles, Match Quiz for compatibility guidance, Surrender for qualified Angeles City surrender requests, and Contact Us for office details. To track private application or request updates, sign in and check the relevant account area shown by the system.",
      "Gamitin ang public navigation links: Home para sa highlights at events, Find Furbabies para sa adoptable animals at animal profiles, Match Quiz para sa compatibility guidance, Surrender para sa qualified Angeles City surrender requests, at Contact Us para sa office details. Para i-track ang private application o request updates, mag-sign in at tingnan ang relevant account area na ipinapakita ng system."
    );
  }

  if (hasPetCareIntent(lower) && !hasEventIntent(lower)) {
    if (includesAnyWord(lower, ["quarantine"])) {
      return localizedReply(
        language,
        "Quarantine means keeping a new or possibly exposed animal separated for observation before mixing it with other pets. It helps monitor illness, stress, or behavior changes. Follow the Angeles City Veterinary Office or a licensed veterinarian for the exact quarantine period and health instructions.",
        "Ang quarantine ay paghihiwalay muna sa bagong animal o posibleng exposed na animal bago ito ihalo sa ibang pets. Nakakatulong ito para ma-monitor ang sakit, stress, o behavior changes. Sundin ang Angeles City Veterinary Office o licensed veterinarian para sa eksaktong tagal at health instructions."
      );
    }

    if (includesAnyWord(lower, ["spay", "spaying", "neuter", "neutering"])) {
      return localizedReply(
        language,
        "Spaying and neutering are veterinary procedures that prevent animals from reproducing and may help reduce some health and behavior risks. Ask the Angeles City Veterinary Office or a licensed veterinarian for suitability, timing, and after-care instructions.",
        "Ang spaying at neutering ay veterinary procedures para hindi na makapagparami ang animal at maaaring makatulong sa ilang health at behavior risks. Tanungin ang Angeles City Veterinary Office o licensed veterinarian tungkol sa suitability, tamang timing, at after-care instructions."
      );
    }

    if (hasVaccinationIntent(lower)) {
      return localizedReply(
        language,
        "For each adoptable dog or cat, check the animal profile in Find Furbabies for any vaccination or health details shown there. If the record is missing or unclear, contact the Angeles City Veterinary Office before adopting. I cannot guarantee that all animals are vaccinated or confirm private medical records from chat.",
        "Para sa bawat adoptable dog o cat, tingnan ang animal profile sa Find Furbabies kung may vaccination o health details na nakalagay. Kung kulang o hindi malinaw ang record, kontakin ang Angeles City Veterinary Office bago mag-adopt. Hindi ko magagarantiya na vaccinated lahat ng animals o makukumpirma ang private medical records sa chat."
      );
    }

    if (includesAnyWord(lower, ["deworming"])) {
      return localizedReply(
        language,
        "Deworming is a veterinary care step that helps control internal parasites. Ask the Angeles City Veterinary Office or a licensed veterinarian for the right product and schedule for the animal's age, weight, and health condition.",
        "Ang deworming ay veterinary care step para makatulong makontrol ang internal parasites. Magtanong sa Angeles City Veterinary Office o licensed veterinarian para sa tamang product at schedule ayon sa edad, timbang, at health condition ng animal."
      );
    }

    return localizedReply(
      language,
      "For basic pet care, prepare a safe home with food, clean water, shelter, exercise, hygiene, and time for adjustment. Follow vaccination, deworming, spay/neuter, quarantine, and behavior guidance from a licensed veterinarian or the office. I can give general reminders only, not diagnosis, medication, dosage, or treatment plans.",
      "Para sa basic pet care, maghanda ng ligtas na tahanan na may pagkain, malinis na tubig, shelter, exercise, hygiene, at oras para maka-adjust ang animal. Sundin ang vaccination, deworming, spay/neuter, quarantine, at behavior guidance mula sa licensed veterinarian o office. General reminders lang ang maibibigay ko, hindi diagnosis, gamot, dosage, o treatment plan."
    );
  }

  if (hasLiveCommunicationIntent(lower)) {
    return localizedReply(
      language,
      "I am not a live shelter employee, and ANIMUA does not provide staff live chat or video consultation. For direct communication, use verified channels on the Contact Us page, such as the office phone or in-person visit details.",
      "Hindi ako live shelter employee, at walang staff live chat o video consultation ang ANIMUA. Para sa direktang komunikasyon, gamitin ang verified channels sa Contact Us page, tulad ng office phone o in-person visit details."
    );
  }

  if (hasUrgentMedicalIntent(lower)) {
    return localizedReply(
      language,
      "For urgent animal health concerns, contact a licensed veterinarian or the Angeles City Veterinary Office directly. I can guide ANIMUA navigation, but I cannot diagnose animals or provide emergency medical instructions.",
      "Para sa urgent animal health concerns, direktang makipag-ugnayan sa licensed veterinarian o Angeles City Veterinary Office. Makakatulong ako sa ANIMUA navigation, pero hindi ako makakapag-diagnose o makakapagbigay ng emergency medical instructions."
    );
  }

  if (
    !hasAnimalAvailabilityIntent(lower) &&
    lower.includes("adopt") &&
    !includesAnyWord(lower, ["available", "adoptable", "furbaby", "furbabies"]) &&
    !includesAnyWord(lower, ["dog", "cat"])
  ) {
    return localizedReply(
      language,
      "To adopt, go to Find Furbabies, open an animal profile, review the care details, then submit the adoption application. The Angeles City Veterinary Office reviews every application, so submitting one does not guarantee approval.",
      "Para mag-adopt, pumunta sa Find Furbabies, buksan ang animal profile, basahin ang care details, pagkatapos isumite ang adoption application. Nire-review ng Angeles City Veterinary Office ang bawat application, kaya hindi garantiya ng approval ang pagsumite."
    );
  }

  return localizedReply(
    language,
    "I can help with ANIMUA registration, email verification, browsing adoptable animals, the Match Quiz, adoption applications, surrender requests, donations, stray concerns, events, basic pet-care reminders, and contact information. What would you like to do?",
    "Makakatulong ako sa ANIMUA registration, email verification, pag-browse ng adoptable animals, Match Quiz, adoption applications, surrender requests, donations, stray concerns, events, basic pet-care reminders, at contact information. Ano ang gusto mong gawin?"
  );
}

async function getOfficialFaqReply(req, message, language = "english") {
  if (!shouldUseLocalReply(message)) {
    return "";
  }

  const [context, userContext, quizContext] = await Promise.all([
    needsPublicContext(message)
      ? getPublicContextSafely("Context")
      : getEmptyPublicContext(),
    needsUserAdoptionContext(message)
      ? getMyAdoptionContextSafely(req)
      : { adoptions: [] },
    hasQuizIntent(normalizeIntentText(message))
      ? getQuizContextSafely(req)
      : getEmptyQuizContext()
  ]);

  return getLocalReply(message, {
    ...context,
    userAdoptions: userContext.adoptions,
    quiz: quizContext
  }, language);
}

async function requestProviderReply({ message, history, context, language }) {
  const messages = [
    { role: "system", content: buildSystemPrompt(context, language) },
    ...history,
    { role: "user", content: message }
  ];

  if (CHATBOT_PROVIDER === "gemini") {
    return requestGeminiReply(messages);
  }

  return requestOpenAIReply(messages);
}

async function requestOpenAIReply(messages) {
  if (OPENAI_API_URL.includes("/chat/completions")) {
    return requestChatCompletionsReply(messages);
  }

  return requestResponsesReply(messages);
}

function toGeminiContents(messages) {
  const systemMessage = messages.find((item) => item.role === "system")?.content || "";

  return messages
    .filter((item) => item.role !== "system")
    .map((item, index) => {
      const role = item.role === "assistant" ? "model" : "user";
      const text = index === 0 && systemMessage
        ? `${systemMessage}\n\nUser message: ${item.content}`
        : item.content;

      return {
        role,
        parts: [{ text }]
      };
    });
}

async function requestGeminiReply(messages) {
  const response = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY
    },
    body: JSON.stringify({
      contents: toGeminiContents(messages),
      generationConfig: {
        maxOutputTokens: 220,
        temperature: 0.35,
        thinkingConfig: {
          thinkingLevel: "minimal"
        }
      }
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error?.message || "Gemini provider request failed.");
  }

  return (data.candidates || [])
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => part.text || "")
    .join("")
    .trim();
}

async function requestResponsesReply(messages) {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: messages,
      max_output_tokens: 220,
      reasoning: {
        effort: "low"
      },
      text: {
        verbosity: "low"
      }
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error?.message || "Chatbot provider request failed.");
  }

  if (data.output_text) return data.output_text.trim();

  return (data.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("")
    .trim();
}

async function requestChatCompletionsReply(messages) {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.35,
      max_completion_tokens: 220
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error?.message || "Chatbot provider request failed.");
  }

  return data.choices?.[0]?.message?.content?.trim() || "";
}

exports.sendChatbotMessage = async (req, res) => {
  try {
    if (isRateLimited(req)) {
      return res.status(429).json({ message: "Please wait a moment before sending another message." });
    }

    const message = cleanMessage(req.body?.message || "");
    const history = cleanHistory(req.body?.history || []);
    const language = resolveReplyLanguage(req.body?.language || "", message);

    if (!message) {
      return res.status(400).json({ message: "Message is required." });
    }

    const guardReply = getGuardReply(message, language);
    if (guardReply) {
      return res.status(200).json({
        reply: guardReply,
        mode: "guard"
      });
    }

    const officialFaqReply = await getOfficialFaqReply(req, message, language);
    if (officialFaqReply) {
      return res.status(200).json({
        reply: officialFaqReply,
        mode: "local"
      });
    }

    const hasProviderKey = CHATBOT_PROVIDER === "gemini" ? Boolean(GEMINI_API_KEY) : Boolean(OPENAI_API_KEY);

    if (!hasProviderKey) {
      return res.status(200).json({
        reply: getLocalReply(message, getEmptyPublicContext(), language),
        mode: "local"
      });
    }

    const aiContext = await getPublicContextForAiSafely();

    const reply = await requestProviderReply({ message, history, context: aiContext, language }).catch((error) => {
      console.warn("[Chatbot AI Fallback]", error.message);
      return "";
    });

    return res.status(200).json({
      reply: reply || getLocalReply(message, aiContext, language),
      mode: reply ? CHATBOT_PROVIDER : "local"
    });
  } catch (error) {
    console.error("[Chatbot Error]", error.message);
    const language = resolveReplyLanguage(req.body?.language || "", req.body?.message || "");

    return res.status(200).json({
      reply: getVerifiedFallback(language),
      mode: "fallback"
    });
  }
};

exports._test = {
  buildSystemPrompt,
  getOfficialFaqReply,
  getLocalReply,
  getEmptyPublicContext,
  getEmptyQuizContext,
  getQuizContext,
  hasAdoptionProcessIntent,
  hasAnimalAvailabilityIntent,
  hasCheckupRequestIntent,
  hasAdoptionQuantityIntent,
  hasAdoptionApprovalTimingIntent,
  hasAdoptionHomePreparationIntent,
  hasAdoptionPickupIntent,
  hasAdoptionPickupDocumentIntent,
  hasAdoptionPickupRescheduleIntent,
  hasBlockedRescheduleQuestion,
  hasGeneralRescheduleIntent,
  hasSurrenderAppointmentRescheduleIntent,
  hasOutsideAngelesIntent,
  hasPetCareIntent,
  hasQuizIntent,
  hasQuizProcessIntent,
  hasQuizRetakeIntent,
  hasSurrenderAppointmentIntent,
  hasSurrenderAvailabilityIntent,
  hasSurrenderCareIntent,
  hasSurrenderDocumentIntent,
  hasVisitAnimalIntent,
  hasVaccinationScheduleIntent,
  hasPersonalPetVaccinationRequestIntent,
  getMentionedBarangay,
  hasBarangayEventIntent,
  hasNextEventIntent,
  hasVetVisitScheduleIntent,
  hasOfficeLocationIntent,
  normalizeEvent,
  normalizeAnnouncementEvent,
  isPublishedPublicEvent,
  deduplicatePublicEvents,
  getHomeFallbackUpcomingEvent,
  needsPublicContext,
  needsUserAdoptionContext,
  resolveReplyLanguage,
  shouldUseLocalReply
};
