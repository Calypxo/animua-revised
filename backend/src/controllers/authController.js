// backend/src/controllers/authController.js
const { db, admin } = require("../config/firebase");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const IS_INSECURE_MODE = false;

// EMAIL TRANSPORTER
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendVerificationEmail({ email, fullName, verificationLink }) {
  const mailOptions = {
    from: `"ANIMUA" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify Your ANIMUA Account",
    html: `
      <div style="margin:0;padding:0;background:#fffaf7;font-family:Segoe UI,Arial,sans-serif;">
        <div style="max-width:680px;margin:30px auto;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 18px 45px rgba(151,10,18,0.12);border:1px solid rgba(151,10,18,0.08);">
          
          <div style="background:linear-gradient(160deg, rgba(151,10,18,0.98), rgba(111,25,28,0.96));padding:42px 36px;color:#ffffff;">
            <div style="display:inline-block;padding:10px 16px;border-radius:999px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.14);font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
              ANIMUA Verification
            </div>

            <h1 style="margin:22px 0 12px;font-size:32px;line-height:1.15;">
              Verify your email address
            </h1>

            <p style="margin:0;font-size:15px;line-height:1.8;color:rgba(255,255,255,0.86);max-width:480px;">
              Hi ${fullName || "User"}, welcome to ANIMUA. Please verify your email address to activate your account and continue using the system.
            </p>
          </div>

          <div style="padding:36px 32px 34px;color:#2b1d1d;">
            <p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:#6f5c5c;">
              This verification helps confirm that your email is valid and owned by you. It also helps reduce fake registrations and keeps ANIMUA more secure for adopters, surrenderers, staff, and administrators.
            </p>

            <div style="margin:28px 0;text-align:center;">
              <a href="${verificationLink}" style="display:inline-block;background:linear-gradient(135deg,#970A12,#7f0810);color:#ffffff;text-decoration:none;padding:15px 26px;border-radius:14px;font-weight:700;font-size:15px;">
                Verify My Email
              </a>
            </div>

            <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#6f5c5c;">
              If the button does not work, copy and paste this link into your browser:
            </p>

            <p style="margin:0 0 18px;word-break:break-word;font-size:13px;line-height:1.8;color:#970A12;">
              ${verificationLink}
            </p>

            <div style="margin-top:22px;padding:16px 18px;border-radius:14px;background:#fff9f1;border:1px solid #f2dfb9;">
              <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#9a5b00;">Quick reminder</p>
              <p style="margin:0;font-size:13px;line-height:1.7;color:#7b6447;">
                If you did not create an ANIMUA account, you may safely ignore this email.
              </p>
            </div>
          </div>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

// ─── REGISTER ─────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const fullName = req.body.fullName?.trim();
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required." });
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

    // CREATE FIREBASE AUTH USER FIRST
    let firebaseUser;
    try {
      firebaseUser = await admin.auth().getUserByEmail(email);
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        firebaseUser = await admin.auth().createUser({
          email,
          password,
          displayName: fullName,
          emailVerified: false
        });
      } else {
        throw err;
      }
    }

    // SAVE USER IN FIRESTORE AS PENDING VERIFICATION
    await db.collection("users").doc(email).set({
      fullName,
      email,
      password: storedPassword,
      role: "Public",
      status: "Pending Verification",
      emailVerified: false,
      permissions: [],
      firebaseUid: firebaseUser.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // GENERATE CUSTOM EMAIL VERIFICATION LINK
    const verificationLink = await admin.auth().generateEmailVerificationLink(email, {
      url: `${process.env.APP_BASE_URL}/pages/public/verify-email-action.html`,
      handleCodeInApp: false
    });

    // SEND CUSTOM ANIMUA EMAIL
    await sendVerificationEmail({
      email,
      fullName,
      verificationLink
    });

    return res.status(201).json({
      message: "Registration successful. A verification email has been sent."
    });
  } catch (error) {
    console.error("[Register Error]", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
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
      email: userData.email
    });
  } catch (error) {
    console.error("[Login Error]", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─── UPDATE USERNAME ──────────────────────────────────────────────────────────
exports.updateUsername = async (req, res) => {
  try {
    const email = req.user?.email;
    const fullName = req.body.fullName?.trim();

    if (!email) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    if (!fullName || fullName.length < 2) {
      return res.status(400).json({ message: "Username must be at least 2 characters." });
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
      await admin.auth().updateUser(userData.firebaseUid, {
        displayName: fullName
      });
    }

    return res.status(200).json({
      message: "Username updated successfully.",
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
    const { oldPassword, newPassword } = req.body;

    if (!email) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required." });
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
      await admin.auth().updateUser(userData.firebaseUid, {
        password: newPassword
      });
    }

    return res.status(200).json({
      message: "Password changed successfully."
    });
  } catch (error) {
    console.error("[Change Password Error]", error.message);
    return res.status(500).json({ message: "Internal server error." });
  }
};