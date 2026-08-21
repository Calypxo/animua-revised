import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = path.resolve(scriptDirectory, "..");
const useExamples = process.argv.includes("--examples");
const suffix = useExamples ? ".env.test.example" : ".env.test";

function parseEnvironmentFile(relativePath) {
  const absolutePath = path.join(repositoryDirectory, relativePath);
  if (!fs.existsSync(absolutePath)) return { exists: false, values: {} };

  const values = {};
  for (const rawLine of fs.readFileSync(absolutePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return { exists: true, values };
}

function environmentValue(fileValues, name) {
  return String(process.env[name] ?? fileValues[name] ?? "").trim();
}

function looksLikePlaceholder(value) {
  return (
    !value ||
    /^<.+>$/.test(value) ||
    /^(your|replace-with|firebase-adminsdk@example)/i.test(value) ||
    value.includes("<ft-")
  );
}

function valuePresent(value) {
  return useExamples ? Boolean(value) : !looksLikePlaceholder(value);
}

function allPresent(values, names) {
  return names.every((name) => valuePresent(environmentValue(values, name)));
}

const publicEnvironment = parseEnvironmentFile(`frontend/${suffix}`);
const managementEnvironment = parseEnvironmentFile(`admin-frontend/${suffix}`);
const backendEnvironment = parseEnvironmentFile(`backend/${suffix}`);

const publicValues = publicEnvironment.values;
const managementValues = managementEnvironment.values;
const backendValues = backendEnvironment.values;
const frontendFirebaseVariables = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FUNCTIONALITY_TEST_PROJECT_ID",
];
const backendFirebaseVariables = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_STORAGE_BUCKET",
  "FUNCTIONALITY_TEST_PROJECT_ID",
  "JWT_SECRET",
];

const publicComplete = publicEnvironment.exists &&
  allPresent(publicValues, frontendFirebaseVariables);
const managementComplete = managementEnvironment.exists &&
  allPresent(managementValues, frontendFirebaseVariables);
const backendComplete = backendEnvironment.exists &&
  allPresent(backendValues, backendFirebaseVariables);
const captchaPresent = valuePresent(
  environmentValue(publicValues, "VITE_RECAPTCHA_SITE_KEY")
) && valuePresent(environmentValue(backendValues, "RECAPTCHA_SECRET_KEY"));
const emailPassword = environmentValue(backendValues, "EMAIL_PASS") ||
  environmentValue(backendValues, "EMAIL_APP_PASSWORD") ||
  environmentValue(backendValues, "SMTP_PASS");
const emailPresent = valuePresent(environmentValue(backendValues, "EMAIL_USER")) &&
  valuePresent(emailPassword);

const environmentNames = [
  environmentValue(publicValues, "VITE_APP_ENVIRONMENT"),
  environmentValue(managementValues, "VITE_APP_ENVIRONMENT"),
  environmentValue(backendValues, "APP_ENVIRONMENT"),
];
const environmentCorrect = environmentNames.every(
  (value) => value.toLowerCase() === "functionality-testing"
);
const projectIds = [
  environmentValue(publicValues, "VITE_FIREBASE_PROJECT_ID"),
  environmentValue(publicValues, "VITE_FUNCTIONALITY_TEST_PROJECT_ID"),
  environmentValue(managementValues, "VITE_FIREBASE_PROJECT_ID"),
  environmentValue(managementValues, "VITE_FUNCTIONALITY_TEST_PROJECT_ID"),
  environmentValue(backendValues, "FIREBASE_PROJECT_ID"),
  environmentValue(backendValues, "FUNCTIONALITY_TEST_PROJECT_ID"),
];
const nonEmptyProjectIds = projectIds.filter(Boolean);
const projectId = nonEmptyProjectIds[0] || "Not configured";
const projectIdsMatch = nonEmptyProjectIds.length === projectIds.length &&
  nonEmptyProjectIds.every((value) => value === projectId);
const emulatorEnabled = [
  environmentValue(publicValues, "VITE_USE_FIREBASE_EMULATORS") === "true",
  environmentValue(managementValues, "VITE_USE_FIREBASE_EMULATORS") === "true",
  Boolean(environmentValue(backendValues, "FIRESTORE_EMULATOR_HOST")),
  Boolean(environmentValue(backendValues, "FIREBASE_AUTH_EMULATOR_HOST")),
  Boolean(environmentValue(backendValues, "FIREBASE_STORAGE_EMULATOR_HOST")),
].some(Boolean);
const localUrlsCorrect =
  environmentValue(publicValues, "VITE_API_BASE_URL") ===
    "http://127.0.0.1:5000/api" &&
  environmentValue(managementValues, "VITE_API_BASE_URL") ===
    "http://127.0.0.1:5000/api" &&
  environmentValue(backendValues, "PORT") === "5000";

const errors = [];
if (!publicComplete) errors.push("Public Firebase configuration is incomplete.");
if (!managementComplete) errors.push("Management Firebase configuration is incomplete.");
if (!backendComplete) errors.push("Backend Firebase configuration is incomplete.");
if (!environmentCorrect) errors.push("All applications must select functionality-testing mode.");
if (!projectIdsMatch) errors.push("Active and safety Firebase project IDs do not all match.");
if (emulatorEnabled) errors.push("Firebase Emulator mode must be disabled for hosted FT.");
if (!captchaPresent) errors.push("CAPTCHA configuration is incomplete.");
if (!emailPresent) errors.push("OTP email configuration is incomplete.");
if (!localUrlsCorrect) errors.push("The local Functionality Testing URLs are incomplete or incorrect.");

console.log(`Environment: ${environmentCorrect ? "Functionality Testing" : "Incomplete"}`);
console.log(`Firebase Project: ${projectId}`);
console.log(`Firebase Emulator: ${emulatorEnabled ? "Enabled" : "Disabled"}`);
console.log(`Public Firebase Config: ${publicComplete ? "Complete" : "Incomplete"}`);
console.log(`Management Firebase Config: ${managementComplete ? "Complete" : "Incomplete"}`);
console.log(`Backend Firebase Config: ${backendComplete ? "Complete" : "Incomplete"}`);
console.log(`CAPTCHA Config: ${captchaPresent ? "Present" : "Missing"}`);
console.log(`OTP Email Config: ${emailPresent ? "Present" : "Missing"}`);
console.log(`Local API URLs: ${localUrlsCorrect ? "Correct" : "Incorrect"}`);
console.log(`Safety Guard: ${projectIdsMatch && !emulatorEnabled ? "Valid" : "Invalid"}`);

if (errors.length) {
  console.error("Configuration Check: FAILED");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log("Configuration Check: PASSED");
}
