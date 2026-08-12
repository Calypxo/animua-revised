const express = require("express");
const router = express.Router();
const controller = require("../controllers/matchController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/roleMiddleware");

router.post("/match", authenticateToken, authorizeRole("Public"), controller.matchPets);
router.get("/match/eligibility", authenticateToken, authorizeRole("Public"), controller.getEligibility);
router.get("/match/my-latest-result", authenticateToken, authorizeRole("Public"), controller.getMyLatestResult);
router.get("/match/my-results", authenticateToken, authorizeRole("Public"), controller.getMyResults);
router.get("/match/questions", authenticateToken, authorizeRole("Public"), controller.getQuizQuestions);
router.get("/match/admin/settings", authenticateToken, authorizeRole("Admin", "Staff", "Veterinarian"), controller.getAdminSettings);
router.put("/match/admin/settings", authenticateToken, authorizeRole("Admin"), controller.updateAdminSettings);
router.get("/match/admin/results", authenticateToken, authorizeRole("Admin", "Staff", "Veterinarian"), controller.getAdminResults);
router.get("/match/admin/results/:resultId", authenticateToken, authorizeRole("Admin", "Staff", "Veterinarian"), controller.getAdminResult);
router.get("/match/admin/questions", authenticateToken, authorizeRole("Admin", "Staff", "Veterinarian"), controller.getAdminQuestions);
router.put("/match/admin/questions", authenticateToken, authorizeRole("Admin"), controller.replaceAdminQuestions);
router.patch("/match/admin/users/:userId/retake-date", authenticateToken, authorizeRole("Admin"), controller.setRetakeOverride);
router.delete("/match/admin/users/:userId/retake-date", authenticateToken, authorizeRole("Admin"), controller.removeRetakeOverride);

module.exports = router;
