const { db } = require("../config/firebase");
const {
  buildShelterLabel,
} = require("../utils/animalIdentity");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || process.env.CHATBOT_MODEL || "gpt-4o-mini";
const OPENAI_API_URL = process.env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions";

const MAX_MESSAGE_LENGTH = 700;
const MAX_HISTORY_ITEMS = 8;
const rateLimitStore = new Map();

function getClientKey(req) {
  return req.ip || req.headers["x-forwarded-for"] || "unknown";
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

async function getPublicContext() {
  const [petsSnapshot, eventsSnapshot] = await Promise.all([
    db.collection("animals").where("status", "==", "Ready").limit(6).get(),
    db.collection("events").limit(4).get()
  ]);

  const pets = petsSnapshot.docs.map((doc) => {
    const pet = doc.data();
    return [
      buildShelterLabel(pet, doc.id),
      pet.species,
      pet.breed,
      pet.sex,
      pet.ageEstimate,
    ].filter(Boolean).join(" - ");
  });

  const events = eventsSnapshot.docs.map((doc) => {
    const event = doc.data();
    return [event.title || event.name, event.date || event.eventDate, event.location || event.venue].filter(Boolean).join(" - ");
  });

  return {
    pets,
    events
  };
}

function buildSystemPrompt(context = {}) {
  return [
    "You are ANIMUA Assistant for the Angeles City Veterinary Office animal adoption system.",
    "Help users with adoption browsing, compatibility matching, surrender requests, account registration, email OTP verification, login, and general shelter service navigation.",
    "Be concise, friendly, and practical. Use simple instructions and ask one follow-up question when needed.",
    "Do not pretend to approve adoptions, accept surrender requests, diagnose animals, provide emergency medical advice, or make official government decisions.",
    "For medical emergencies, tell users to contact a licensed veterinarian or the Angeles City Veterinary Office directly.",
    "If asked about private account data, tell users to sign in and use the correct page instead of asking for passwords or OTP codes.",
    "Never ask for passwords, OTP codes, or sensitive documents in chat.",
    "Known public pages: Home, Find Furbabies, Match Quiz, Surrender, Contact Us.",
    `Ready animals shown publicly right now: ${context.pets?.length ? context.pets.join("; ") : "No live animal list available in context."}`,
    `Published or recent events in context: ${context.events?.length ? context.events.join("; ") : "No event list available in context."}`
  ].join("\n");
}

function getFallbackReply(message) {
  const lower = message.toLowerCase();

  if (lower.includes("adopt") || lower.includes("furbabies") || lower.includes("animal")) {
    return "You can browse adoptable animals on the Find Furbabies page. Open a pet profile, review the details, then start an adoption application. Applications are reviewed by the Angeles City Veterinary Office and do not guarantee approval.";
  }

  if (lower.includes("surrender")) {
    return "For surrender requests, go to the Surrender page and complete the request form carefully. Submitting a request does not guarantee acceptance; the Angeles City Veterinary Office will review the details and decide based on capacity and policy.";
  }

  if (lower.includes("match") || lower.includes("quiz") || lower.includes("compat")) {
    return "Use the Match Quiz to compare your lifestyle and care preferences with animals available for adoption. The result is a guide, not a final adoption decision.";
  }

  if (lower.includes("login") || lower.includes("register") || lower.includes("account") || lower.includes("otp")) {
    return "To create an ANIMUA account, use Register, complete the CAPTCHA, then enter the email OTP sent to your inbox. Never share your OTP or password with anyone.";
  }

  if (lower.includes("contact") || lower.includes("office") || lower.includes("location")) {
    return "For official questions, use the Contact Us page or contact the Angeles City Veterinary Office directly using the verified contact details shown in ANIMUA.";
  }

  return "I can help with ANIMUA registration, email verification, browsing adoptable animals, the match quiz, adoption applications, surrender requests, and contact information. What would you like to do?";
}

async function requestOpenAIReply({ message, history, context }) {
  const messages = [
    { role: "system", content: buildSystemPrompt(context) },
    ...history,
    { role: "user", content: message }
  ];

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
      max_tokens: 360
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

    const message = cleanMessage(req.body.message || "");
    const history = cleanHistory(req.body.history || []);

    if (!message) {
      return res.status(400).json({ message: "Message is required." });
    }

    const context = await getPublicContext().catch((error) => {
      console.warn("[Chatbot Context Warning]", error.message);
      return { pets: [], events: [] };
    });

    if (!OPENAI_API_KEY) {
      return res.status(200).json({
        reply: getFallbackReply(message),
        mode: "fallback"
      });
    }

    const reply = await requestOpenAIReply({ message, history, context });

    return res.status(200).json({
      reply: reply || getFallbackReply(message),
      mode: "ai"
    });
  } catch (error) {
    console.error("[Chatbot Error]", error.message);
    return res.status(500).json({
      message: "Unable to answer right now. Please try again later."
    });
  }
};
