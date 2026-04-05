const predictiveService = require("../services/predictiveService");

async function getStatus(req, res) {
  try {
    const status = predictiveService.getModelStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

async function getItems(req, res) {
  try {
    const items = predictiveService.getInventoryItems();
    res.json(items);
  } catch (error) {
    const statusCode = error.message.includes("not trained") ? 400 : 500;

    res.status(statusCode).json({
      success: false,
      message: error.message
    });
  }
}

module.exports = {
  getStatus,
  getItems
};