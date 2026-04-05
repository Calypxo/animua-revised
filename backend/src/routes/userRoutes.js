// backend/src/routes/userRoutes.js
const express    = require("express");
const router     = express.Router();
const controller = require("../controllers/userController");

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole     = require("../middleware/roleMiddleware");

// All user management routes require:
//   1. valid JWT (authenticateToken)
//   2. Admin role (authorizeRole)

router.use(authenticateToken);
router.use(authorizeRole("Admin"));

// GET  /api/users          → list all users
router.get("/",             controller.getAllUsers);

// GET  /api/users/:id      → get single user
router.get("/:id",          controller.getUserById);

// POST /api/users          → create new user
router.post("/",            controller.createUser);

// PUT  /api/users/:id      → update user details + permissions
router.put("/:id",          controller.updateUser);

// PATCH /api/users/:id/toggle-status → activate / deactivate
router.patch("/:id/toggle-status", controller.toggleUserStatus);

// PATCH /api/users/:id/reset-password → admin resets a user's password
router.patch("/:id/reset-password", controller.resetPassword);

module.exports = router;