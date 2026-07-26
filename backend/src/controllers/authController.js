// backend/src/controllers/authController.js
const { db, admin } = require("../config/firebase");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const https = require("https");
const path = require("path");

const IS_INSECURE_MODE = false;
const RECAPTCHA_SECRET_KEY =
  process.env.RECAPTCHA_SECRET_KEY ||
  process.env.GOOGLE_RECAPTCHA_SECRET_KEY ||
  "";
const CURRENT_POLICY_VERSION = "1.0";
const EMAIL_HERO_IMAGE_PATH = path.join(__dirname, "../assets/animua-services-email-banner.png");
const EMAIL_HERO_IMAGE_CID = "animua-cityvet-banner";

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
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

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

async function sendEmailVerificationOtp({ email, fullName, otp }) {
  const safeFullName = escapeHtml(fullName || "ANIMUA user");
  const formattedOtp = formatOtpForEmail(otp);
  const heroImageSrc = escapeHtml(getEmailHeroImageSrc());

  const mailOptions = {
    from: `"ANIMUA" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your ANIMUA verification code",
    html: `
      <div style="display:none;max-height:0;overflow:hidden;color:#fbf6f2;font-size:1px;line-height:1px;">
        Use this verification code to confirm your ANIMUA email address.
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
                  <h1 style="margin:0;color:#7b261d;font-family:Segoe UI,Arial,sans-serif;font-size:31px;line-height:1.2;font-weight:900;text-align:center;">Verify your email address</h1>
                  <div style="width:72px;margin:11px auto 14px;border-top:2px solid #efbd29;font-size:0;line-height:0;">&nbsp;</div>
                  <p style="margin:0 0 9px;color:#2c2c2c;font-family:Segoe UI,Arial,sans-serif;font-size:16px;line-height:1.45;font-weight:800;text-align:center;">Hello, ${safeFullName}!</p>
                  <p style="margin:0;color:#4a4f54;font-family:Segoe UI,Arial,sans-serif;font-size:15px;line-height:1.55;text-align:center;">Thank you for creating an ANIMUA account.<br>Use the verification code below to confirm your email address.</p>
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

  await transporter.sendMail(mailOptions);
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

    const existingOtpDoc = await db.collection("emailVerificationOtps").doc(email).get();
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

    await db.collection("emailVerificationOtps").doc(email).set({
      email,
      firebaseUid: firebaseUser.uid,
      otpHash,
      attempts: 0,
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await sendEmailVerificationOtp({
      email,
      fullName: userData.fullName,
      otp
    });

    return res.status(200).json({ message: "We sent a six-digit OTP to your email." });
  } catch (error) {
    console.error("[Request Email Verification OTP Error]", error.message);
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
        role: userData.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h", algorithm: "HS256" }
    );

    return res.status(200).json({
      message: "Email verified successfully.",
      token,
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

    let isMatch = false;
    if (IS_INSECURE_MODE) {
      isMatch = password === userData.password;
    } else {
      isMatch = await bcrypt.compare(password, userData.password);
    }

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const managementRoles = ["Admin", "Staff", "Veterinarian"];
const isManagementUser = managementRoles.includes(userData.role);

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
        message: "Please verify your email or phone number before logging in."
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
        role: userData.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h", algorithm: "HS256" }
    );

    db.collection("users").doc(email).update({
      lastLogin: admin.firestore.FieldValue.serverTimestamp()
    }).catch(err => console.warn("[lastLogin update failed]", err.message));

    return res.status(200).json({
      message: "Login successful!",
      token,
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
exports.changePassword = async (req, res) => {
  try {
    const email = req.user?.email;
    const { oldPassword, newPassword } = req.body || {};

    if (!email) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    if (
      typeof oldPassword !== "string" ||
      typeof newPassword !== "string" ||
      !oldPassword ||
      !newPassword
    ) {
      return res.status(400).json({ message: "Current and new password are required." });
    }

    if (oldPassword.length > 128 || newPassword.length > 128) {
      return res.status(400).json({
        message: "Passwords must not exceed 128 characters.",
      });
    }

    if (oldPassword === newPassword) {
      return res.status(400).json({
        message: "New password must be different from the current password.",
      });
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(newPassword)) {
      return res.status(400).json({
        message: "New password must be at least 8 characters and include uppercase, lowercase, number, and special character."
      });
    }

    const userRef = db.collection("users").doc(email);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User not found." });
    }

    const userData = userDoc.data();

    const isMatch = IS_INSECURE_MODE
      ? oldPassword === userData.password
      : await bcrypt.compare(oldPassword, userData.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect." });
    }

    if (userData.firebaseUid) {
      try {
        await admin.auth().updateUser(userData.firebaseUid, {
          password: newPassword
        });
      } catch (firebaseError) {
        console.warn("[Update Firebase Password Failed]", firebaseError.message);
        return res.status(502).json({
          message: "Password was not changed because Firebase could not update your login password. Please try again."
        });
      }
    }

    const newStoredPassword = IS_INSECURE_MODE
      ? newPassword
      : await bcrypt.hash(newPassword, 12);

    await userRef.update({
      password: newStoredPassword,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await writeAccountAuditLog({
      action: "account.password_changed",
      user: req.user,
      after: { passwordChanged: true },
    });

    return res.status(200).json({
      message: "Password changed successfully."
    });
  } catch (error) {
    console.error("[Change Password Error]", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};
