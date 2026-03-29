const express = require("express");
const router = express.Router();

const { createAdoptionRequest } = require("../controllers/adoptionController");
const { getAdoptionRequests } = require("../controllers/adoptionController");
const { updateAdoptionRequest } = require("../controllers/adoptionController");
const { deleteAdoptionRequest } = require("../controllers/adoptionController");


// PUBLIC route (no auth)
router.post("/", createAdoptionRequest);

// ADMIN route (you can protect later)
router.get("/", getAdoptionRequests);

router.put("/:id", updateAdoptionRequest);
router.delete("/:id", deleteAdoptionRequest);

module.exports = router;