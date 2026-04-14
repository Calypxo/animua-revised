const express = require("express");
const router = express.Router();
const { matchPets } = require("../controllers/matchController");

router.post("/match", matchPets);

module.exports = router;