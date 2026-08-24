const PYTHON_SENTIMENT_API_URL =
  process.env.PYTHON_SENTIMENT_API_URL ||
  "https://animua-sentiment-3wy62l2fta-as.a.run.app/analyze-surrender-sentiment";
const SENTIMENT_TIMEOUT_MS = Number(process.env.PYTHON_SENTIMENT_TIMEOUT_MS || 15000);

const CATEGORY_RULES = [
  ["Medical", ["may sakit", "sugatan", "dumudugo", "gamot", "ospital", "nabangga", "cancer", "sick", "injured", "bleeding"]],
  ["Behavioral", ["nangangagat", "nangangalmot", "aggressive", "attack", "delikado", "wild"]],
  ["Relocation", ["aalis", "lilipat", "ibang bansa", "mag-aabroad", "relocate", "moving", "migrate", "maisama", "dalhin"]],
  ["Financial", ["walang budget", "hindi afford", "trabaho", "pera", "financial", "money", "income"]],
  ["Owner Incapacity", ["naospital", "bedridden", "disabled", "matanda", "walang mag-aalaga"]],
  ["Overcrowding", ["sobrang dami", "too many", "kuting", "tuta", "walang space"]],
  ["Abandonment Risk", ["iiwan", "iwan", "abandon", "kalsada", "street", "nowhere"]],
];
const EMERGENCY_WORDS = [
  "emergency", "immediately", "bleeding", "dying", "critical", "cannot stand",
  "not eating", "hit by", "attacked", "agad", "agarang", "sugatan",
  "dumudugo", "nabangga", "namamatay", "hindi makatayo",
  "nahihirapang huminga", "walang malay", "nangangagat", "delikado", "kalsada",
];

const includesAny = (text, words) => words.some((word) => text.includes(word));

function buildFallbackAnalysis(reason) {
  const text = String(reason || "").trim().toLowerCase();
  const match = CATEGORY_RULES.find(([, words]) => includesAny(text, words));
  const category = match?.[0] || "Other";
  const emergency = includesAny(text, EMERGENCY_WORDS);
  const keywords = [...new Set(
    [...EMERGENCY_WORDS, ...CATEGORY_RULES.flatMap(([, words]) => words)]
      .filter((word) => text.includes(word))
  )].slice(0, 5);

  let urgencyLabel = "Low";
  let urgencyScore = 25;
  if (emergency) {
    urgencyLabel = "Critical";
    urgencyScore = 95;
  } else if (["Medical", "Behavioral", "Abandonment Risk"].includes(category)) {
    urgencyLabel = "High";
    urgencyScore = 75;
  } else if (["Financial", "Owner Incapacity", "Overcrowding"].includes(category)) {
    urgencyLabel = "Medium";
    urgencyScore = 55;
  }

  return {
    sentiment: emergency ? "Urgent" : "Neutral",
    category,
    urgencyLabel,
    urgencyScore,
    confidence: 0,
    keywords,
    suggestedPriority:
      ["Critical", "High"].includes(urgencyLabel)
        ? "High Priority"
        : urgencyLabel === "Medium" ? "Medium Priority" : "Normal Priority",
    source: "Node fallback (Tagalog sentiment service unavailable)",
  };
}

function isValidAnalysis(result) {
  return Boolean(
    result &&
      typeof result.sentiment === "string" &&
      typeof result.category === "string" &&
      typeof result.urgencyLabel === "string" &&
      Number.isFinite(Number(result.urgencyScore)) &&
      typeof result.source === "string"
  );
}

async function analyzeSurrenderReason(reason, fetchImpl = globalThis.fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SENTIMENT_TIMEOUT_MS);
  try {
    const response = await fetchImpl(PYTHON_SENTIMENT_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Tagalog sentiment service returned HTTP ${response.status}.`);
    }
    const result = await response.json();
    if (!isValidAnalysis(result)) {
      throw new Error("Tagalog sentiment service returned an invalid response.");
    }
    console.info("[surrenderNlp] Python sentiment service used successfully.");
    return result;
  } catch (error) {
    console.warn(
      `Tagalog sentiment service unavailable at ${PYTHON_SENTIMENT_API_URL}; ` +
        `using the Node fallback. ${error.message}`
    );
    return buildFallbackAnalysis(reason);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  PYTHON_SENTIMENT_API_URL,
  analyzeSurrenderReason,
  buildFallbackAnalysis,
  isValidAnalysis,
};
