const fs = require("node:fs");
const path = require("node:path");

const environmentFile = process.env.ANIMUA_ENV_FILE || ".env.test";
const environmentPath = path.resolve(__dirname, "..", environmentFile);

if (!fs.existsSync(environmentPath)) {
  throw new Error(
    `Hosted Functionality Testing requires ${environmentFile}. Copy backend/.env.test.example first.`
  );
}

process.env.ANIMUA_ENV_FILE = environmentFile;
process.env.APP_ENVIRONMENT = "functionality-testing";

require("../server");
