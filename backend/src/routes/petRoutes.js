const express = require("express");
const router = express.Router();

const {
  getPets,
  addPet,
  updatePet,
  deletePet
} = require("../controllers/petController");

const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/roleMiddleware");

// PROTECTED ROUTES
router.get("/", authenticateToken, getPets);
router.post("/", authenticateToken, authorizeRole("Admin", "Staff"), addPet);
router.put("/:id", authenticateToken, authorizeRole("Admin", "Staff"), updatePet);
router.delete("/:id", authenticateToken, authorizeRole("Admin"), deletePet);

module.exports = router;