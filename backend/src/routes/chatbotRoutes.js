const express = require("express");
const router = express.Router();
const { sendChatbotMessage } = require("../controllers/chatbotController");
const authenticateToken = require("../middleware/authMiddleware");

function optionalAuthenticateToken(req, res, next) {
  if (!req.headers.authorization) {
    return next();
  }

  return authenticateToken(req, res, next);
}

router.post("/message", optionalAuthenticateToken, sendChatbotMessage);

module.exports = router;
