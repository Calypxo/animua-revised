const jwt = require("jsonwebtoken");

// Keep this in sync with authController.js
const IS_INSECURE_MODE = false;

/**
 * authenticateToken
 *
 * INSECURE MODE (Phase 3 of the Lab):
 *   - Skips ALL signature verification — mirrors the "Algorithm: None" spoof
 *   - Any request passes as a fake Public user
 *
 * SECURE MODE (Phase 4 Fix):
 *   - Extracts the Bearer token from the Authorization header
 *   - Verifies HMAC-SHA256 signature against process.env.JWT_SECRET
 *   - Rejects expired, tampered, or missing tokens with HTTP 401/403
 */
const authenticateToken = (req, res, next) => {

    if (IS_INSECURE_MODE) {
        // ⚠️  PHASE 3: Signature check bypassed — exactly like the lab's vulnerable login()
        console.warn("[AUDIT - INSECURE] Token verification SKIPPED. Using mock user.");
        req.user = { email: "mock@insecure.com", role: "Public", fullName: "Mock User" };
        return next();
    }

    // ✅  PHASE 4: Extract Bearer token from Authorization header
    const authHeader = req.headers["authorization"];
    const token      = authHeader && authHeader.split(" ")[1]; // "Bearer <token>"

    if (!token) {
        return res.status(401).json({
            message: "Access denied. No token provided."
        });
    }

    // ✅  PHASE 4: Verify cryptographic signature — rejects "Algorithm: None" attacks
    jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] }, (err, decoded) => {
        if (err) {
            const reason = err.name === "TokenExpiredError"
                ? "Token has expired. Please log in again."
                : "Invalid or tampered token. Access denied.";
            return res.status(403).json({ message: reason });
        }

        req.user = decoded; // { email, fullName, role, iat, exp }
        next();
    });
};

module.exports = authenticateToken;