const express = require("express");
const controller = require("../controllers/inventoryController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/roleMiddleware");

const router = express.Router();

router.use(authenticateToken);

router.get("/", authorizeRole("Admin", "Staff", "Veterinarian"), controller.listInventoryItems);
router.post("/", authorizeRole("Admin", "Staff"), controller.createInventoryItem);
router.get("/:id", authorizeRole("Admin", "Staff", "Veterinarian"), controller.getInventoryItem);
router.put("/:id", authorizeRole("Admin", "Staff"), controller.updateInventoryItem);
router.post("/:id/stock-in", authorizeRole("Admin", "Staff"), controller.stockIn);
router.post("/:id/stock-out", authorizeRole("Admin", "Staff"), controller.stockOut);
router.get(
  "/:id/transactions",
  authorizeRole("Admin", "Staff", "Veterinarian"),
  controller.listInventoryTransactions
);

module.exports = router;
