const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const OTP_LENGTH = 6;
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const OTP_MAX_ATTEMPTS = 5;

const OTP_PURPOSES = Object.freeze({
  PUBLIC_PASSWORD_RESET: "PUBLIC_PASSWORD_RESET",
  MANAGEMENT_PASSWORD_RESET: "MANAGEMENT_PASSWORD_RESET",
});

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function storeAndSendOtp({ otpRef, otpData, send }) {
  await otpRef.set(otpData);
  try {
    await send();
  } catch (error) {
    await otpRef.delete().catch(() => {});
    throw error;
  }
}

async function createOtpChallenge({
  otpRef,
  email,
  accountId,
  purpose,
  send,
  serverTimestamp,
  now = Date.now(),
}) {
  if (!Object.values(OTP_PURPOSES).includes(purpose)) {
    throw new Error("A valid OTP purpose is required.");
  }

  const existingDoc = await otpRef.get();
  if (existingDoc.exists) {
    const createdAt = toDate(existingDoc.data()?.createdAt);
    const elapsed = createdAt ? now - createdAt.getTime() : OTP_RESEND_COOLDOWN_MS;
    if (elapsed < OTP_RESEND_COOLDOWN_MS) {
      return {
        sent: false,
        cooldown: true,
        retryAfterSeconds: Math.max(1, Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000)),
      };
    }
  }

  const otp = String(crypto.randomInt(100000, 1000000));
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(now + OTP_EXPIRY_MS);
  await storeAndSendOtp({
    otpRef,
    otpData: {
      email,
      accountId,
      purpose,
      otpHash,
      attempts: 0,
      expiresAt,
      createdAt: typeof serverTimestamp === "function" ? serverTimestamp() : new Date(now),
    },
    send: () => send(otp),
  });

  return { sent: true, cooldown: false, expiresAt };
}

async function verifyOtpChallenge({
  otpRef,
  otp,
  email,
  accountId,
  purpose,
  incrementAttempts,
  serverTimestamp,
  allowLegacyPurpose = false,
  now = Date.now(),
}) {
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(String(otp || ""))) {
    return { ok: false, status: 400, code: "INVALID_FORMAT" };
  }

  const otpDoc = await otpRef.get();
  if (!otpDoc.exists) return { ok: false, status: 404, code: "NOT_FOUND" };
  const data = otpDoc.data() || {};
  const storedPurpose = String(data.purpose || "");
  const identityMatches = String(data.email || "").toLowerCase() === String(email || "").toLowerCase()
    && String(data.accountId || data.email || "").toLowerCase() === String(accountId || "").toLowerCase();
  const purposeMatches = storedPurpose === purpose || (allowLegacyPurpose && !storedPurpose);
  if (!identityMatches || !purposeMatches) {
    return { ok: false, status: 401, code: "CONTEXT_MISMATCH" };
  }

  const expiresAt = toDate(data.expiresAt);
  if (!expiresAt || expiresAt.getTime() < now) {
    await otpRef.delete();
    return { ok: false, status: 410, code: "EXPIRED" };
  }
  if ((data.attempts || 0) >= OTP_MAX_ATTEMPTS) {
    await otpRef.delete();
    return { ok: false, status: 429, code: "ATTEMPTS_EXCEEDED" };
  }

  const matches = await bcrypt.compare(String(otp), data.otpHash || "");
  if (!matches) {
    await otpRef.update({
      attempts: typeof incrementAttempts === "function" ? incrementAttempts(1) : (data.attempts || 0) + 1,
      lastAttemptAt: typeof serverTimestamp === "function" ? serverTimestamp() : new Date(now),
    });
    return { ok: false, status: 401, code: "INVALID_OTP" };
  }

  return { ok: true, data, expiresAt };
}

module.exports = {
  OTP_LENGTH,
  OTP_EXPIRY_MS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_MAX_ATTEMPTS,
  OTP_PURPOSES,
  toDate,
  storeAndSendOtp,
  createOtpChallenge,
  verifyOtpChallenge,
};
