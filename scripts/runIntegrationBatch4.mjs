import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = path.resolve(scriptDirectory, "..");
const backendDirectory = path.join(repositoryDirectory, "backend");
const require = createRequire(import.meta.url);
const dotenv = require(path.join(backendDirectory, "node_modules/dotenv"));
const cypressCli = path.join(repositoryDirectory, "node_modules", "cypress", "bin", "cypress");
const requestedSpec = process.argv[2] || "cypress/e2e/integration/batch-4/**/*.cy.js";
const ownedProcesses = [];

dotenv.config({ path: path.join(backendDirectory, ".env.test"), override: false });
dotenv.config({ path: path.join(repositoryDirectory, "frontend", ".env.test"), override: false });

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function readBackend() {
  try {
    const response = await fetch("http://127.0.0.1:5000/", {
      signal: AbortSignal.timeout(3000),
    });
    return { ok: response.ok, body: await response.text() };
  } catch (_error) {
    return null;
  }
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

async function ensureBackend() {
  const existing = await readBackend();
  if (existing?.ok && existing.body === "ANIMUA Backend is Live!") {
    console.log("Backend check: ready (existing process). ");
    return;
  }
  if (existing) throw new Error("Port 5000 is occupied by a process that is not the ANIMUA test backend.");

  start(process.execPath, ["scripts/startFunctionalityEnvironment.js"], {
    cwd: backendDirectory,
    env: { ANIMUA_ENV_FILE: ".env.test", APP_ENVIRONMENT: "functionality-testing" },
  });
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const response = await readBackend();
    if (response?.ok && response.body === "ANIMUA Backend is Live!") {
      console.log("Backend check: ready (task-owned process). ");
      return;
    }
    await delay(500);
  }
  throw new Error("ANIMUA test backend did not become ready within 60000 ms.");
}

async function stopOwnedProcesses() {
  for (const child of ownedProcesses.reverse()) {
    if (child.exitCode === null && !child.killed) child.kill("SIGTERM");
  }
  await delay(500);
}

async function main() {
  try {
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
