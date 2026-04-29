const express = require("express");
const router  = express.Router();
const { register, login, updateUsername, changePassword } = require("../controllers/authController");
const verifyToken = require("../middleware/authMiddleware");

// Public routes — no token needed
router.post("/register", register);
router.post("/login",    login);

router.put("/update-username", verifyToken, updateUsername);
router.put("/change-password", verifyToken, changePassword);

module.exports = router;