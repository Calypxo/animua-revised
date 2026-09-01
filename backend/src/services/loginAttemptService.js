const crypto = require("crypto");

const CAPTCHA_FAILURE_THRESHOLD = 3;
const MAX_FAILURES_PER_WINDOW = 10;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED_ATTEMPTS = 10000;

const attempts = new Map();
let lastCleanupAt = 0;

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

function getClientAddress(req = {}) {
  return String(
    req.ip ||
    req.socket?.remoteAddress ||
    req.connection?.remoteAddress ||
    "unknown"
  ).trim();
}

function createAttemptKey(req, email) {
  return crypto
    .createHash("sha256")
    .update(`${normalizeEmail(email)}|${getClientAddress(req)}`)
    .digest("hex");
}

function removeExpiredAttempts(now = Date.now()) {
  if (now - lastCleanupAt < 60 * 1000 && attempts.size < MAX_TRACKED_ATTEMPTS) {
    return;
  }

  for (const [key, record] of attempts) {
    if (record.resetAt <= now) attempts.delete(key);
  }

  lastCleanupAt = now;

  if (attempts.size <= MAX_TRACKED_ATTEMPTS) return;

  const oldestRecords = [...attempts.entries()]
    .sort((left, right) => left[1].resetAt - right[1].resetAt)
    .slice(0, attempts.size - MAX_TRACKED_ATTEMPTS);

  oldestRecords.forEach(([key]) => attempts.delete(key));
}

function getLoginAttemptState(req, email, now = Date.now()) {
  removeExpiredAttempts(now);

  const key = createAttemptKey(req, email);
  const record = attempts.get(key);

  if (!record || record.resetAt <= now) {
    if (record) attempts.delete(key);
    return {
      failures: 0,
      captchaRequired: false,
      rateLimited: false,
      retryAfterSeconds: 0,
    };
  }

  return {
    failures: record.failures,
    captchaRequired: record.failures >= CAPTCHA_FAILURE_THRESHOLD,
    rateLimited: record.failures >= MAX_FAILURES_PER_WINDOW,
    retryAfterSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
  };
}

function recordFailedLogin(req, email, now = Date.now()) {
  const key = createAttemptKey(req, email);
  const current = attempts.get(key);
  const failures = current && current.resetAt > now
    ? current.failures + 1
    : 1;

  attempts.set(key, {
    failures,
    resetAt: current && current.resetAt > now
      ? current.resetAt
      : now + LOGIN_ATTEMPT_WINDOW_MS,
  });

  return getLoginAttemptState(req, email, now);
}

function clearFailedLogins(req, email) {
  attempts.delete(createAttemptKey(req, email));
}

function resetLoginAttemptsForTesting() {
  attempts.clear();
  lastCleanupAt = 0;
}

module.exports = {
  CAPTCHA_FAILURE_THRESHOLD,
  LOGIN_ATTEMPT_WINDOW_MS,
  MAX_FAILURES_PER_WINDOW,
  clearFailedLogins,
  createAttemptKey,
  getLoginAttemptState,
  recordFailedLogin,
  resetLoginAttemptsForTesting,
};
