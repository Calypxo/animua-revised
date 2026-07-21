const express = require("express");
const router = express.Router();
const { sendChatbotMessage } = require("../controllers/chatbotController");

router.post("/message", sendChatbotMessage);

module.exports = router;
