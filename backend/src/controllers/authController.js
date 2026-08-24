// backend/src/controllers/authController.js
const { db, admin } = require("../config/firebase");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const https = require("https");
const path = require("path");
const {
  clearSessionCookies,
  setSessionCookie,
} = require("../utils/sessionCookie");
const {
  OTP_PURPOSES,
  toDate,
  storeAndSendOtp,
  createOtpChallenge,
  verifyOtpChallenge,
} = require("../services/otpChallengeService");

const IS_INSECURE_MODE = false;
const RECAPTCHA_SECRET_KEY =
  process.env.RECAPTCHA_SECRET_KEY ||
  process.env.GOOGLE_RECAPTCHA_SECRET_KEY ||
  "";
const CURRENT_POLICY_VERSION = "1.0";
const EMAIL_HERO_IMAGE_PATH = path.join(__dirname, "../assets/animua-services-email-banner.png");
const EMAIL_HERO_IMAGE_CID = "animua-cityvet-banner";
const MANAGEMENT_RESET_NEUTRAL_MESSAGE =
  "If this email is associated with an eligible ANIMUA management account, a verification code has been sent.";

function isBcryptHash(value) {
  return typeof value === "string" && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

async function verifyStoredPassword(password, storedPassword) {
  if (typeof password !== "string" || typeof storedPassword !== "string") {
    return { isMatch: false, needsRehash: false };
  }

  if (isBcryptHash(storedPassword)) {
    return {
      isMatch: await bcrypt.compare(password, storedPassword),
      needsRehash: false,
    };
  }

  // Some management accounts predate bcrypt and were saved as plaintext.
  // Compare their legacy value without an early-exit string comparison, then
  // replace it with a bcrypt hash immediately after a successful login.
  const suppliedDigest = crypto.createHash("sha256").update(password).digest();
  const storedDigest = crypto.createHash("sha256").update(storedPassword).digest();

  return {
    isMatch: crypto.timingSafeEqual(suppliedDigest, storedDigest),
    needsRehash: true,
  };
}

async function writeAccountAuditLog({
  action,
  user,
  before = {},
  after = {},
}) {
  try {
    await db.collection("auditLogs").add({
      action,
      module: "Account Settings",
      targetId: user.email,
      targetName: user.fullName || user.email,
      performedBy: user.email,
      performedByName: user.fullName || user.email,
      before,
      after,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.warn("[Account Audit Log]", error.message);
  }
}

// EMAIL TRANSPORTER
function getEmailCredentials(env = process.env) {
  const user = String(env.EMAIL_USER || env.SMTP_USER || "").trim();
  const pass = String(
    env.EMAIL_PASS || env.EMAIL_APP_PASSWORD || env.SMTP_PASS || ""
  ).replace(/\s+/g, "");

  return { user, pass };
}

const emailCredentials = getEmailCredentials();
const transporter = emailCredentials.user && emailCredentials.pass
  ? nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: emailCredentials.user,
        pass: emailCredentials.pass,
      },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 25000,
    })
  : null;

function createOtpEmailError(code, message, cause = null) {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

function sendOtpEmailErrorResponse(res, error) {
  if (error?.code === "OTP_EMAIL_NOT_CONFIGURED") {
    return res.status(503).json({
      message: "Email delivery is not configured. Please contact the administrator.",
    });
  }

  if (error?.code === "OTP_EMAIL_DELIVERY_FAILED") {
    const authenticationFailed = error.providerCode === "EAUTH" || error.providerResponseCode === 535;
    return res.status(502).json({
      message: authenticationFailed
        ? "The email service rejected its credentials. The administrator must replace the Gmail app password."
        : "The verification email could not be sent. Please try again.",
    });
  }

  return null;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[character]));
}

function normalizeProfileText(value = "", maxLength = 160) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function normalizePreferredLanguage(value = "") {
  const language = normalizeProfileText(value, 40);
  return language || "English";
}

function normalizeProfilePhoto(value = "") {
  if (!value) return "";

  if (
    typeof value !== "string" ||
    value.length > 450000 ||
    !/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(value)
  ) {
    return null;
  }

  return value;
}

function getStoredFullName(account = {}, firebaseUser = null) {
  const storedFullName = normalizeProfileText(account.fullName || "", 80);
  if (storedFullName) return storedFullName;

  const composedName = normalizeProfileText(
    `${account.firstName || ""} ${account.lastName || ""}`,
    80
  );
  if (composedName) return composedName;

  return normalizeProfileText(firebaseUser?.displayName || "", 80);
}

function splitFullName(fullName = "") {
  const cleanName = normalizeProfileText(fullName, 80);
  const parts = cleanName.split(" ").filter(Boolean);

  if (parts.length <= 1) {
    return {
      firstName: cleanName,
      lastName: "",
    };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1),
  };
}

function normalizeNotificationSettings(settings = {}) {
  const source = settings && typeof settings === "object" ? settings : {};

  return {
    applicationUpdates: source.applicationUpdates !== false,
    surrenderRequestUpdates: source.surrenderRequestUpdates !== false,
    announcementsEvents: source.announcementsEvents !== false,
  };
}

function serializeAccount(account = {}, fallback = {}) {
  const firebaseUser = fallback.firebaseUser || null;

  return {
    email: account.email || firebaseUser?.email || fallback.email || "",
    fullName: getStoredFullName(account, firebaseUser),
    role: account.role || "Public",
    status: account.status || "Active",
    phone: account.phone || "",
    preferredLanguage: account.preferredLanguage || "English",
    profilePhotoDataUrl: account.profilePhotoDataUrl || "",
    notificationSettings: normalizeNotificationSettings(account.notificationSettings),
    notificationPreference:
      account.notificationPreference || "Email and push notifications",
    privacyPreference: account.privacyPreference || "Standard privacy",
    createdAt: account.createdAt?.toDate
      ? account.createdAt.toDate().toISOString()
      : account.createdAt || "",
  };
}

function formatOtpForEmail(otp = "") {
  return String(otp)
    .split("")
    .map((digit) => `
      <td align="center" valign="middle" style="padding:0 4px;">
        <table role="presentation" width="52" height="60" cellspacing="0" cellpadding="0" border="0" style="width:52px;height:60px;border:1px solid #ead2c7;border-radius:11px;background:#fffdfb;border-collapse:separate;box-shadow:0 2px 6px rgba(107,33,25,0.04);">
          <tr>
            <td align="center" valign="middle" width="52" height="60" style="width:52px;height:60px;padding:0;color:#7b261d;font-family:Segoe UI,Arial,sans-serif;font-size:35px;line-height:1;font-weight:900;text-align:center;vertical-align:middle;mso-line-height-rule:exactly;">
              ${escapeHtml(digit)}
            </td>
          </tr>
        </table>
      </td>
    `)
    .join("");
}

function getEmailHeroImageSrc() {
  const configuredUrl = process.env.EMAIL_HERO_IMAGE_URL?.trim();
  if (configuredUrl) return configuredUrl;

  const appBaseUrl = process.env.APP_BASE_URL?.trim().replace(/\/+$/, "");
  if (appBaseUrl && isPublicEmailAssetBaseUrl(appBaseUrl)) {
    return `${appBaseUrl}/images/animua-services-email-banner.png`;
  }

  return `cid:${EMAIL_HERO_IMAGE_CID}`;
}

function isPublicEmailAssetBaseUrl(url = "") {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();

    return parsedUrl.protocol === "https:" &&
      hostname !== "localhost" &&
      hostname !== "127.0.0.1" &&
      hostname !== "::1";
  } catch {
    return false;
  }
}

async function sendEmailVerificationOtp({
  email,
  fullName,
  otp,
  subject = "Your ANIMUA verification code",
  preheader = "Use this verification code to confirm your ANIMUA email address.",
  heading = "Verify your email address",
  introHtml = "Thank you for creating an ANIMUA account.<br>Use the verification code below to confirm your email address."
}) {
  if (!transporter) {
    throw createOtpEmailError(
      "OTP_EMAIL_NOT_CONFIGURED",
      "EMAIL_USER and an email app password are required."
    );
  }

  const safeFullName = escapeHtml(fullName || "ANIMUA user");
  const formattedOtp = formatOtpForEmail(otp);
  const heroImageSrc = escapeHtml(getEmailHeroImageSrc());
  const safeSubject = String(subject || "Your ANIMUA verification code");
  const safePreheader = escapeHtml(preheader);
  const safeHeading = escapeHtml(heading);

  const mailOptions = {
    from: `"ANIMUA" <${emailCredentials.user}>`,
    to: email,
    subject: safeSubject,
    html: `
      <div style="display:none;max-height:0;overflow:hidden;color:#fbf6f2;font-size:1px;line-height:1px;">
        ${safePreheader}
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0;padding:0;background:#ffffff;font-family:Segoe UI,Arial,sans-serif;color:#282828;">
        <tr>
          <td align="center" style="padding:28px 14px 38px;">
            <table role="presentation" width="760" cellspacing="0" cellpadding="0" border="0" style="width:760px;max-width:100%;background:#ffffff;border:1px solid #eaded6;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(52,33,24,0.08);">
              <tr>
                <td align="center" style="padding:0;background:#f5aa19;">
                  <img src="${heroImageSrc}" width="760" alt="ANIMUA services banner" style="display:block;width:100%;max-width:760px;height:auto;border:0;outline:none;text-decoration:none;line-height:100%;color:#7b261d;font-family:Segoe UI,Arial,sans-serif;font-size:12px;text-align:center;">
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:34px 36px 10px;background:#ffffff;">
                  <h1 style="margin:0;color:#7b261d;font-family:Segoe UI,Arial,sans-serif;font-size:31px;line-height:1.2;font-weight:900;text-align:center;">${safeHeading}</h1>
                  <div style="width:72px;margin:11px auto 14px;border-top:2px solid #efbd29;font-size:0;line-height:0;">&nbsp;</div>
                  <p style="margin:0 0 9px;color:#2c2c2c;font-family:Segoe UI,Arial,sans-serif;font-size:16px;line-height:1.45;font-weight:800;text-align:center;">Hello, ${safeFullName}!</p>
                  <p style="margin:0;color:#4a4f54;font-family:Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.55;text-align:center;">${introHtml}</p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:9px 36px 22px;background:#ffffff;">
                  <table role="presentation" width="430" cellspacing="0" cellpadding="0" border="0" style="width:430px;max-width:100%;background:#f8f1ed;border-radius:14px;box-shadow:0 8px 20px rgba(78,45,33,0.07);">
                    <tr>
                      <td align="center" style="padding:17px 16px 5px;color:#7b261d;font-family:Segoe UI,Arial,sans-serif;font-size:13px;line-height:1.3;font-weight:900;text-transform:uppercase;">
                        YOUR VERIFICATION CODE
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding:9px 20px 14px;">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                          <tr>${formattedOtp}</tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding:0 16px 17px;color:#4f5052;font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.4;">
                        Valid for 10 minutes.
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 112px;background:#ffffff;">
                  <div style="border-top:1px solid #e8ded8;font-size:0;line-height:0;">&nbsp;</div>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:20px 90px 30px;background:#ffffff;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:520px;">
                    <tr>
                      <td width="50%" valign="top" style="padding:0 26px 0 0;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                          <tr>
                            <td width="58" valign="top" style="padding:0 14px 0 0;">
                              <table role="presentation" width="52" height="52" cellspacing="0" cellpadding="0" border="0" style="width:52px;height:52px;border-collapse:separate;">
                                <tr>
                                  <td width="52" height="52" align="center" valign="middle" style="width:52px;height:52px;border-radius:26px;background:#f4ebe5;color:#7b261d;font-family:Segoe UI,Arial,sans-serif;font-size:24px;line-height:1;font-weight:900;text-align:center;mso-line-height-rule:exactly;">&#10003;</td>
                                </tr>
                              </table>
                            </td>
                            <td valign="top" style="padding-top:2px;">
                              <p style="margin:0 0 6px;color:#7b261d;font-family:Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.3;font-weight:900;">For your security</p>
                              <p style="margin:0;color:#303133;font-family:Segoe UI,Arial,sans-serif;font-size:13px;line-height:1.5;">Never share this code with anyone. ANIMUA staff will never ask for your verification code.</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td width="1" style="background:#eadfd8;font-size:0;line-height:0;">&nbsp;</td>
                      <td width="50%" valign="top" style="padding:0 0 0 26px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                          <tr>
                            <td width="58" valign="top" style="padding:0 14px 0 0;">
                              <table role="presentation" width="52" height="52" cellspacing="0" cellpadding="0" border="0" style="width:52px;height:52px;border-collapse:separate;">
                                <tr>
                                  <td width="52" height="52" align="center" valign="middle" style="width:52px;height:52px;border-radius:26px;background:#f4ebe5;color:#7b261d;font-family:Segoe UI,Arial,sans-serif;font-size:29px;line-height:1;font-weight:900;text-align:center;mso-line-height-rule:exactly;">?</td>
                                </tr>
                              </table>
                            </td>
                            <td valign="top" style="padding-top:2px;">
                              <p style="margin:0 0 6px;color:#7b261d;font-family:Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.3;font-weight:900;">Need help?</p>
                              <p style="margin:0;color:#303133;font-family:Segoe UI,Arial,sans-serif;font-size:13px;line-height:1.5;">Contact the Angeles City Veterinary Office for questions or assistance.</p>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:20px 24px 18px;background:#fbf6f2;color:#7b261d;">
                  <p style="margin:0 0 10px;color:#77777a;font-family:Segoe UI,Arial,sans-serif;font-size:13px;line-height:1.45;text-align:center;">This is an automated message. Please do not reply directly to this email.</p>
                  <p style="margin:0;color:#7b261d;font-family:Segoe UI,Arial,sans-serif;font-size:16px;line-height:1.4;font-weight:900;text-align:center;">&copy; 2026 ANIMUA</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `,
    attachments: heroImageSrc.startsWith("cid:")
      ? [
          {
            filename: "animua-services-email-banner.png",
            path: EMAIL_HERO_IMAGE_PATH,
            cid: EMAIL_HERO_IMAGE_CID,
            contentType: "image/png",
            contentDisposition: "inline"
          }
        ]
      : []
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("[OTP Email Provider Error]", {
      code: error.code || "unknown",
      responseCode: error.responseCode || null,
      command: error.command || "unknown",
      message: error.message || "Email delivery failed",
    });

    const deliveryError = createOtpEmailError(
      "OTP_EMAIL_DELIVERY_FAILED",
      "The email provider rejected the OTP message.",
      error
    );
    deliveryError.providerCode = error.code || "";
    deliveryError.providerResponseCode = error.responseCode || null;
    throw deliveryError;
  }
}

async function sendPasswordChangeOtp({ email, fullName, otp }) {
  return sendEmailVerificationOtp({
    email,
    fullName,
    otp,
    subject: "Your ANIMUA password change code",
    preheader: "Use this verification code to confirm your ANIMUA password change.",
    heading: "Verify your password change",
    introHtml: "We received a request to change your ANIMUA password.<br>Use the verification code below to confirm it was you."
  });
}

async function sendForgotPasswordOtp({ email, fullName, otp }) {
  return sendEmailVerificationOtp({
    email,
    fullName,
    otp,
    subject: "Your ANIMUA password reset code",
    preheader: "Use this verification code to reset your ANIMUA password.",
    heading: "Reset your password",
    introHtml: "We received a request to reset your ANIMUA password.<br>Use the verification code below to continue."
  });
}

async function sendManagementPasswordResetOtp({ email, fullName, otp }) {
  return sendEmailVerificationOtp({
    email,
    fullName,
    otp,
    subject: "Your ANIMUA management password reset code",
    preheader: "Use this verification code to recover your ANIMUA management account.",
    heading: "Recover management access",
    introHtml: "We received a request to reset your ANIMUA management password.<br>Use the verification code below to continue. ANIMUA administrators cannot see this code."
  });
}

function validateNewPasswordValue(newPassword) {
  if (typeof newPassword !== "string" || !newPassword) {
    return { status: 400, message: "New password is required." };
  }

  if (newPassword.length > 128) {
    return { status: 400, message: "Password must not exceed 128 characters." };
  }

  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(newPassword)) {
    return {
      status: 400,
      message: "New password must be at least 8 characters and include uppercase, lowercase, number, and special character."
    };
  }

  return null;
}

async function validatePasswordChangeInput({ email, oldPassword, newPassword }) {
  if (!email) {
    return { status: 401, message: "Unauthorized." };
  }

  if (
    typeof oldPassword !== "string" ||
    typeof newPassword !== "string" ||
    !oldPassword ||
    !newPassword
  ) {
    return { status: 400, message: "Current and new password are required." };
  }

  if (oldPassword.length > 128 || newPassword.length > 128) {
    return { status: 400, message: "Passwords must not exceed 128 characters." };
  }

  if (oldPassword === newPassword) {
    return { status: 400, message: "New password must be different from the current password." };
  }

  const newPasswordError = validateNewPasswordValue(newPassword);
  if (newPasswordError) return newPasswordError;

  const userRef = db.collection("users").doc(email);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    return { status: 404, message: "User not found." };
  }

  const userData = userDoc.data();
  const passwordCheck = IS_INSECURE_MODE
    ? { isMatch: oldPassword === userData.password, needsRehash: false }
    : await verifyStoredPassword(oldPassword, userData.password);

  if (!passwordCheck.isMatch) {
    return { status: 401, message: "Current password is incorrect." };
  }

  if (passwordCheck.needsRehash) {
    const passwordHash = await bcrypt.hash(oldPassword, 12);
    await userRef.update({
      password: passwordHash,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    userData.password = passwordHash;
  }

  return { userRef, userData };
}

async function validateForgotPasswordAccount(email) {
  if (!email || typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: 400, message: "Please enter a valid email address." };
  }

  const userRef = db.collection("users").doc(email);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    return { status: 404, message: "No account was found for that email address." };
  }

  const userData = userDoc.data();
  if (String(userData.role || "Public").trim().toLowerCase() !== "public") {
    return { status: 404, message: "No public account was found for that email address." };
  }
  if (String(userData.status || "Active").toLowerCase() === "inactive") {
    return { status: 403, message: "This account is inactive. Please contact ANIMUA support." };
  }

  return { userRef, userData };
}

function isValidAccountEmail(email) {
  return Boolean(email && typeof email === "string" && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
}

function recoveryDocumentId(value) {
  return crypto.createHash("sha256").update(String(value || "").toLowerCase()).digest("hex");
}

function isEligibleManagementUserData(userData = {}) {
  const role = String(userData.role || "").trim().toLowerCase();
  const isManagementRole = role === "admin"
    || role === "staff"
    || role === "veterinarian"
    || role === "vet";
  return isManagementRole
    && String(userData.status || "Active").trim().toLowerCase() === "active";
}

async function getEligibleManagementAccount(email) {
  if (!isValidAccountEmail(email)) return { eligible: false, invalidEmail: true };
  const userRef = db.collection("users").doc(email);
  const userDoc = await userRef.get();
  if (!userDoc.exists) return { eligible: false };
  const userData = userDoc.data() || {};
  const eligible = isEligibleManagementUserData(userData);
  return { eligible, userRef, userData, accountId: userDoc.id };
}

async function writeManagementRecoveryAudit({ action, target, actor, after = {} }) {
  if (!target?.email) return;
  try {
    await db.collection("auditLogs").add({
      action,
      module: "Management Security",
      targetId: target.id || target.email,
      targetName: target.fullName || target.email,
      performedBy: actor?.email || target.email,
      performedByName: actor?.fullName || target.fullName || target.email,
      before: {},
      after,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.warn("[Management Recovery Audit]", error.message);
  }
}

async function requestManagementPasswordResetForEmail({ email, actor = null, source = "self_service" }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const account = await getEligibleManagementAccount(normalizedEmail);
  if (account.invalidEmail) return { status: 400, message: "Please enter a valid email address." };
  if (!account.eligible) return { status: 200, message: MANAGEMENT_RESET_NEUTRAL_MESSAGE, eligible: false };

  const otpRef = db.collection("managementPasswordResetOtps").doc(recoveryDocumentId(normalizedEmail));
  const result = await createOtpChallenge({
    otpRef,
    email: normalizedEmail,
    accountId: account.accountId,
    purpose: OTP_PURPOSES.MANAGEMENT_PASSWORD_RESET,
    serverTimestamp: () => admin.firestore.FieldValue.serverTimestamp(),
    send: (otp) => sendManagementPasswordResetOtp({
      email: normalizedEmail,
      fullName: account.userData.fullName,
      otp,
    }),
  });

  if (result.sent) {
    await writeManagementRecoveryAudit({
      action: "management.password_reset_requested",
      target: { id: account.accountId, email: normalizedEmail, fullName: account.userData.fullName },
      actor,
      after: { source, otpDeliveredToAccountEmail: true },
    });
  }
  return { status: 200, message: MANAGEMENT_RESET_NEUTRAL_MESSAGE, eligible: true };
}

async function applyPasswordChange({
  userRef,
  userData,
  newPassword,
  auditUser,
  invalidateSessions = false,
  auditAction = "account.password_changed",
}) {
  if (userData.firebaseUid) {
    try {
      await admin.auth().updateUser(userData.firebaseUid, {
        password: newPassword
      });
    } catch (firebaseError) {
      console.warn("[Update Firebase Password Failed]", firebaseError.message);
      return {
        status: 502,
        message: "Password was not changed because Firebase could not update your login password. Please try again."
      };
    }
  }

  const newStoredPassword = IS_INSECURE_MODE
    ? newPassword
    : await bcrypt.hash(newPassword, 12);

  await userRef.update({
    password: newStoredPassword,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(invalidateSessions
      ? { sessionVersion: admin.firestore.FieldValue.increment(1) }
      : {}),
  });

  if (invalidateSessions && userData.firebaseUid) {
    await admin.auth().revokeRefreshTokens(userData.firebaseUid).catch((error) => {
      console.warn("[Revoke Firebase Sessions Failed]", error.message);
    });
  }

  await writeAccountAuditLog({
    action: auditAction,
    user: auditUser,
    after: { passwordChanged: true },
  });

  return null;
}

function verifyRecaptchaToken(token, remoteIp) {
  return new Promise((resolve, reject) => {
    if (!RECAPTCHA_SECRET_KEY) {
      reject(new Error("reCAPTCHA secret key is not configured."));
      return;
    }

    const body = new URLSearchParams({
      secret: RECAPTCHA_SECRET_KEY,
      response: token
    });

    if (remoteIp) {
      body.append("remoteip", remoteIp);
    }

    const request = https.request(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body.toString())
        }
      },
      (response) => {
        let data = "";

        response.on("data", (chunk) => {
          data += chunk;
        });

        response.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on("error", reject);
    request.write(body.toString());
    request.end();
  });
}

// ─── REGISTER ─────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const fullName = req.body.fullName?.trim();
    const phone = req.body.phone?.trim() || "";
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    const captchaToken = req.body.captchaToken;
    const firebaseUid = req.body.firebaseUid;
    const firebaseIdToken = req.body.firebaseIdToken;
    const termsAccepted = req.body.termsAccepted === true;
    const policyVersion = req.body.policyVersion;

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (!firebaseUid || !firebaseIdToken) {
      return res.status(400).json({ message: "Firebase account verification is required." });
    }

    if (!termsAccepted || policyVersion !== CURRENT_POLICY_VERSION) {
      return res.status(400).json({
        message: "You must accept the Terms of Use and Privacy Notice to create an account."
      });
    }

    if (!captchaToken) {
      return res.status(400).json({ message: "Please complete the reCAPTCHA check." });
    }

    if (!RECAPTCHA_SECRET_KEY) {
      return res.status(503).json({ message: "Captcha verification is not configured." });
    }

    const captchaResult = await verifyRecaptchaToken(captchaToken, req.ip);

    if (!captchaResult.success) {
      console.warn("[Register Captcha Failed]", captchaResult["error-codes"] || []);
      return res.status(403).json({ message: "Captcha verification failed. Please try again." });
    }

    const decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);
    if (decodedToken.uid !== firebaseUid || decodedToken.email?.toLowerCase() !== email) {
      return res.status(401).json({ message: "Firebase account verification failed." });
    }

    const userDoc = await db.collection("users").doc(email).get();
    if (userDoc.exists) {
      return res.status(409).json({ message: "Email already registered." });
    }

    let storedPassword;
    if (IS_INSECURE_MODE) {
      storedPassword = password;
    } else {
      const salt = await bcrypt.genSalt(12);
      storedPassword = await bcrypt.hash(password, salt);
    }

    await db.collection("users").doc(email).set({
      fullName,
      phone,
      email,
      password: storedPassword,
      role: "Public",
      status: "Active",
      emailVerified: false,
      phoneVerified: false,
      termsAccepted: true,
      termsAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      policyVersion: CURRENT_POLICY_VERSION,
      permissions: [],
      firebaseUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(201).json({
      requiresEmailVerification: true,
      message: "Registration successful. Please verify your email before logging in."
    });
  } catch (error) {
    console.error("[Register Error]", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
exports.requestEmailVerificationOtp = async (req, res) => {
  try {
    const firebaseIdToken = req.body.firebaseIdToken;

    if (!firebaseIdToken) {
      return res.status(400).json({ message: "Firebase verification token is required." });
    }

    const decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);
    const firebaseUser = await admin.auth().getUser(decodedToken.uid);
    const email = firebaseUser.email?.toLowerCase();

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    if (firebaseUser.emailVerified) {
      return res.status(409).json({ message: "Email is already verified." });
    }

    const userDoc = await db.collection("users").doc(email).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: "User profile not found." });
    }

    const otpRef = db.collection("emailVerificationOtps").doc(email);
    const existingOtpDoc = await otpRef.get();
    if (existingOtpDoc.exists) {
      const existing = existingOtpDoc.data();
      const createdAt = existing.createdAt?.toDate ? existing.createdAt.toDate() : null;

      if (createdAt && Date.now() - createdAt.getTime() < 30 * 1000) {
        return res.status(429).json({ message: "Please wait before requesting another email OTP." });
      }
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const userData = userDoc.data();

    await storeAndSendOtp({
      otpRef,
      otpData: {
        email,
        firebaseUid: firebaseUser.uid,
        otpHash,
        attempts: 0,
        expiresAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      send: () => sendEmailVerificationOtp({
        email,
        fullName: userData.fullName,
        otp
      })
    });

    return res.status(200).json({ message: "We sent a six-digit OTP to your email." });
  } catch (error) {
    console.error("[Request Email Verification OTP Error]", error.message);
    const emailErrorResponse = sendOtpEmailErrorResponse(res, error);
    if (emailErrorResponse) return emailErrorResponse;
    return res.status(500).json({ message: "Internal server error." });
  }
};

exports.confirmEmailVerificationOtp = async (req, res) => {
  try {
    const firebaseIdToken = req.body.firebaseIdToken;
    const otp = String(req.body.otp || "").trim();

    if (!firebaseIdToken || !otp) {
      return res.status(400).json({ message: "Firebase token and OTP are required." });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: "Please enter the six-digit email OTP." });
    }

    const decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);
    const firebaseUser = await admin.auth().getUser(decodedToken.uid);
    const email = firebaseUser.email?.toLowerCase();

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const otpRef = db.collection("emailVerificationOtps").doc(email);
    const otpDoc = await otpRef.get();

    if (!otpDoc.exists) {
      return res.status(404).json({ message: "No email OTP request found. Please request a new code." });
    }

    const otpData = otpDoc.data();
    const expiresAt = otpData.expiresAt?.toDate ? otpData.expiresAt.toDate() : new Date(otpData.expiresAt);

    if (!expiresAt || expiresAt.getTime() < Date.now()) {
      await otpRef.delete();
      return res.status(410).json({ message: "Email OTP expired. Please request a new code." });
    }

    if ((otpData.attempts || 0) >= 5) {
      await otpRef.delete();
      return res.status(429).json({ message: "Too many email OTP attempts. Please request a new code." });
    }

    const isOtpMatch = await bcrypt.compare(otp, otpData.otpHash);
    if (!isOtpMatch) {
      await otpRef.update({
        attempts: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.status(401).json({ message: "Incorrect email OTP. Please try again." });
    }

    await admin.auth().updateUser(firebaseUser.uid, {
      emailVerified: true
    });

    const userRef = db.collection("users").doc(email);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User profile not found." });
    }

    const userData = userDoc.data();

    await userRef.update({
      emailVerified: true,
      status: "Active",
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await otpRef.delete();

    const token = jwt.sign(
      {
        email: userData.email,
        fullName: userData.fullName,
        role: userData.role,
        sessionVersion: Number.isInteger(userData.sessionVersion) ? userData.sessionVersion : 0,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h", algorithm: "HS256" }
    );

    setSessionCookie(res, token);

    return res.status(200).json({
      message: "Email verified successfully.",
      role: userData.role,
      fullName: userData.fullName,
      email: userData.email,
      emailVerified: true,
      phoneVerified: Boolean(userData.phoneVerified)
    });
  } catch (error) {
    console.error("[Confirm Email Verification OTP Error]", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};

exports.login = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    const captchaToken = req.body.captchaToken;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    if (captchaToken) {
      if (!RECAPTCHA_SECRET_KEY) {
        return res.status(503).json({ message: "Captcha verification is not configured." });
      }

      const captchaResult = await verifyRecaptchaToken(captchaToken, req.ip);

      if (!captchaResult.success) {
        console.warn("[Login Captcha Failed]", captchaResult["error-codes"] || []);
        return res.status(403).json({ message: "Captcha verification failed. Please try again." });
      }
    }

    const userDoc = await db.collection("users").doc(email).get();
    if (!userDoc.exists) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const userData = userDoc.data();

    if (userData.status === "Inactive") {
      return res.status(403).json({
        message: "Your account has been deactivated. Contact an administrator."
      });
    }

    const passwordCheck = IS_INSECURE_MODE
      ? { isMatch: password === userData.password, needsRehash: false }
      : await verifyStoredPassword(password, userData.password);

    if (!passwordCheck.isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (passwordCheck.needsRehash) {
      const passwordHash = await bcrypt.hash(password, 12);
      await db.collection("users").doc(email).update({
        password: passwordHash,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      userData.password = passwordHash;
    }

    const requestedPortal = String(req.body.portal || "").trim().toLowerCase();
    const isManagementUser = isEligibleManagementUserData(userData);
    if (requestedPortal === "public" && isManagementUser) {
      return res.status(403).json({
        code: "MANAGEMENT_PORTAL_REQUIRED",
        message: "Management accounts must sign in through the management portal."
      });
    }

if (!userData.emailVerified && !userData.phoneVerified) {
  if (isManagementUser) {
    await db.collection("users").doc(email).update({
      emailVerified: true,
      phoneVerified: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    userData.emailVerified = true;
    userData.phoneVerified = false;
  } else {
    let firebaseUser;

    try {
      firebaseUser = userData.firebaseUid
        ? await admin.auth().getUser(userData.firebaseUid)
        : await admin.auth().getUserByEmail(email);
    } catch (firebaseError) {
      if (firebaseError.code === "auth/user-not-found") {
        return res.status(401).json({
          message:
            "This public account is incomplete. Please register again or contact the administrator."
        });
      }

      throw firebaseError;
    }

    if (!firebaseUser.emailVerified && !firebaseUser.phoneNumber) {
      return res.status(403).json({
        message: "Please verify your email or phone number before logging in.",
        verificationRequired: true,
        verificationMethod: "email"
      });
    }

    await db.collection("users").doc(email).update({
      firebaseUid: firebaseUser.uid,
      emailVerified: Boolean(firebaseUser.emailVerified),
      phone: firebaseUser.phoneNumber || userData.phone || "",
      phoneVerified: Boolean(firebaseUser.phoneNumber),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    userData.firebaseUid = firebaseUser.uid;
    userData.emailVerified = Boolean(firebaseUser.emailVerified);
    userData.phoneVerified = Boolean(firebaseUser.phoneNumber);
  }
}

    const token = jwt.sign(
      {
        email: userData.email,
        fullName: userData.fullName,
        role: userData.role,
        sessionVersion: Number.isInteger(userData.sessionVersion) ? userData.sessionVersion : 0,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h", algorithm: "HS256" }
    );

    setSessionCookie(res, token);

    db.collection("users").doc(email).update({
      lastLogin: admin.firestore.FieldValue.serverTimestamp()
    }).catch(err => console.warn("[lastLogin update failed]", err.message));

    return res.status(200).json({
      message: "Login successful!",
      role: userData.role,
      fullName: userData.fullName,
      email: userData.email,
      account: serializeAccount(userData, { email }),
      emailVerified: Boolean(userData.emailVerified),
      phoneVerified: Boolean(userData.phoneVerified)
    });
  } catch (error) {
    console.error("[Login Error]", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── UPDATE USERNAME ──────────────────────────────────────────────────────────
exports.logout = async (req, res) => {
  clearSessionCookies(res);
  return res.status(200).json({ message: "Logout successful." });
};

exports.confirmPhoneVerification = async (req, res) => {
  try {
    const firebaseIdToken = req.body.firebaseIdToken;

    if (!firebaseIdToken) {
      return res.status(400).json({ message: "Firebase verification token is required." });
    }

    const decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);
    const firebaseUser = await admin.auth().getUser(decodedToken.uid);
    const email = firebaseUser.email?.toLowerCase();

    if (!email || !firebaseUser.phoneNumber) {
      return res.status(400).json({ message: "Phone number is not verified yet." });
    }

    const userRef = db.collection("users").doc(email);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User profile not found." });
    }

    await userRef.update({
      phone: firebaseUser.phoneNumber,
      phoneVerified: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({
      message: "Phone number verified successfully."
    });
  } catch (error) {
    console.error("[Confirm Phone Verification Error]", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};

exports.syncEmailVerification = async (req, res) => {
  try {
    const firebaseIdToken = String(req.body?.firebaseIdToken || "").trim();
    if (!firebaseIdToken) {
      return res.status(400).json({ message: "Firebase verification token is required." });
    }

    const decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);
    const firebaseUser = await admin.auth().getUser(decodedToken.uid);
    const email = String(firebaseUser.email || "").trim().toLowerCase();
    if (!email || !firebaseUser.emailVerified) {
      return res.status(409).json({ message: "Email is not verified yet." });
    }

    const userRef = db.collection("users").doc(email);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: "User profile not found." });
    }

    const userData = userDoc.data() || {};
    if (userData.firebaseUid && userData.firebaseUid !== firebaseUser.uid) {
      return res.status(403).json({ message: "Firebase identity does not match this user profile." });
    }

    await userRef.update({
      emailVerified: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      message: "Email verification synchronized successfully.",
      emailVerified: true,
    });
  } catch (error) {
    console.error("[Sync Email Verification Error]", error.message);
    const invalidToken = String(error.code || "").startsWith("auth/");
    return res.status(invalidToken ? 401 : 500).json({
      message: invalidToken ? "Invalid or expired Firebase verification token." : "Internal server error.",
    });
  }
};

exports.discardUnverifiedRegistration = async (req, res) => {
  try {
    const firebaseIdToken = req.body.firebaseIdToken;

    if (!firebaseIdToken) {
      return res.status(400).json({ message: "Firebase verification token is required." });
    }

    const decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);
    const email = decodedToken.email?.toLowerCase();

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const firebaseUser = await admin.auth().getUser(decodedToken.uid);
    const userRef = db.collection("users").doc(email);
    const userDoc = await userRef.get();

    if (firebaseUser.emailVerified || firebaseUser.phoneNumber) {
      return res.status(409).json({ message: "Verified accounts cannot be discarded." });
    }

    if (userDoc.exists) {
      const userData = userDoc.data();
      if (!userData.emailVerified && !userData.phoneVerified) {
        await userRef.delete();
      }
    }

    await db.collection("emailVerificationOtps").doc(email).delete().catch((error) => {
      console.warn("[Discard Email OTP Cleanup Warning]", error.message);
    });

    return res.status(200).json({ message: "Unverified registration discarded." });
  } catch (error) {
    console.error("[Discard Unverified Registration Error]", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};

exports.getCurrentAccount = async (req, res) => {
  try {
    const userDoc = await db.collection("users").doc(req.user.email).get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found." });
    }

    const userData = userDoc.data() || {};
    let firebaseUser = null;

    try {
      firebaseUser = userData.firebaseUid
        ? await admin.auth().getUser(userData.firebaseUid)
        : await admin.auth().getUserByEmail(req.user.email);
    } catch (firebaseError) {
      if (firebaseError.code !== "auth/user-not-found") {
        console.warn("[Get Current Account Firebase Fallback]", firebaseError.message);
      }
    }

    return res.status(200).json({
      account: serializeAccount(userData, {
        email: req.user.email || userDoc.id,
        firebaseUser,
      }),
    });
  } catch (error) {
    console.error("[Get Current Account Error]", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};

exports.updateUsername = async (req, res) => {
  try {
    const email = req.user?.email;
    const fullName = typeof req.body?.fullName === "string"
      ? req.body.fullName.trim().replace(/\s+/g, " ")
      : "";

    if (!email) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    if (!fullName || fullName.length < 2 || fullName.length > 80) {
      return res.status(400).json({
        message: "Display name must be between 2 and 80 characters.",
      });
    }

    if (!/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u.test(fullName)) {
      return res.status(400).json({
        message:
          "Display name may contain letters, spaces, periods, apostrophes, and hyphens only.",
      });
    }

    const userRef = db.collection("users").doc(email);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found." });
    }

    const userData = userDoc.data();
    const hasField = (field) =>
      Object.prototype.hasOwnProperty.call(req.body || {}, field);
    const phone = hasField("phone")
      ? normalizeProfileText(req.body.phone, 32)
      : userData.phone || "";
    const preferredLanguage = hasField("preferredLanguage")
      ? normalizePreferredLanguage(req.body.preferredLanguage)
      : userData.preferredLanguage || "English";
    const notificationPreference = hasField("notificationPreference")
      ? normalizeProfileText(req.body.notificationPreference, 80) ||
        "Email and push notifications"
      : userData.notificationPreference || "Email and push notifications";
    const notificationSettings = hasField("notificationSettings")
      ? normalizeNotificationSettings(req.body.notificationSettings)
      : normalizeNotificationSettings(userData.notificationSettings);
    const privacyPreference = hasField("privacyPreference")
      ? normalizeProfileText(req.body.privacyPreference, 80) || "Standard privacy"
      : userData.privacyPreference || "Standard privacy";
    const profilePhotoDataUrl = hasField("profilePhotoDataUrl")
      ? normalizeProfilePhoto(req.body.profilePhotoDataUrl)
      : userData.profilePhotoDataUrl || "";

    if (profilePhotoDataUrl === null) {
      return res.status(400).json({
        message: "Profile photo must be a valid PNG, JPG, or WebP image under 450 KB.",
      });
    }

    const splitName = splitFullName(fullName);

    await userRef.update({
      fullName,
      firstName: splitName.firstName,
      lastName: splitName.lastName,
      phone,
      preferredLanguage,
      notificationPreference,
      notificationSettings,
      privacyPreference,
      profilePhotoDataUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    if (userData.firebaseUid) {
      try {
        await admin.auth().updateUser(userData.firebaseUid, {
          displayName: fullName
        });
      } catch (firebaseError) {
        console.warn("[Update Firebase Display Name]", firebaseError.message);
      }
    }

    await writeAccountAuditLog({
      action: "account.profile_updated",
      user: { ...req.user, fullName },
      before: {
        fullName: userData.fullName || "",
        firstName: userData.firstName || "",
        lastName: userData.lastName || "",
        phone: userData.phone || "",
        preferredLanguage: userData.preferredLanguage || "English",
        notificationSettings: normalizeNotificationSettings(userData.notificationSettings),
      },
      after: {
        fullName,
        firstName: splitName.firstName,
        lastName: splitName.lastName,
        phone,
        preferredLanguage,
        notificationSettings,
      },
    });

    return res.status(200).json({
      message: "Display name updated successfully.",
      account: serializeAccount({
        ...userData,
        fullName,
        firstName: splitName.firstName,
        lastName: splitName.lastName,
        phone,
        preferredLanguage,
        notificationPreference,
        notificationSettings,
        privacyPreference,
        profilePhotoDataUrl,
      }, { email }),
      fullName
    });
  } catch (error) {
    console.error("[Update Username Error]", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};


// ─── CHANGE PASSWORD ──────────────────────────────────────────────────────────
exports.requestPasswordChangeOtp = async (req, res) => {
  try {
    const email = req.user?.email;
    const { oldPassword, newPassword } = req.body || {};
    const validation = await validatePasswordChangeInput({ email, oldPassword, newPassword });

    if (validation.status) {
      return res.status(validation.status).json({ message: validation.message });
    }

    const otpRef = db.collection("passwordChangeOtps").doc(email);
    const existingOtpDoc = await otpRef.get();

    if (existingOtpDoc.exists) {
      const existing = existingOtpDoc.data();
      const createdAt = existing.createdAt?.toDate ? existing.createdAt.toDate() : null;

      if (createdAt && Date.now() - createdAt.getTime() < 30 * 1000) {
        return res.status(429).json({ message: "Please wait before requesting another password OTP." });
      }
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await storeAndSendOtp({
      otpRef,
      otpData: {
        email,
        otpHash,
        attempts: 0,
        expiresAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      },
      send: () => sendPasswordChangeOtp({
        email,
        fullName: validation.userData.fullName,
        otp
      })
    });

    return res.status(200).json({ message: "We sent a six-digit OTP to your email." });
  } catch (error) {
    console.error("[Request Password Change OTP Error]", error.message);
    const emailErrorResponse = sendOtpEmailErrorResponse(res, error);
    if (emailErrorResponse) return emailErrorResponse;
    return res.status(500).json({ message: "Internal server error." });
  }
};

exports.confirmPasswordChangeOtp = async (req, res) => {
  try {
    const email = req.user?.email;
    const { oldPassword, newPassword } = req.body || {};
    const otp = String(req.body?.otp || "").trim();

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: "Please enter the six-digit password OTP." });
    }

    const validation = await validatePasswordChangeInput({ email, oldPassword, newPassword });

    if (validation.status) {
      return res.status(validation.status).json({ message: validation.message });
    }

    const otpRef = db.collection("passwordChangeOtps").doc(email);
    const otpDoc = await otpRef.get();

    if (!otpDoc.exists) {
      return res.status(404).json({ message: "No password OTP request found. Please request a new code." });
    }

    const otpData = otpDoc.data();
    const expiresAt = otpData.expiresAt?.toDate ? otpData.expiresAt.toDate() : new Date(otpData.expiresAt);

    if (!expiresAt || expiresAt.getTime() < Date.now()) {
      await otpRef.delete();
      return res.status(410).json({ message: "Password OTP expired. Please request a new code." });
    }

    if ((otpData.attempts || 0) >= 5) {
      await otpRef.delete();
      return res.status(429).json({ message: "Too many password OTP attempts. Please request a new code." });
    }

    const isOtpMatch = await bcrypt.compare(otp, otpData.otpHash);

    if (!isOtpMatch) {
      await otpRef.update({
        attempts: admin.firestore.FieldValue.increment(1),
        lastAttemptAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return res.status(401).json({ message: "Incorrect password OTP. Please try again." });
    }

    const applyError = await applyPasswordChange({
      userRef: validation.userRef,
      userData: validation.userData,
      newPassword,
      auditUser: req.user
    });

    if (applyError) {
      return res.status(applyError.status).json({ message: applyError.message });
    }

    await otpRef.delete();

    return res.status(200).json({
      message: "Password changed successfully."
    });
  } catch (error) {
    console.error("[Confirm Password Change OTP Error]", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};

exports.requestForgotPasswordOtp = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const validation = await validateForgotPasswordAccount(email);

    if (validation.status) {
      return res.status(validation.status).json({ message: validation.message });
    }

    const otpRef = db.collection("forgotPasswordOtps").doc(email);
    const challenge = await createOtpChallenge({
      otpRef,
      email,
      accountId: validation.userRef.id,
      purpose: OTP_PURPOSES.PUBLIC_PASSWORD_RESET,
      serverTimestamp: () => admin.firestore.FieldValue.serverTimestamp(),
      send: (otp) => sendForgotPasswordOtp({
        email,
        fullName: validation.userData.fullName,
        otp
      })
    });
    if (challenge.cooldown) {
      return res.status(429).json({ message: "Please wait before requesting another password reset OTP." });
    }

    return res.status(200).json({ message: "We sent a six-digit OTP to your email." });
  } catch (error) {
    console.error("[Request Forgot Password OTP Error]", error.message);
    const emailErrorResponse = sendOtpEmailErrorResponse(res, error);
    if (emailErrorResponse) return emailErrorResponse;
    return res.status(500).json({ message: "Internal server error." });
  }
};

exports.confirmForgotPasswordOtp = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const otp = String(req.body?.otp || "").trim();
    const { newPassword } = req.body || {};

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ message: "Please enter the six-digit password reset OTP." });
    }

    const passwordError = validateNewPasswordValue(newPassword);
    if (passwordError) {
      return res.status(passwordError.status).json({ message: passwordError.message });
    }

    const validation = await validateForgotPasswordAccount(email);
    if (validation.status) {
      return res.status(validation.status).json({ message: validation.message });
    }

    const otpRef = db.collection("forgotPasswordOtps").doc(email);
    const verified = await verifyOtpChallenge({
      otpRef,
      otp,
      email,
      accountId: validation.userRef.id,
      purpose: OTP_PURPOSES.PUBLIC_PASSWORD_RESET,
      allowLegacyPurpose: true,
      incrementAttempts: (value) => admin.firestore.FieldValue.increment(value),
      serverTimestamp: () => admin.firestore.FieldValue.serverTimestamp(),
    });
    if (!verified.ok) {
      const messages = {
        INVALID_FORMAT: "Please enter the six-digit password reset OTP.",
        NOT_FOUND: "No password reset OTP request found. Please request a new code.",
        EXPIRED: "Password reset OTP expired. Please request a new code.",
        ATTEMPTS_EXCEEDED: "Too many password reset OTP attempts. Please request a new code.",
        INVALID_OTP: "Incorrect password reset OTP. Please try again.",
        CONTEXT_MISMATCH: "This password reset code is not valid for this recovery request.",
      };
      return res.status(verified.status).json({ message: messages[verified.code] || "Unable to verify password reset OTP." });
    }

    const applyError = await applyPasswordChange({
      userRef: validation.userRef,
      userData: validation.userData,
      newPassword,
      auditUser: {
        email,
        fullName: validation.userData.fullName || email
      },
      invalidateSessions: true,
      auditAction: "public.password_reset_completed",
    });

    if (applyError) {
      return res.status(applyError.status).json({ message: applyError.message });
    }

    await otpRef.delete();

    return res.status(200).json({
      message: "Password reset successfully."
    });
  } catch (error) {
    console.error("[Confirm Forgot Password OTP Error]", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};

exports.requestManagementPasswordResetOtp = async (req, res) => {
  try {
    const result = await requestManagementPasswordResetForEmail({
      email: req.body?.email,
      source: "self_service",
    });
    return res.status(result.status).json({ message: result.message });
  } catch (error) {
    console.error("[Request Management Password Reset OTP Error]", error.message);
    const emailErrorResponse = sendOtpEmailErrorResponse(res, error);
    if (emailErrorResponse) return emailErrorResponse;
    return res.status(500).json({ message: "Unable to start management account recovery." });
  }
};

exports.verifyManagementPasswordResetOtp = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const otp = String(req.body?.otp || "").trim();
    if (!isValidAccountEmail(email)) return res.status(400).json({ message: "Please enter a valid email address." });
    const account = await getEligibleManagementAccount(email);
    if (!account.eligible) {
      return res.status(401).json({ message: "The verification code is invalid or expired." });
    }

    const otpRef = db.collection("managementPasswordResetOtps").doc(recoveryDocumentId(email));
    const verified = await verifyOtpChallenge({
      otpRef,
      otp,
      email,
      accountId: account.accountId,
      purpose: OTP_PURPOSES.MANAGEMENT_PASSWORD_RESET,
      incrementAttempts: (value) => admin.firestore.FieldValue.increment(value),
      serverTimestamp: () => admin.firestore.FieldValue.serverTimestamp(),
    });
    if (!verified.ok) {
      const messages = {
        INVALID_FORMAT: "Please enter the six-digit verification code.",
        EXPIRED: "The verification code expired. Request a new code.",
        ATTEMPTS_EXCEEDED: "Too many incorrect attempts. Request a new code.",
        INVALID_OTP: "Incorrect verification code. Please try again.",
      };
      return res.status(verified.status).json({
        message: messages[verified.code] || "The verification code is invalid or expired.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("base64url");
    const grantRef = db.collection("managementPasswordResetGrants").doc(recoveryDocumentId(resetToken));
    await grantRef.set({
      email,
      accountId: account.accountId,
      purpose: OTP_PURPOSES.MANAGEMENT_PASSWORD_RESET,
      used: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    await otpRef.delete();
    await writeManagementRecoveryAudit({
      action: "management.password_reset_otp_verified",
      target: { id: account.accountId, email, fullName: account.userData.fullName },
      after: { verificationSuccessful: true },
    });
    return res.status(200).json({
      message: "Verification successful. Create your new password.",
      resetToken,
    });
  } catch (error) {
    console.error("[Verify Management Password Reset OTP Error]", error.message);
    return res.status(500).json({ message: "Unable to verify the management recovery code." });
  }
};

exports.completeManagementPasswordReset = async (req, res) => {
  try {
    const resetToken = String(req.body?.resetToken || "").trim();
    const newPassword = req.body?.newPassword;
    const confirmPassword = req.body?.confirmPassword;
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(resetToken)) {
      return res.status(401).json({ message: "Your recovery verification expired. Start again." });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New password and confirmation do not match." });
    }
    const passwordError = validateNewPasswordValue(newPassword);
    if (passwordError) return res.status(passwordError.status).json({ message: passwordError.message });

    const grantRef = db.collection("managementPasswordResetGrants").doc(recoveryDocumentId(resetToken));
    const initialGrantDoc = await grantRef.get();
    if (!initialGrantDoc.exists) {
      return res.status(401).json({ message: "Your recovery verification expired. Start again." });
    }
    const grantData = initialGrantDoc.data() || {};
    const initialExpiry = toDate(grantData.expiresAt);
    if (grantData.used || grantData.purpose !== OTP_PURPOSES.MANAGEMENT_PASSWORD_RESET || !initialExpiry || initialExpiry.getTime() < Date.now()) {
      return res.status(401).json({ message: "Your recovery verification expired. Start again." });
    }
    const account = await getEligibleManagementAccount(String(grantData.email || "").toLowerCase());
    if (!account.eligible || account.accountId !== grantData.accountId) {
      return res.status(401).json({ message: "This management account is no longer eligible for recovery." });
    }
    const passwordCheck = await verifyStoredPassword(newPassword, account.userData.password);
    if (passwordCheck.isMatch) {
      return res.status(400).json({ message: "Choose a password different from your current password." });
    }

    await db.runTransaction(async (transaction) => {
      const grantDoc = await transaction.get(grantRef);
      if (!grantDoc.exists) throw Object.assign(new Error("Recovery verification not found."), { statusCode: 401 });
      const currentGrant = grantDoc.data() || {};
      const expiresAt = toDate(currentGrant.expiresAt);
      if (currentGrant.used || currentGrant.purpose !== OTP_PURPOSES.MANAGEMENT_PASSWORD_RESET || !expiresAt || expiresAt.getTime() < Date.now()) {
        throw Object.assign(new Error("Recovery verification expired."), { statusCode: 401 });
      }
      transaction.update(grantRef, {
        used: true,
        usedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    const applyError = await applyPasswordChange({
      userRef: account.userRef,
      userData: account.userData,
      newPassword,
      auditUser: { email: grantData.email, fullName: account.userData.fullName || grantData.email },
      invalidateSessions: true,
      auditAction: "management.password_reset_completed",
    });
    if (applyError) return res.status(applyError.status).json({ message: applyError.message });
    await grantRef.delete();
    clearSessionCookies(res);
    return res.status(200).json({
      message: "Password reset successfully. Sign in with your new password.",
    });
  } catch (error) {
    console.error("[Complete Management Password Reset Error]", error.message);
    return res.status(error.statusCode || 500).json({
      message: error.statusCode
        ? "Your recovery verification expired. Start again."
        : "Unable to reset the management password.",
    });
  }
};

exports.sendManagementPasswordResetByAdmin = async (req, res) => {
  try {
    const targetEmail = String(req.params?.id || "").trim().toLowerCase();
    const account = await getEligibleManagementAccount(targetEmail);
    if (!account.eligible) {
      return res.status(400).json({ message: "Password recovery can only be sent to an active management account." });
    }
    const result = await requestManagementPasswordResetForEmail({
      email: targetEmail,
      actor: req.user,
      source: "administrator_assisted",
    });
    return res.status(result.status).json({
      message: "Password recovery instructions were sent to the account holder's registered email.",
    });
  } catch (error) {
    console.error("[Admin Send Management Password Reset Error]", error.message);
    const emailErrorResponse = sendOtpEmailErrorResponse(res, error);
    if (emailErrorResponse) return emailErrorResponse;
    return res.status(500).json({ message: "Unable to send password recovery instructions." });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const email = req.user?.email;
    const { oldPassword, newPassword } = req.body || {};
    const validation = await validatePasswordChangeInput({ email, oldPassword, newPassword });

    if (validation.status) {
      return res.status(validation.status).json({ message: validation.message });
    }

    const applyError = await applyPasswordChange({
      userRef: validation.userRef,
      userData: validation.userData,
      newPassword,
      auditUser: req.user
    });

    if (applyError) {
      return res.status(applyError.status).json({ message: applyError.message });
    }

    return res.status(200).json({
      message: "Password changed successfully."
    });
  } catch (error) {
    console.error("[Change Password Error]", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};

exports.validateNewPasswordValue = validateNewPasswordValue;
exports.isBcryptHash = isBcryptHash;
exports.verifyStoredPassword = verifyStoredPassword;
exports.getEmailCredentials = getEmailCredentials;
exports.storeAndSendOtp = storeAndSendOtp;
exports.isEligibleManagementUserData = isEligibleManagementUserData;
exports.MANAGEMENT_RESET_NEUTRAL_MESSAGE = MANAGEMENT_RESET_NEUTRAL_MESSAGE;
