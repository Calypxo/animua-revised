const {
  PYTHON_SENTIMENT_API_URL,
  analyzeSurrenderReason,
} = require("../src/services/surrenderNlpService");

const REASON = "I am relocating and cannot bring my dog to our new home.";

async function main() {
  const observed = [];
  const delegateFetch = async (url, options = {}) => {
    const response = await globalThis.fetch(url, options);
    const responseBody = await response.clone().json();
    observed.push({
      url: String(url),
      method: options.method || "GET",
      requestBody: JSON.parse(options.body || "{}"),
      status: response.status,
      responseBody,
    });
    return response;
  };

  const result = await analyzeSurrenderReason(REASON, delegateFetch);
  process.stdout.write(`${JSON.stringify({
    reason: REASON,
    configuredUrl: PYTHON_SENTIMENT_API_URL,
    httpCalls: observed,
    result,
  })}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
