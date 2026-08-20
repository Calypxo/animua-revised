const {
  RAW_QUESTION_KEYS,
  SCORING_DIMENSIONS,
  scoreMatches,
} = require("../src/services/compatibilityScoringService");

const MATCHER_URL = process.env.PYTHON_MATCHER_URL || "http://127.0.0.1:8001/score";
const preferences = Object.fromEntries(RAW_QUESTION_KEYS.map((key) => [key, 4]));
const assessment = (value) => Object.fromEntries(
  SCORING_DIMENSIONS.map(({ key }) => [key, value]),
);
const animals = [
  { id: "IT018-FAR", name: "IT-018 Far", species: "Dog", status: "Ready", behavioralAssessment: assessment(1) },
  { id: "IT018-EXACT", name: "IT-018 Exact", species: "Dog", status: "Ready", behavioralAssessment: assessment(4) },
  { id: "IT018-CLOSE", name: "IT-018 Close", species: "Cat", status: "Ready", behavioralAssessment: assessment(3) },
];

async function main() {
  const httpCalls = [];
  const logs = { info: [], warn: [] };
  const observedFetch = async (url, options = {}) => {
    const response = await globalThis.fetch(url, options);
    const responseBody = await response.clone().json();
    httpCalls.push({
      url: String(url),
      method: options.method || "GET",
      requestBody: JSON.parse(options.body || "{}"),
      status: response.status,
      responseBody,
    });
    return response;
  };

  const result = await scoreMatches(preferences, animals, 3, {
    fetchImpl: observedFetch,
    matcherUrl: MATCHER_URL,
    logger: {
      info: (message) => logs.info.push(message),
      warn: (message) => logs.warn.push(message),
    },
  });

  process.stdout.write(`${JSON.stringify({
    configuredUrl: MATCHER_URL,
    preferences,
    animals,
    httpCalls,
    logs,
    result,
  })}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
