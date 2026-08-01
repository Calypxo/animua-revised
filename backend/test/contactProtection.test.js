const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createContactRateLimiter,
  rejectContactHoneypot,
} = require("../src/middleware/contactProtection");

function responseRecorder() {
  return {
    headers: {},
    statusCode: 200,
    payload: null,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.payload = value;
      return this;
    },
  };
}

test("contact rate limiter allows requests within the configured limit", () => {
  const limiter = createContactRateLimiter({
    windowMs: 60_000,
    maxRequests: 2,
    now: () => 1_000,
  });
  const req = { ip: "127.0.0.1", body: {} };
  const res = responseRecorder();
  let calls = 0;

  limiter(req, res, () => { calls += 1; });
  limiter(req, res, () => { calls += 1; });

  assert.equal(calls, 2);
  assert.equal(res.headers["RateLimit-Remaining"], "0");
});

test("contact rate limiter rejects bursts with retry guidance", () => {
  const limiter = createContactRateLimiter({
    windowMs: 60_000,
    maxRequests: 1,
    now: () => 1_000,
  });
  const req = { ip: "127.0.0.1", body: {} };
  limiter(req, responseRecorder(), () => {});

  const blocked = responseRecorder();
  let continued = false;
  limiter(req, blocked, () => { continued = true; });

  assert.equal(continued, false);
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.headers["Retry-After"], "60");
  assert.match(blocked.payload.message, /too many contact messages/i);
});

test("contact rate limiter resets after its time window", () => {
  let timestamp = 1_000;
  const limiter = createContactRateLimiter({
    windowMs: 500,
    maxRequests: 1,
    now: () => timestamp,
  });
  const req = { ip: "127.0.0.1", body: {} };
  let calls = 0;

  limiter(req, responseRecorder(), () => { calls += 1; });
  timestamp = 1_501;
  limiter(req, responseRecorder(), () => { calls += 1; });

  assert.equal(calls, 2);
});

test("filled honeypot returns neutral success without continuing", () => {
  const res = responseRecorder();
  let continued = false;

  rejectContactHoneypot(
    { body: { website: "https://spam.example" } },
    res,
    () => { continued = true; }
  );

  assert.equal(continued, false);
  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.accepted, true);
});

test("empty honeypot allows a real contact submission", () => {
  let continued = false;
  rejectContactHoneypot(
    { body: { website: "" } },
    responseRecorder(),
    () => { continued = true; }
  );
  assert.equal(continued, true);
});
