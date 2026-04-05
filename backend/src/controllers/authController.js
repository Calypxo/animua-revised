// backend/src/controllers/authController.js
const { db, admin } = require("../config/firebase");
const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");

const IS_INSECURE_MODE = false;

// ─── REGISTER ─────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const fullName = req.body.fullName?.trim();
    const email    = req.body.email?.trim().toLowerCase();
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

    await db.collection("users").doc(email).set({
      fullName,
      email,
      password:    storedPassword,
      role:        "Public",
      status:      "Active",
      permissions: [],
      createdAt:   admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(201).json({ message: "Registration successful!" });
  } catch (error) {
    console.error("[Register Error]", error.message);
    res.status(500).json({ message: "Internal server error." });
  }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const email    = req.body.email?.trim().toLowerCase();
    const password = req.body.password;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const userDoc = await db.collection("users").doc(email).get();
    if (!userDoc.exists) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const userData = userDoc.data();

    // Block inactive users
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

    // Build JWT payload
    const token = jwt.sign(
      {
        email:    userData.email,
        fullName: userData.fullName,
        role:     userData.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "8h", algorithm: "HS256" }
    );

    // Update lastLogin timestamp (fire-and-forget — don't block response)
    db.collection("users").doc(email).update({
      lastLogin: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(err => console.warn("[lastLogin update failed]", err.message));

    res.status(200).json({
      message:  "Login successful!",
      token,
      role:     userData.role,
      fullName: userData.fullName,
      email:    userData.email,
    });
  } catch (error) {
    console.error("[Login Error]", error.message);
    res.status(500).json({ message: "Internal server error." });
  }
};