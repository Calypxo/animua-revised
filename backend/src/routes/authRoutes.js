const express = require("express");
const router  = express.Router();
const {
  register,
  login,
  requestEmailVerificationOtp,
  confirmEmailVerificationOtp,
  confirmPhoneVerification,
  discardUnverifiedRegistration,
  updateUsername,
  changePassword
} = require("../controllers/authController");
const verifyToken = require("../middleware/authMiddleware");

// Public routes — no token needed
router.post("/register", register);
router.post("/login",    login);
router.post("/request-email-verification-otp", requestEmailVerificationOtp);
router.post("/confirm-email-verification-otp", confirmEmailVerificationOtp);
router.post("/confirm-phone-verification", confirmPhoneVerification);
router.post("/discard-unverified-registration", discardUnverifiedRegistration);

router.put("/update-username", verifyToken, updateUsername);
router.put("/change-password", verifyToken, changePassword);

module.exports = router;
