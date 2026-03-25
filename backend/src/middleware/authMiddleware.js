const jwt = require("jsonwebtoken");

// same condition as authController.js
//IS_INSECURE_MODE = true: plain text + no signature check
// IS_INSECURE_MODE = false: Bcrypt + signed JWT
const IS_INSECURE_MODE = false;


const authenticateToken = (req, res, next) => {

// src/middleware/authMiddleware.js

if (IS_INSECURE_MODE) {
    const spoofedRole = req.headers['x-user-role'] || "Public";

    // ADD THESE TWO LOGS:
    console.log("--- DEBUG START ---");
    console.log("Header Received:", req.headers['x-user-role']);
    console.log("Role being injected:", spoofedRole);

    req.user = { 
        email: "mock@insecure.com", 
        role: spoofedRole, 
        fullName: "Mock User" 
    };
    return next();
}

    // Extract Bearer token from Authorization header
    const authHeader = req.headers["authorization"];
    const token      = authHeader && authHeader.split(" ")[1]; // "Bearer <token>"

    if (!token) {
        return res.status(401).json({
            message: "Access denied. No token provided."
        });
    }

    // Verify cryptographic signature — rejects "Algorithm: None" attacks
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