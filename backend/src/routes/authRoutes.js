const express = require("express");
const router  = express.Router();
const {
  register,
  login,
  logout,
  requestEmailVerificationOtp,
  confirmEmailVerificationOtp,
  requestPasswordChangeOtp,
  confirmPasswordChangeOtp,
  requestForgotPasswordOtp,
  confirmForgotPasswordOtp,
  requestManagementPasswordResetOtp,
  verifyManagementPasswordResetOtp,
  completeManagementPasswordReset,
  confirmPhoneVerification,
  syncEmailVerification,
  discardUnverifiedRegistration,
  getCurrentAccount,
  updateUsername,
  changePassword
} = require("../controllers/authController");
const verifyToken = require("../middleware/authMiddleware");

// Public routes — no token needed
router.post("/register", register);
router.post("/login",    login);
router.post("/logout",   logout);
router.post("/request-email-verification-otp", requestEmailVerificationOtp);
router.post("/confirm-email-verification-otp", confirmEmailVerificationOtp);
router.post("/request-forgot-password-otp", requestForgotPasswordOtp);
router.post("/confirm-forgot-password-otp", confirmForgotPasswordOtp);
router.post("/management/request-password-reset-otp", requestManagementPasswordResetOtp);
router.post("/management/verify-password-reset-otp", verifyManagementPasswordResetOtp);
router.post("/management/reset-password", completeManagementPasswordReset);
router.post("/confirm-phone-verification", confirmPhoneVerification);
router.post("/sync-email-verification", syncEmailVerification);
router.post("/discard-unverified-registration", discardUnverifiedRegistration);

router.put("/update-username", verifyToken, updateUsername);
router.put("/change-password", verifyToken, changePassword);
router.post("/request-password-change-otp", verifyToken, requestPasswordChangeOtp);
router.post("/confirm-password-change-otp", verifyToken, confirmPasswordChangeOtp);
router.get("/account", verifyToken, getCurrentAccount);
router.patch("/account/profile", verifyToken, updateUsername);
router.patch("/account/password", verifyToken, changePassword);

module.exports = router;
