const express = require("express");
const router = express.Router();
const predictiveController = require("../controllers/predictiveController");

router.get("/status", predictiveController.getStatus);
router.get("/items", predictiveController.getItems);

module.exports = router;