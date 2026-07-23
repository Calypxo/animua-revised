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
const EMAIL_HERO_IMAGE_PATH = path.join(__dirname, "../assets/cityvet-services-email.jpg");

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

function formatOtpForEmail(otp = "") {
  return String(otp)
    .split("")
    .map((digit) => `<span style="display:inline-block;padding:0 7px;">${escapeHtml(digit)}</span>`)
    .join("");
}

function getEmailHeroImageSrc() {
  const configuredUrl = process.env.EMAIL_HERO_IMAGE_URL?.trim();
  if (configuredUrl) return configuredUrl;

  const appBaseUrl = process.env.APP_BASE_URL?.trim().replace(/\/+$/, "");
  if (appBaseUrl) return `${appBaseUrl}/images/cityvet-services-email.jpg`;

  return "cid:cityvet-services-email";
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
      <div style="display:none;max-height:0;overflow:hidden;color:#f8f3ef;font-size:1px;line-height:1px;">
        Use this six-digit code to verify your ANIMUA email address.
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0;padding:0;background:#f8f3ef;font-family:Segoe UI,Arial,sans-serif;color:#2d3338;">
        <tr>
          <td align="center" style="padding:28px 12px;">
            <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:640px;max-width:100%;background:#ffffff;border:1px solid #eadbd5;border-radius:14px;overflow:hidden;box-shadow:0 14px 34px rgba(93,31,25,0.10);">
              <tr>
                <td align="center" style="padding:26px 28px 18px;background:#ffffff;">
                  <div style="font-size:35px;line-height:1;font-weight:900;letter-spacing:0.03em;color:#6f2119;">ANIMUA</div>
                  <div style="margin-top:6px;font-size:12px;font-weight:700;color:#b8792b;">Compassion. Connection. Care.</div>
                </td>
              </tr>
              <tr>
                <td>
                  <img src="${heroImageSrc}" width="640" alt="Angeles City Veterinary Office services" style="display:block;width:100%;max-width:640px;height:auto;border:0;line-height:100%;">
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:30px 34px 18px;background:#ffffff;">
                  <h1 style="margin:0;color:#6f2119;font-size:30px;line-height:1.2;font-weight:900;">Verify your email</h1>
                  <div style="width:112px;margin:14px auto 22px;border-top:2px solid #d9a544;"></div>
                  <p style="margin:0 0 10px;color:#2d3338;font-size:16px;line-height:1.6;font-weight:800;">Hello, ${safeFullName}!</p>
                  <p style="margin:0;color:#4f575d;font-size:15px;line-height:1.65;">Thank you for creating an ANIMUA account. Use the verification code below to confirm your email address.</p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:10px 34px 16px;background:#ffffff;">
                  <div style="max-width:420px;margin:0 auto;padding:18px 14px;border:1.5px solid #8e2f25;border-radius:12px;background:#fffdfb;color:#6f2119;font-size:34px;line-height:1.25;font-weight:900;letter-spacing:0.18em;text-align:center;">
                    ${formattedOtp}
                  </div>
                  <p style="margin:16px 0 0;color:#6b625e;font-size:14px;line-height:1.5;">Valid for 10 minutes</p>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 34px 0;background:#ffffff;">
                  <div style="border-top:1px solid #eadbd5;"></div>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 34px 18px;background:#ffffff;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td width="52" valign="top" style="padding-right:14px;">
                        <div style="width:42px;height:42px;border-radius:50%;background:#f5e7e2;color:#6f2119;text-align:center;line-height:42px;font-size:22px;font-weight:900;">!</div>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 5px;color:#6f2119;font-size:15px;line-height:1.4;font-weight:900;">For your security</p>
                        <p style="margin:0;color:#40474c;font-size:14px;line-height:1.55;">Never share this code with anyone. ANIMUA staff will never ask for your verification code.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 34px;background:#ffffff;">
                  <div style="border-top:1px solid #eadbd5;"></div>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 34px 28px;background:#ffffff;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td width="52" valign="top" style="padding-right:14px;">
                        <div style="width:42px;height:42px;border-radius:50%;background:#fff4df;color:#8e2f25;text-align:center;line-height:42px;font-size:20px;font-weight:900;">?</div>
                      </td>
                      <td valign="top">
                        <p style="margin:0 0 5px;color:#6f2119;font-size:15px;line-height:1.4;font-weight:900;">Need help?</p>
                        <p style="margin:0;color:#40474c;font-size:14px;line-height:1.55;">Contact the Angeles City Veterinary Office for questions or assistance.</p>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:22px 0 0;color:#687077;font-size:13px;line-height:1.55;text-align:center;">If you did not create an ANIMUA account, you may safely ignore this email.</p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:18px 24px 22px;background:#f8f3ef;color:#6f2119;">
                  <p style="margin:0 0 8px;font-size:13px;line-height:1.4;font-weight:900;">&copy; 2026 ANIMUA</p>
                  <p style="margin:0;color:#6b625e;font-size:12px;line-height:1.5;">This is an automated message. Please do not reply directly to this email.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `,
    attachments: [
      {
        filename: "cityvet-services-email.jpg",
        path: EMAIL_HERO_IMAGE_PATH,
        cid: "cityvet-services-email"
      }
    ]
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

      if (createdAt && Date.now() - createdAt.getTime() < 60 * 1000) {
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

    return res.status(200).json({ message: "Unverified registration discarded." });
  } catch (error) {
    console.error("[Discard Unverified Registration Error]", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};

exports.getCurrentAccount = async (req, res) => {
  return res.status(200).json({
    account: {
      email: req.user.email,
      fullName: req.user.fullName,
      role: req.user.role,
      status: req.user.status,
    },
  });
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

    await userRef.update({
      fullName,
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
      before: { fullName: userData.fullName || "" },
      after: { fullName },
    });

    return res.status(200).json({
      message: "Display name updated successfully.",
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

    const newStoredPassword = IS_INSECURE_MODE
      ? newPassword
      : await bcrypt.hash(newPassword, 12);

    await userRef.update({
      password: newStoredPassword,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    if (userData.firebaseUid) {
      try {
        await admin.auth().updateUser(userData.firebaseUid, {
          password: newPassword
        });
      } catch (firebaseError) {
        console.warn("[Update Firebase Password]", firebaseError.message);
      }
    }

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
