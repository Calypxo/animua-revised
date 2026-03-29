const express = require("express");
const router = express.Router();
const { getPublicPets } = require("../controllers/publicController");

router.get("/pets", getPublicPets);

module.exports = router;