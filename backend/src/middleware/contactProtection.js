const DEFAULT_WINDOW_MS = 15 * 60_000;
const DEFAULT_MAX_REQUESTS = 5;

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function requestKey(req = {}) {
  return String(
    req.ip ||
    req.socket?.remoteAddress ||
    "unknown"
  ).trim();
}

function createContactRateLimiter(options = {}) {
  const windowMs = positiveNumber(
    options.windowMs ?? process.env.CONTACT_RATE_LIMIT_WINDOW_MS,
    DEFAULT_WINDOW_MS
  );
  const maxRequests = positiveNumber(
    options.maxRequests ?? process.env.CONTACT_RATE_LIMIT_MAX,
    DEFAULT_MAX_REQUESTS
  );
  const now = options.now || Date.now;
  const store = options.store || new Map();

  return function contactRateLimiter(req, res, next) {
    const timestamp = now();
    const key = requestKey(req);
    let record = store.get(key);

    if (!record || record.resetAt <= timestamp) {
      record = { count: 0, resetAt: timestamp + windowMs };
    }

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((record.resetAt - timestamp) / 1000)
    );

    if (record.count >= maxRequests) {
      res.set("Retry-After", String(retryAfterSeconds));
      res.set("RateLimit-Limit", String(maxRequests));
      res.set("RateLimit-Remaining", "0");
      res.set("RateLimit-Reset", String(retryAfterSeconds));
      return res.status(429).json({
        message: "Too many contact messages were sent from this connection. Please wait a few minutes and try again.",
      });
    }

    record.count += 1;
    store.set(key, record);
    res.set("RateLimit-Limit", String(maxRequests));
    res.set("RateLimit-Remaining", String(Math.max(0, maxRequests - record.count)));
    res.set("RateLimit-Reset", String(retryAfterSeconds));

    if (store.size > 5_000) {
      for (const [storedKey, storedRecord] of store) {
        if (storedRecord.resetAt <= timestamp) store.delete(storedKey);
      }
    }

    return next();
  };
}

function rejectContactHoneypot(req, res, next) {
  const website = String(req.body?.website || "").trim();
  if (!website) return next();

  // Return a neutral success response so automated spam does not learn how
  // the trap works. No Firestore document or email is created.
  return res.status(201).json({
    message: "Your message has been received by the ANIMUA team.",
    accepted: true,
  });
}

const contactRateLimiter = createContactRateLimiter();

module.exports = {
  contactRateLimiter,
  createContactRateLimiter,
  rejectContactHoneypot,
  requestKey,
};
