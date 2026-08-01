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
const rateLimitStore = new Map();
let publicContextCache = {
  expiresAt: 0,
  data: null
};

const OFFICE_INFO = {
  name: "Angeles City Veterinary Office",
  address: "City Hall Building, Pulung Maragul, Angeles City",
  phone: "(045) 322-0485",
  hours: "Monday to Friday, 8:00 AM to 5:00 PM"
};

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
  const lower = String(text).toLowerCase();

  return includesAnyWord(lower, [
    "magkano",
    "bayad",
    "gastos",
    "presyo",
    "singil",
    "libre",
    "paano",
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
    "wala"
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
  const selectedLanguage = normalizeLanguage(value);
  if (selectedLanguage === "tagalog") return "tagalog";
  return hasTaglishSignal(message) ? "tagalog" : selectedLanguage;
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

  const [petsSnapshot, eventsSnapshot] = await Promise.all([
    db.collection("animals").where("status", "==", "Ready").limit(6).get(),
    db.collection("events").limit(4).get()
  ]);

  const pets = petsSnapshot.docs.map((doc) => normalizePet(doc.id, doc.data()));
  const events = eventsSnapshot.docs
    .map((doc) => normalizeEvent(doc.id, doc.data()))
    .filter((event) => !event.isArchived && !event.isDraft);

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
      age: pet.age
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
  return { pets: [], events: [] };
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
    source: pet.source || "",
    condition: pet.initialCondition || pet.conditionNotes || "",
    status: pet.status || "Ready"
  };
}

function normalizeEvent(id, event = {}) {
  const status = String(event.status || event.state || event.publishStatus || "").toLowerCase();

  return {
    id,
    title: event.title || event.name || "Shelter event",
    date: serializeDate(event.date || event.eventDate || event.startDate || event.startsAt || event.startAt),
    time: event.time || event.eventTime || event.startTime || "",
    location: event.location || event.venue || event.address || "",
    description: event.summary || event.shortDescription || event.description || "",
    isArchived: event.archived === true || event.isArchived === true || status.includes("archive"),
    isDraft:
      event.published === false ||
      event.isPublished === false ||
      status.includes("draft") ||
      status.includes("unpublish") ||
      status.includes("private")
  };
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

function formatPet(pet = {}) {
  const details = [
    pet.species,
    pet.breed,
    pet.sex,
    pet.age
  ].filter(Boolean);

  return `${pet.name}${details.length ? ` (${details.join(", ")})` : ""}`;
}

function formatEvent(event = {}) {
  const details = [
    formatDate(event.date),
    event.time,
    event.location
  ].filter(Boolean);

  return `${event.title}${details.length ? ` - ${details.join(", ")}` : ""}`;
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

function hasApplicationIntent(text = "") {
  return includesAnyWord(text, ["application", "applications", "apply", "applied", "submit", "submitted", "submitting"]);
}

function hasMultipleIntent(text = "") {
  return includesAnyWord(text, ["two", "2", "multiple", "many", "another", "several"]) ||
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
  const mentionsAnimuaService = includesAnyWord(text, [
    "animua",
    "adopt",
    "adoption",
    "surrender",
    "account",
    "otp",
    "pet",
    "pets",
    "animal",
    "animals",
    "dog",
    "cat",
    "furbabies",
    "match",
    "quiz",
    "donation",
    "stray",
    "event",
    "events",
    "contact",
    "office"
  ]);

  if (includesAnyPhrase(text, ["who are you", "what can you do", "ano ka"])) return true;
  if (includesAnyWord(text, ["assistant"])) return true;

  return includesAnyWord(text, ["help", "assist", "tulong"]) &&
    (tokens.length <= 3 || mentionsAnimuaService);
}

function hasStatusIntent(text = "") {
  return includesAnyWord(text, ["status", "check", "track", "view", "update", "updates", "pending", "approved", "rejected"]);
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
    includesAnyWord(text, ["adoption", "adopter", "iadopt", "aadopt", "ampon", "umampon"]) ||
    includesAnyPhrase(text, [
      "pag adopt",
      "mag adopt",
      "mag aadopt",
      "mag aadop",
      "pa adopt",
      "pag ampon"
    ]);
}

function hasAdoptionFeeIntent(text = "") {
  return hasFeeIntent(text) && (hasAdoptionMentionIntent(text) || hasAnimalMentionIntent(text));
}

function hasAdoptionMotivationIntent(text = "") {
  if (!hasAdoptionMentionIntent(text)) return false;

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
    "gcash",
    "bank",
    "card",
    "money",
    "donasyon"
  ]) || includesAnyPhrase(text, [
    "send money",
    "online payment",
    "in kind",
    "in-kind",
    "do you accept food",
    "donate food",
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
  const mentionsAnimal = hasAnimalMentionIntent(text) || includesAnyPhrase(text, ["find furbabies"]);
  if (!mentionsAnimal) return false;

  const tokens = getMessageTokens(text);
  const asksAvailability =
    includesAnyWord(text, ["available", "adoptable", "ready", "browse", "find", "show", "list", "view", "see", "want", "looking"]) ||
    includesAnyPhrase(text, ["find furbabies", "ready for adoption", "for adoption", "looking for"]);
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
    includesAnyPhrase(text, ["vaccination drive", "vaccination event", "upcoming vaccination", "adoption campaign", "community veterinary"]);
}

function hasContactIntent(text = "") {
  return includesAnyWord(text, ["contact", "office", "location", "address", "phone", "help", "hours", "saan", "oras", "tawag"]) ||
    includesAnyPhrase(text, ["office email", "contact email", "email address", "send an email"]);
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
    "isurrender",
    "isusurrender",
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
    includesAnyPhrase(text, [
      "not from angeles",
      "not from angeles city",
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
  ]);

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

function hasLiveCommunicationIntent(text = "") {
  return includesAnyWord(text, ["staff", "employee", "chat", "video", "consultation", "transfer"]) ||
    includesAnyPhrase(text, ["live chat", "video consult", "talk to staff", "transfer me"]);
}

function hasAnimalProfileIntent(text = "") {
  return includesAnyWord(text, ["profile", "temperament", "medical", "history", "behavior", "behaviour", "care", "breed", "age", "sex", "surrendered", "impounded", "reserved", "unavailable", "adopted", "under-care", "disappear", "disappeared", "missing"]) ||
    includesAnyPhrase(text, ["why disappeared", "why did a pet disappear", "why did pet disappear", "no longer appear", "what does rescued mean", "what does surrendered mean", "what does impounded mean"]);
}

function hasAdoptionQuantityIntent(text = "") {
  return (
    (text.includes("adopt") || includesAnyWord(text, ["application", "apply"])) &&
    (
      includesAnyWord(text, ["two", "2", "multiple", "several", "limit", "maximum", "max", "number", "ilan", "dami"]) ||
      includesAnyPhrase(text, ["how many", "more than one", "ilang pet", "ilang pets", "ilang aso", "ilang pusa"])
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
  return (
    text.includes("adopt") ||
    includesAnyWord(text, ["adoption", "adopter", "ampon", "umampon", "iadopt"]) ||
    includesAnyPhrase(text, ["i want a dog", "i want a cat", "i want a pet", "get a pet"])
  ) && (
    includesAnyWord(text, ["how", "guide", "process", "steps", "procedure", "start", "begin", "pwede", "pwedeng", "puwede", "puwedeng", "paano", "puppy", "kitten", "senior", "adult"]) ||
    includesAnyPhrase(text, ["how do i", "how can i", "can i adopt", "pwede ba", "puwede ba"])
  );
}

function hasPostAdoptionIntent(text = "") {
  const mentionsAdoption =
    text.includes("adopt") ||
    includesAnyWord(text, ["adoption", "adopter"]);

  return mentionsAdoption && (
    includesAnyWord(text, ["approved", "approval", "after", "monitoring", "followup", "follow-up"]) ||
    includesAnyPhrase(text, ["after approval", "after adoption", "post adoption", "post-adoption", "follow up", "what happens after"])
  );
}

function hasAdoptionEligibilityIntent(text = "") {
  return (
    text.includes("adopt") ||
    includesAnyWord(text, ["adopter", "application", "apply", "eligible", "qualify"])
  ) && (
    includesAnyWord(text, ["student", "students", "renter", "renters", "family", "families", "household", "outside", "existing", "resident", "nonresident", "angeles"]) ||
    includesAnyPhrase(text, ["outside angeles", "outside angeles city", "not from angeles", "existing pets", "may alaga", "nangungupahan"])
  );
}

function hasVisitAnimalIntent(text = "") {
  return (
    hasAnimalMentionIntent(text) ||
    text.includes("adopt")
  ) && (
    includesAnyWord(text, ["visit", "meet", "see", "appointment", "walk-in", "walkin"]) ||
    includesAnyPhrase(text, ["meet the animal", "visit the animal", "see the pet"])
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
    "browse"
  ];

  return includesAnyWord(message, topicWords) ||
    hasGreetingIntent(message) ||
    hasThanksIntent(message) ||
    hasGoodbyeIntent(message) ||
    hasStrayIntent(message) ||
    hasSurrenderIntent(message) ||
    hasDonationIntent(message) ||
    hasAccountTroubleIntent(message) ||
    hasStatusExplanationIntent(message) ||
    hasPetCareIntent(message) ||
    hasQuizIntent(message) ||
    hasTermsPrivacyIntent(message) ||
    hasAnimalProfileIntent(message) ||
    hasNavigationIntent(message) ||
    hasGeneralAnimuaIntent(message) ||
    hasAssistantHelpIntent(message) ||
    hasAdoptionMotivationIntent(message) ||
    includesAnyPhrase(message, ["log in", "sign in", "find furbabies", "match quiz", "contact us", "may sakit", "live chat"]);
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
  const lower = message.toLowerCase();

  return (
    hasGreetingIntent(lower) ||
    hasThanksIntent(lower) ||
    hasGoodbyeIntent(lower) ||
    hasAssistantHelpIntent(lower) ||
    hasStrayIntent(lower) ||
    hasDonationIntent(lower) ||
    hasGeneralAnimuaIntent(lower) ||
    hasApplicationIntent(lower) ||
    hasAdoptionMotivationIntent(lower) ||
    hasAdoptionFeeIntent(lower) ||
    hasOfflineAdoptionIntent(lower) ||
    hasPostAdoptionIntent(lower) ||
    hasAdoptionProcessIntent(lower) ||
    hasAdoptionEligibilityIntent(lower) ||
    hasVisitAnimalIntent(lower) ||
    hasRequirementIntent(lower) ||
    hasFeeIntent(lower) ||
    hasSurrenderIntent(lower) ||
    hasQuizIntent(lower) ||
    hasAccountTroubleIntent(lower) ||
    hasAccountIntent(lower) ||
    hasStatusExplanationIntent(lower) ||
    hasEventIntent(lower) ||
    hasContactIntent(lower) ||
    hasUrgentMedicalIntent(lower) ||
    hasNavigationIntent(lower) ||
    hasUserProfileIntent(lower) ||
    hasTermsPrivacyIntent(lower) ||
    hasPetCareIntent(lower) ||
    hasLiveCommunicationIntent(lower) ||
    hasAnimalProfileIntent(lower) ||
    hasAdoptionQuantityIntent(lower) ||
    hasAnimalAvailabilityIntent(lower) ||
    (lower.includes("adopt") && !includesAny(lower, ["why", "should", "best", "recommend", "compare"]))
  );
}

function needsPublicContext(message = "") {
  const lower = message.toLowerCase();

  if (
    hasStrayIntent(lower) ||
    hasDonationIntent(lower) ||
    hasUrgentMedicalIntent(lower) ||
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
    hasPetCareIntent(lower) ||
    hasTermsPrivacyIntent(lower) ||
    hasLiveCommunicationIntent(lower) ||
    hasAnimalProfileIntent(lower) ||
    hasNavigationIntent(lower)
  ) {
    return false;
  }

  return (
    hasAnimalAvailabilityIntent(lower) ||
    hasEventIntent(lower)
  );
}

function buildSystemPrompt(context = {}, language = "english") {
  return [
    "You are ANIMUA Assistant for the Angeles City Veterinary Office animal adoption system.",
    language === "tagalog"
      ? "Answer in natural Tagalog or Taglish. Keep official page names like Find Furbabies, Match Quiz, Surrender, and Contact Us in English."
      : "Answer in English.",
    "Help users with adoption browsing, compatibility matching, surrender requests, account registration, email OTP verification, login, and general shelter service navigation.",
    "ANIMUA means Animal Unified Approach. It is one system for shelter operations and public services managed through the Angeles City Veterinary Office. Never invent a different expansion of ANIMUA.",
    "Be concise, friendly, and practical. Use simple instructions and ask one follow-up question when needed.",
    "ANIMUA no longer has a stray animal reporting feature or stray reporting page. Never tell users to submit stray reports through ANIMUA. For stray or abandoned animals, direct users to the Angeles City Dog Pound or Angeles City Veterinary Office.",
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
    `Ready animals shown publicly right now: ${context.pets?.length ? context.pets.map(formatPet).join("; ") : "No live animal list available in context."}`,
    `Published or recent events in context: ${context.events?.length ? context.events.map(formatEvent).join("; ") : "No event list available in context."}`
  ].join("\n");
}

function getLocalReply(message, context = {}, language = "english") {
  const lower = message.toLowerCase();
  const pets = Array.isArray(context.pets) ? context.pets : [];
  const events = Array.isArray(context.events) ? context.events : [];

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

  if (hasStrayIntent(lower)) {
    return localizedReply(
      language,
      `ANIMUA no longer includes a stray animal reporting feature or stray reporting page. For stray, found, or abandoned animal concerns, please contact or visit the Angeles City Dog Pound or ${OFFICE_INFO.name} for official assistance.`,
      `Wala nang stray animal reporting feature o stray reporting page ang ANIMUA. Para sa stray, napulot, o abandoned animal concerns, makipag-ugnayan o bumisita sa Angeles City Dog Pound o ${OFFICE_INFO.name} para sa opisyal na tulong.`
    );
  }

  if (hasDonationIntent(lower)) {
    return localizedReply(
      language,
      `Donations may be coordinated with ${OFFICE_INFO.name}, but ANIMUA does not process online donation payments. Please do not send money through chat; there is no ANIMUA GCash, bank, card, or payment gateway here. For food, approved medicine, cleaning supplies, cages, towels, blankets, or monetary donations, contact the office first to confirm current needs and official procedures.`,
      `Maaaring i-coordinate ang donations sa ${OFFICE_INFO.name}, pero hindi nagpo-process ang ANIMUA ng online donation payments. Huwag magpadala ng pera sa chat; walang ANIMUA GCash, bank, card, o payment gateway dito. Para sa food, approved medicine, cleaning supplies, cages, towels, blankets, o monetary donations, kontakin muna ang office para sa current needs at official procedures.`
    );
  }

  if (hasGeneralAnimuaIntent(lower)) {
    return localizedReply(
      language,
      "ANIMUA means Animal Unified Approach. It is one system for shelter operations and public services under the Angeles City Veterinary Office, including adoption, Find Furbabies, the Match Quiz, surrender requests, events, and account access from mobile or desktop.",
      "Ang ANIMUA ay nangangahulugang Animal Unified Approach. Isa itong system para sa shelter operations at public services ng Angeles City Veterinary Office, tulad ng adoption, Find Furbabies, Match Quiz, surrender requests, events, at account access gamit ang mobile o desktop."
    );
  }

  if (hasSurrenderIntent(lower)) {
    if (hasOutsideAngelesIntent(lower)) {
      return localizedReply(
        language,
        "No. ANIMUA surrender requests are only for qualified Angeles City residents. If you are not from Angeles City, ANIMUA will not process the surrender request; please contact your local city or municipal veterinary office, animal welfare office, or nearest shelter for the correct procedure. Do not bring the animal to the Angeles City shelter unless the office confirms a next step.",
        "Hindi. Ang surrender requests sa ANIMUA ay para lamang sa qualified Angeles City residents. Kung hindi ka taga-Angeles City, hindi ipo-process ng ANIMUA ang surrender request; makipag-ugnayan sa inyong local city o municipal veterinary office, animal welfare office, o pinakamalapit na shelter para sa tamang proseso. Huwag dalhin ang animal sa Angeles City shelter hangga't walang confirmation mula sa office."
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
    return localizedReply(
      language,
      "The Match Quiz can give useful compatibility suggestions, but it is not a guaranteed or final measure of accuracy. Its result depends on your answers, available animal data, and the matching factors in ANIMUA. Use it as a guide only; it does not approve or reject an adoption, does not guarantee availability, and the Angeles City Veterinary Office still makes the final decision. If your preferred pet is not recommended, it may not match your answers or may no longer be available. You may retake the quiz if your situation or preferences changed.",
      "Makakatulong ang Match Quiz sa compatibility suggestions, pero hindi ito guaranteed o final measure ng accuracy. Nakadepende ang result sa sagot mo, available animal data, at matching factors sa ANIMUA. Gamitin ito bilang guide lang; hindi nito ina-approve o nire-reject ang adoption, hindi nito ginagarantiya ang availability, at Angeles City Veterinary Office pa rin ang final decision. Kung hindi lumabas ang preferred pet mo, maaaring hindi ito tugma sa sagot mo o hindi na available. Maaari mong ulitin ang quiz kung nagbago ang sitwasyon o preferences mo."
    );
  }

  if (hasRequirementIntent(lower)) {
    return localizedReply(
      language,
      "Common adoption requirements are an ANIMUA account, complete and truthful application details, valid contact information, and a home setup suitable for the animal. Students, renters, families, and households with existing pets may apply, but the office reviews readiness, consent, living situation, and the animal's welfare needs before approval.",
      "Karaniwang kailangan sa adoption ang ANIMUA account, kumpleto at totoong application details, valid contact information, at home setup na angkop sa animal. Puwedeng mag-apply ang students, renters, families, at households na may existing pets, pero ire-review ng office ang readiness, consent, living situation, at welfare needs ng animal bago mag-approve."
    );
  }

  if (hasAdoptionEligibilityIntent(lower)) {
    return localizedReply(
      language,
      "Applicants from inside or outside Angeles City may submit an adoption application, but every application is evaluated by the Angeles City Veterinary Office. Students, renters, families, and people with existing pets should provide honest details about consent, housing, schedule, resources, and pet-care readiness.",
      "Maaaring magsumite ng adoption application ang applicants mula sa loob o labas ng Angeles City, pero bawat application ay ie-evaluate ng Angeles City Veterinary Office. Kung student, renter, family, o may existing pets, magbigay ng tapat na detalye tungkol sa consent, tirahan, schedule, kakayahan, at readiness sa pet care."
    );
  }

  if (hasVisitAnimalIntent(lower)) {
    return localizedReply(
      language,
      "To ask about visiting or meeting an animal, check the animal profile first and contact the Angeles City Veterinary Office for confirmation. Do not assume walk-in visits or meet-and-greets are available unless the office confirms them.",
      "Para magtanong tungkol sa pagbisita o pagkikita sa animal, tingnan muna ang animal profile at kontakin ang Angeles City Veterinary Office para sa confirmation. Huwag mag-assume na available ang walk-in visits o meet-and-greet hangga't hindi kinukumpirma ng office."
    );
  }

  if (hasPostAdoptionIntent(lower)) {
    return localizedReply(
      language,
      "After an adoption is approved, follow the official instructions shown in ANIMUA or provided by the Angeles City Veterinary Office. The office may give pickup, release, care, or post-adoption monitoring and follow-up instructions. Approval still comes from the office, and the chatbot cannot confirm private records or final decisions.",
      "Kapag approved ang adoption, sundin ang official instructions na ipinapakita sa ANIMUA o ibibigay ng Angeles City Veterinary Office. Maaaring may pickup, release, care, o post-adoption monitoring at follow-up instructions mula sa office. Office pa rin ang final approval, at hindi kayang kumpirmahin ng chatbot ang private records o final decisions."
    );
  }

  if (hasApplicationIntent(lower)) {
    if (hasStatusIntent(lower) || includesAnyWord(lower, ["cancel", "cancelled", "canceled"])) {
      return localizedReply(
        language,
        "For adoption application status or cancellation, sign in to your ANIMUA account and check any official updates or actions shown in the system. If you do not see an option or update, contact the Angeles City Veterinary Office directly; the chatbot cannot access, cancel, approve, or confirm private application records.",
        "Para sa status o cancellation ng adoption application, mag-sign in sa iyong ANIMUA account at tingnan ang official updates o actions sa system. Kung wala kang makitang option o update, direktang makipag-ugnayan sa Angeles City Veterinary Office; hindi kayang i-access, i-cancel, i-approve, o kumpirmahin ng chatbot ang private application records."
      );
    }

    if (hasMultipleIntent(lower)) {
      return localizedReply(
        language,
        "You may submit more than one adoption application, but each application is reviewed separately by the Angeles City Veterinary Office. Submitting two applications does not guarantee approval, and the office may prioritize the best match based on your home, readiness, and the animal's welfare.",
        "Maaari kang magsumite ng higit sa isang adoption application, pero bawat application ay hiwalay na nire-review ng Angeles City Veterinary Office. Ang pagsumite ng dalawang application ay hindi garantiya ng approval, at maaaring unahin ng office ang pinakaangkop batay sa iyong tahanan, kahandaan, at kapakanan ng animal."
      );
    }

    return localizedReply(
      language,
      "For adoption applications, open Find Furbabies, choose an animal, and submit the adoption form from that animal's profile. The Angeles City Veterinary Office reviews each application, so submission does not guarantee approval.",
      "Para sa adoption application, buksan ang Find Furbabies, pumili ng animal, at isumite ang adoption form mula sa profile nito. Nire-review ng Angeles City Veterinary Office ang bawat application, kaya hindi garantiya ng approval ang pagsumite."
    );
  }

  if (hasAdoptionQuantityIntent(lower)) {
    return localizedReply(
      language,
      "You may submit more than one adoption application, including for more than one dog, but each application is reviewed separately by the Angeles City Veterinary Office. There is no automatic guaranteed number of approvals; the office decides based on your readiness, home setup, and the animal's welfare.",
      "Maaari kang magsumite ng higit sa isang adoption application, kahit para sa higit sa isang dog, pero bawat application ay hiwalay na nire-review ng Angeles City Veterinary Office. Walang automatic na guaranteed number ng maa-approve; magdedesisyon ang office batay sa iyong kahandaan, home setup, at kapakanan ng animal."
    );
  }

  if (hasAdoptionProcessIntent(lower)) {
    return localizedReply(
      language,
      "To adopt, go to Find Furbabies, open an animal profile, review the details, then submit the adoption application. Adoption through ANIMUA has no adoption fee. The Angeles City Veterinary Office reviews your home readiness and the animal's welfare needs before approval, so submitting an application does not guarantee approval.",
      "Para mag-adopt, pumunta sa Find Furbabies, buksan ang animal profile, basahin ang details, pagkatapos isumite ang adoption application. Walang adoption fee sa ANIMUA. Ire-review ng Angeles City Veterinary Office ang iyong home readiness at welfare needs ng animal bago ang approval, kaya hindi garantiya ng approval ang submission."
    );
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
    if (!events.length) {
      return localizedReply(
        language,
        "Events are shown in the Home page event section. There are no published upcoming events available right now, so please check the Home page again later or contact the Angeles City Veterinary Office for official confirmation about dates, time, location, requirements, and whether a service is free.",
        "Makikita ang events sa Home page event section. Wala pang published upcoming events na available ngayon, kaya pakitingnan muli ang Home page mamaya o kontakin ang Angeles City Veterinary Office para sa official confirmation tungkol sa date, time, location, requirements, at kung libre ang service."
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

    if (includesAnyWord(lower, ["vaccination", "vaccinations", "vaccine", "bakuna"])) {
      return localizedReply(
        language,
        "Vaccination helps protect pets from certain preventable diseases. For the correct vaccine type, timing, records, and any public vaccination activity, follow the Angeles City Veterinary Office or a licensed veterinarian. I cannot confirm schedules or whether a service is free unless it appears in published event details.",
        "Ang vaccination o bakuna ay tumutulong protektahan ang pets laban sa ilang maiiwasang sakit. Para sa tamang vaccine type, schedule, records, at public vaccination activity, sundin ang Angeles City Veterinary Office o licensed veterinarian. Hindi ako magko-confirm ng schedule o kung libre ang service maliban kung nasa published event details."
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

  if (
    hasAnimalAvailabilityIntent(lower)
  ) {
    const speciesFilter = includesAnyWord(lower, ["dog", "dogs", "aso"])
      ? "dog"
      : includesAnyWord(lower, ["cat", "cats", "pusa"])
        ? "cat"
        : "";

    const visiblePets = speciesFilter
      ? pets.filter((pet) => String(pet.species).toLowerCase().includes(speciesFilter))
      : pets;

    if (!visiblePets.length) {
      if (language === "tagalog") {
        return speciesFilter
          ? `Wala akong nakikitang ready ${speciesFilter}s sa live public list ngayon. Pakitingnan muli ang Find Furbabies mamaya o kontakin ang Angeles City Veterinary Office para sa updates.`
          : "Wala akong nakikitang ready animals sa live public list ngayon. Buksan ang Find Furbabies o kontakin ang Angeles City Veterinary Office para sa pinakabagong availability.";
      }

      return speciesFilter
        ? `I do not see any ready ${speciesFilter}s in the live public list right now. Please check Find Furbabies again later or contact the Angeles City Veterinary Office for updates.`
        : "I cannot see ready animals in the live public list right now. Please open Find Furbabies or contact the Angeles City Veterinary Office for the latest availability.";
    }

    return language === "tagalog"
      ? [
          "Narito ang animals na kasalukuyang marked Ready sa ANIMUA:",
          ...visiblePets.slice(0, 5).map((pet) => `- ${formatPet(pet)}`),
          "Buksan ang Find Furbabies para makita ang photos, details, at adoption actions. Kailangan pa rin ng shelter review bago ma-approve ang adoption."
        ].join("\n")
      : [
          `Here are animals currently marked Ready in ANIMUA:`,
          ...visiblePets.slice(0, 5).map((pet) => `- ${formatPet(pet)}`),
          "Open Find Furbabies to view photos, details, and adoption actions. Shelter review is still required before adoption approval."
        ].join("\n");
  }

  return localizedReply(
    language,
    "I can help with ANIMUA registration, email verification, browsing adoptable animals, the Match Quiz, adoption applications, surrender requests, donations, stray concerns, events, basic pet-care reminders, and contact information. What would you like to do?",
    "Makakatulong ako sa ANIMUA registration, email verification, pag-browse ng adoptable animals, Match Quiz, adoption applications, surrender requests, donations, stray concerns, events, basic pet-care reminders, at contact information. Ano ang gusto mong gawin?"
  );
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
        maxOutputTokens: 2048,
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
      max_output_tokens: 420,
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
      max_completion_tokens: 420
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

    if (shouldUseLocalReply(message)) {
      const context = needsPublicContext(message)
        ? await getPublicContextSafely("Context")
        : getEmptyPublicContext();

      return res.status(200).json({
        reply: getLocalReply(message, context, language),
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
