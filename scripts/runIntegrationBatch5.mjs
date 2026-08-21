import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = path.resolve(scriptDirectory, "..");
const backendDirectory = path.join(repositoryDirectory, "backend");
const matcherDirectory = path.join(repositoryDirectory, "backend-python");
const pythonPath = path.join(
  repositoryDirectory,
  "animua-sentiment-service",
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
);
const require = createRequire(import.meta.url);
const dotenv = require(path.join(backendDirectory, "node_modules/dotenv"));
const cypressCli = path.join(repositoryDirectory, "node_modules", "cypress", "bin", "cypress");
const requestedSpec = process.argv[2] || "cypress/e2e/integration/batch-5/**/*.cy.js";
const ownedProcesses = [];

dotenv.config({ path: path.join(backendDirectory, ".env.test"), override: false });

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function readService(url, timeoutMs = 3000) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    const text = await response.text();
    let body = text;
    try { body = JSON.parse(text); } catch (_error) { /* Plain-text backend health response. */ }
    return { ok: response.ok, status: response.status, body };
  } catch (_error) {
    return null;
  }
}

async function waitFor(url, predicate, label, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await readService(url);
    if (response && predicate(response)) return response;
    await delay(500);
  }
  throw new Error(`${label} did not become ready within ${timeoutMs} ms.`);
}

function start(command, args, options = {}) {
  const childEnvironment = { ...process.env, ...options.env };
  for (const name of options.removeEnv || []) delete childEnvironment[name];
  const child = spawn(command, args, {
    cwd: options.cwd || repositoryDirectory,
    env: childEnvironment,
    stdio: "inherit",
    windowsHide: true,
  });
  ownedProcesses.push(child);
  return child;
}

async function ensureCompatibilityService() {
  const existing = await readService("http://127.0.0.1:8001/");
  if (existing?.ok && existing.body?.service === "Animua Python Matcher") {
    console.log("Compatibility check: ready (existing process). ");
    return;
  }
  if (existing) throw new Error("Port 8001 is occupied by a process that is not the ANIMUA Python matcher.");
  if (!fs.existsSync(pythonPath)) throw new Error(`Python environment is missing at ${pythonPath}.`);

  start(pythonPath, [
    "-B", "-m", "uvicorn", "--app-dir", matcherDirectory,
    "app:app", "--host", "127.0.0.1", "--port", "8001",
  ], { env: { PYTHONDONTWRITEBYTECODE: "1" } });
  await waitFor(
    "http://127.0.0.1:8001/",
    (response) => response.ok && response.body?.service === "Animua Python Matcher",
    "Python compatibility service",
  );
  console.log("Compatibility check: ready (task-owned process). ");
}

async function ensureBackend() {
  const existing = await readService("http://127.0.0.1:5000/");
  if (existing?.ok && existing.body === "ANIMUA Backend is Live!") {
    console.log("Backend check: ready (existing process). ");
    return;
  }
  if (existing) throw new Error("Port 5000 is occupied by a process that is not the ANIMUA test backend.");

  start(process.execPath, ["scripts/startFunctionalityEnvironment.js"], {
    cwd: backendDirectory,
    env: {
      ANIMUA_ENV_FILE: ".env.test",
      APP_ENVIRONMENT: "functionality-testing",
      PYTHON_MATCHER_URL: "http://127.0.0.1:8001/score",
    },
  });
  await waitFor(
    "http://127.0.0.1:5000/",
    (response) => response.ok && response.body === "ANIMUA Backend is Live!",
    "ANIMUA test backend",
  );
  console.log("Backend check: ready (task-owned process). ");
}

async function stopOwnedProcesses() {
  for (const child of ownedProcesses.reverse()) {
    if (child.exitCode === null && !child.killed) child.kill("SIGTERM");
  }
  await delay(500);
}

async function main() {
  try {
    await ensureCompatibilityService();
    await ensureBackend();
    const cypress = start(process.execPath, [
      cypressCli,
      "run",
      "--config", "baseUrl=http://127.0.0.1:5000",
      "--spec", requestedSpec,
    ], { removeEnv: ["ELECTRON_RUN_AS_NODE"] });
    const exitCode = await new Promise((resolve, reject) => {
      cypress.once("error", reject);
      cypress.once("exit", (code) => resolve(code ?? 1));
    });
    if (exitCode !== 0) process.exitCode = exitCode;
  } finally {
    await stopOwnedProcesses();
  }
}

process.once("SIGINT", () => {
  stopOwnedProcesses().finally(() => process.exit(130));
});
process.once("SIGTERM", () => {
  stopOwnedProcesses().finally(() => process.exit(143));
});

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
