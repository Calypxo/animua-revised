// backend/src/middleware/authMiddleware.js

const jwt = require("jsonwebtoken");
const { db } = require("../config/firebase");

// Keep this false in normal production use.
const IS_INSECURE_MODE = false;

function normalizeRole(role) {
  if (!role) {
    return "";
  }

  const normalized = String(role)
    .trim()
    .toLowerCase();

  if (normalized === "admin") {
    return "Admin";
  }

  if (normalized === "staff") {
    return "Staff";
  }

  if (
    normalized === "veterinarian" ||
    normalized === "vet"
  ) {
    return "Veterinarian";
  }

  if (normalized === "public") {
    return "Public";
  }

  return "";
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return "";
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2) {
    return "";
  }

  const [scheme, token] = parts;

  if (
    scheme !== "Bearer" ||
    !token
  ) {
    return "";
  }

  return token;
}

async function authenticateToken(
  req,
  res,
  next
) {
  try {
    if (IS_INSECURE_MODE) {
      const spoofedRole =
        normalizeRole(
          req.headers["x-user-role"]
        ) || "Public";

      console.log("--- DEBUG START ---");
      console.log(
        "Header Received:",
        req.headers["x-user-role"]
      );
      console.log(
        "Role being injected:",
        spoofedRole
      );

      req.user = {
        email: "mock@insecure.com",
        role: spoofedRole,
        fullName: "Mock User",
        status: "Active",
      };

      return next();
    }

    const token = getBearerToken(req);

    if (!token) {
      return res.status(401).json({
        message:
          "Access denied. No valid token provided.",
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET,
        {
          algorithms: ["HS256"],
        }
      );
    } catch (error) {
      const message =
        error.name === "TokenExpiredError"
          ? "Token has expired. Please log in again."
          : "Invalid or tampered token. Access denied.";

      return res.status(401).json({
        message,
      });
    }

    const email = String(
      decoded.email || ""
    )
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(401).json({
        message:
          "Invalid session. No account identifier found.",
      });
    }

    const userSnapshot = await db
      .collection("users")
      .doc(email)
      .get();

    if (!userSnapshot.exists) {
      return res.status(401).json({
        message:
          "The account linked to this session no longer exists.",
      });
    }

    const currentUser =
      userSnapshot.data() || {};

    const role =
      normalizeRole(currentUser.role);

    if (!role) {
      return res.status(403).json({
        message:
          "This account has an invalid role.",
      });
    }

    const status =
      currentUser.status || "Inactive";

    if (status !== "Active") {
      return res.status(403).json({
        message:
          "This account is inactive.",
      });
    }

    req.user = {
      id: userSnapshot.id,
      email,
      firstName:
        currentUser.firstName || "",
      lastName:
        currentUser.lastName || "",
      fullName:
        currentUser.fullName ||
        `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim(),
      role,
      status,
    };

    return next();
  } catch (error) {
    console.error(
      "[authenticateToken]",
      error
    );

    return res.status(500).json({
      message:
        "Unable to verify the current account.",
    });
  }
}

module.exports = authenticateToken;
module.exports.normalizeRole = normalizeRole;
module.exports.getBearerToken = getBearerToken;
