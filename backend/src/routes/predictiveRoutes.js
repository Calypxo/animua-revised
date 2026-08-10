const predictiveController = require("../controllers/predictiveController");
const authenticateToken = require("../middleware/authMiddleware");
const authorizeRole = require("../middleware/roleMiddleware");
const { createPredictiveRouter } = require("./predictiveRouterFactory");

module.exports = createPredictiveRouter({
  authenticate: authenticateToken,
  authorize: authorizeRole,
  controller: predictiveController,
});
