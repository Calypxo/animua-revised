import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const command = process.argv[2] === "build" ? "build" : "dev";
const projectDirectory = process.cwd();
const environmentPath = path.join(projectDirectory, ".env.test");
const requiredProcessVariables = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FUNCTIONALITY_TEST_PROJECT_ID",
];
const completeProcessEnvironment =
  process.env.VITE_APP_ENVIRONMENT === "functionality-testing" &&
  requiredProcessVariables.every((name) => String(process.env[name] || "").trim());

if (!fs.existsSync(environmentPath) && !completeProcessEnvironment) {
  console.error(
    `Hosted Functionality Testing requires ${environmentPath}. ` +
      "Copy the tracked .env.test.example file and run the configuration checker first."
  );
  process.exit(1);
}

const viteCli = path.join(projectDirectory, "node_modules", "vite", "bin", "vite.js");
if (!fs.existsSync(viteCli)) {
  console.error(`Vite is not installed in ${projectDirectory}.`);
  process.exit(1);
}

const child = spawnSync(
  process.execPath,
  [viteCli, command, "--mode", "test"],
  {
    cwd: projectDirectory,
    env: {
      ...process.env,
      VITE_APP_ENVIRONMENT: "functionality-testing",
    },
    stdio: "inherit",
    windowsHide: true,
  }
);

if (child.error) {
  console.error(child.error.message);
  process.exit(1);
}

process.exit(child.status ?? 1);
