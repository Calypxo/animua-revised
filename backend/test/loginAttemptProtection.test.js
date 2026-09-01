const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CAPTCHA_FAILURE_THRESHOLD,
  LOGIN_ATTEMPT_WINDOW_MS,
  MAX_FAILURES_PER_WINDOW,
  clearFailedLogins,
  getLoginAttemptState,
  recordFailedLogin,
  resetLoginAttemptsForTesting,
} = require("../src/services/loginAttemptService");

const req = { ip: "203.0.113.7" };
const email = "client@animua.test";

test.beforeEach(() => resetLoginAttemptsForTesting());

test("server requires CAPTCHA on the third failed login", () => {
  for (let attempt = 1; attempt <= CAPTCHA_FAILURE_THRESHOLD; attempt += 1) {
    const state = recordFailedLogin(req, email, 1000);
    assert.equal(state.failures, attempt);
    assert.equal(state.captchaRequired, attempt >= CAPTCHA_FAILURE_THRESHOLD);
  }
});

test("browser refresh cannot clear server-side login failures", () => {
  for (let attempt = 0; attempt < CAPTCHA_FAILURE_THRESHOLD; attempt += 1) {
    recordFailedLogin(req, email, 1000);
  }

  assert.equal(
    getLoginAttemptState({ ip: req.ip }, email, 2000).captchaRequired,
    true
  );
});

test("server rate-limits excessive failures and reports a retry time", () => {
  let state;
  for (let attempt = 0; attempt < MAX_FAILURES_PER_WINDOW; attempt += 1) {
    state = recordFailedLogin(req, email, 1000);
  }

  assert.equal(state.rateLimited, true);
  assert.equal(state.retryAfterSeconds, LOGIN_ATTEMPT_WINDOW_MS / 1000);
});

test("login failures expire and clear after successful authentication", () => {
  recordFailedLogin(req, email, 1000);
  assert.equal(getLoginAttemptState(req, email, 1001).failures, 1);

  clearFailedLogins(req, email);
  assert.equal(getLoginAttemptState(req, email, 1002).failures, 0);

  recordFailedLogin(req, email, 2000);
  assert.equal(
    getLoginAttemptState(req, email, 2000 + LOGIN_ATTEMPT_WINDOW_MS).failures,
    0
  );
});

test("attempts are separated by normalized account and client address", () => {
  recordFailedLogin(req, " Client@Animua.Test ", 1000);

  assert.equal(getLoginAttemptState(req, "client@animua.test", 1001).failures, 1);
  assert.equal(getLoginAttemptState({ ip: "203.0.113.8" }, email, 1001).failures, 0);
  assert.equal(getLoginAttemptState(req, "other@animua.test", 1001).failures, 0);
});
