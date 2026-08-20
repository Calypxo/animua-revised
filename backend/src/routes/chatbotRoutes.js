const express = require("express");
const router = express.Router();
const { sendChatbotMessage } = require("../controllers/chatbotController");
const authenticateToken = require("../middleware/authMiddleware");
const { getSessionCookieToken } = require("../utils/sessionCookie");

function optionalAuthenticateToken(req, res, next) {
  if (!req.headers.authorization && !getSessionCookieToken(req)) {
    return next();
  }

  return authenticateToken(req, res, next);
}

router.post("/message", optionalAuthenticateToken, sendChatbotMessage);

module.exports = router;
