const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");
const {
  OTP_PURPOSES,
  OTP_MAX_ATTEMPTS,
  createOtpChallenge,
  verifyOtpChallenge,
} = require("../src/services/otpChallengeService");

function createDocument(initialData = null) {
  let data = initialData;
  let deleted = false;
  return {
    ref: {
      async get() {
        return { exists: data !== null && !deleted, data: () => data };
      },
      async set(next) { data = { ...next }; deleted = false; },
      async update(next) { data = { ...data, ...next }; },
      async delete() { data = null; deleted = true; },
    },
    read: () => data,
    wasDeleted: () => deleted,
  };
}

test("management OTP is hashed, purpose-bound, and reusable only until consumed", async () => {
  const document = createDocument();
  let deliveredOtp = "";
  const now = Date.now();
  const result = await createOtpChallenge({
    otpRef: document.ref,
    email: "admin@animua.test",
    accountId: "admin@animua.test",
    purpose: OTP_PURPOSES.MANAGEMENT_PASSWORD_RESET,
    now,
    send: async (otp) => { deliveredOtp = otp; },
  });
  const stored = document.read();
  assert.equal(result.sent, true);
  assert.match(deliveredOtp, /^\d{6}$/);
  assert.notEqual(stored.otpHash, deliveredOtp);
  assert.equal(await bcrypt.compare(deliveredOtp, stored.otpHash), true);
  assert.equal(Object.hasOwn(stored, "otp"), false, "plain OTP is never persisted");
  assert.equal(stored.purpose, OTP_PURPOSES.MANAGEMENT_PASSWORD_RESET);

  const crossPurpose = await verifyOtpChallenge({
    otpRef: document.ref,
    otp: deliveredOtp,
    email: "admin@animua.test",
    accountId: "admin@animua.test",
    purpose: OTP_PURPOSES.PUBLIC_PASSWORD_RESET,
    now,
  });
  assert.equal(crossPurpose.code, "CONTEXT_MISMATCH");

  const verified = await verifyOtpChallenge({
    otpRef: document.ref,
    otp: deliveredOtp,
    email: "admin@animua.test",
    accountId: "admin@animua.test",
    purpose: OTP_PURPOSES.MANAGEMENT_PASSWORD_RESET,
    now,
  });
  assert.equal(verified.ok, true);

  await document.ref.delete();
  const reused = await verifyOtpChallenge({
    otpRef: document.ref,
    otp: deliveredOtp,
    email: "admin@animua.test",
    accountId: "admin@animua.test",
    purpose: OTP_PURPOSES.MANAGEMENT_PASSWORD_RESET,
    now,
  });
  assert.equal(reused.code, "NOT_FOUND");
});

test("public OTP cannot verify a management recovery challenge", async () => {
  const document = createDocument();
  let otp = "";
  await createOtpChallenge({
    otpRef: document.ref,
    email: "person@animua.test",
    accountId: "person@animua.test",
    purpose: OTP_PURPOSES.PUBLIC_PASSWORD_RESET,
    send: async (value) => { otp = value; },
  });
  const result = await verifyOtpChallenge({
    otpRef: document.ref,
    otp,
    email: "person@animua.test",
    accountId: "person@animua.test",
    purpose: OTP_PURPOSES.MANAGEMENT_PASSWORD_RESET,
  });
  assert.equal(result.code, "CONTEXT_MISMATCH");
});

test("OTP resend cooldown, expiry, and attempt limit are enforced", async () => {
  const now = Date.now();
  const recent = createDocument({ createdAt: new Date(now - 5000) });
  const cooldown = await createOtpChallenge({
    otpRef: recent.ref,
    email: "staff@animua.test",
    accountId: "staff@animua.test",
    purpose: OTP_PURPOSES.MANAGEMENT_PASSWORD_RESET,
    now,
    send: async () => assert.fail("cooldown must not send another OTP"),
  });
  assert.equal(cooldown.cooldown, true);
  assert.ok(cooldown.retryAfterSeconds > 0);

  const expired = createDocument({
    email: "staff@animua.test",
    accountId: "staff@animua.test",
    purpose: OTP_PURPOSES.MANAGEMENT_PASSWORD_RESET,
    otpHash: await bcrypt.hash("123456", 4),
    attempts: 0,
    expiresAt: new Date(now - 1),
  });
  const expiredResult = await verifyOtpChallenge({
    otpRef: expired.ref,
    otp: "123456",
    email: "staff@animua.test",
    accountId: "staff@animua.test",
    purpose: OTP_PURPOSES.MANAGEMENT_PASSWORD_RESET,
    now,
  });
  assert.equal(expiredResult.code, "EXPIRED");
  assert.equal(expired.wasDeleted(), true);

  const locked = createDocument({
    email: "staff@animua.test",
    accountId: "staff@animua.test",
    purpose: OTP_PURPOSES.MANAGEMENT_PASSWORD_RESET,
    otpHash: await bcrypt.hash("123456", 4),
    attempts: OTP_MAX_ATTEMPTS,
    expiresAt: new Date(now + 60000),
  });
  const lockedResult = await verifyOtpChallenge({
    otpRef: locked.ref,
    otp: "123456",
    email: "staff@animua.test",
    accountId: "staff@animua.test",
    purpose: OTP_PURPOSES.MANAGEMENT_PASSWORD_RESET,
    now,
  });
  assert.equal(lockedResult.code, "ATTEMPTS_EXCEEDED");
  assert.equal(locked.wasDeleted(), true);
});

test("incorrect OTP increments attempts without exposing the stored hash", async () => {
  const document = createDocument({
    email: "vet@animua.test",
    accountId: "vet@animua.test",
    purpose: OTP_PURPOSES.MANAGEMENT_PASSWORD_RESET,
    otpHash: await bcrypt.hash("123456", 4),
    attempts: 1,
    expiresAt: new Date(Date.now() + 60000),
  });
  const result = await verifyOtpChallenge({
    otpRef: document.ref,
    otp: "654321",
    email: "vet@animua.test",
    accountId: "vet@animua.test",
    purpose: OTP_PURPOSES.MANAGEMENT_PASSWORD_RESET,
    incrementAttempts: () => 2,
  });
  assert.equal(result.code, "INVALID_OTP");
  assert.equal(document.read().attempts, 2);
});
