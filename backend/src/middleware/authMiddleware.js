const jwt = require("jsonwebtoken");

// Use the same toggle here as in your authController.js
const IS_INSECURE_MODE = true; 

const authenticateToken = (req, res, next) => {
    // If we are in Insecure Mode, skip the token check entirely
    if (IS_INSECURE_MODE) {
        req.user = { role: "Public", email: "yanapangan@gmail.com" }; // Mock user data
        return next();
    }

    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    // SECURE: Verify the Stateless JWT using your 256-bit Secret Key
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: "Invalid or expired token." });
        }

        req.user = user;
        next();
    });
};

module.exports = authenticateToken;