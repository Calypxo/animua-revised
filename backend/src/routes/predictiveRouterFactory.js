const express = require("express");

function createPredictiveRouter({ authenticate, authorize, controller }) {
  const router = express.Router();
  router.use(authenticate);
  router.use(authorize("Admin", "Staff", "Veterinarian"));
  router.get("/status", controller.getStatus);
  router.get("/items", controller.getItems);
  router.post("/items", controller.predictLiveItems);
  return router;
}

module.exports = { createPredictiveRouter };
