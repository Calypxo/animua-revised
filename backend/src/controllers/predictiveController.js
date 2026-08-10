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

async function predictLiveItems(req, res) {
  try {
    const items = req.body?.items;
    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: "items must be an array of live inventory records.",
      });
    }
    if (items.length > 500) {
      return res.status(400).json({
        success: false,
        message: "A maximum of 500 inventory items can be predicted at once.",
      });
    }
    return res.json(predictiveService.predictLiveInventoryItems(items));
  } catch (error) {
    const statusCode = error.code === "MODEL_NOT_TRAINED" ? 503 : 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  getStatus,
  getItems,
  predictLiveItems,
};
