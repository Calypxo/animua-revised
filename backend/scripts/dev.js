const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

const backendDir = path.resolve(__dirname, "..");
const repositoryDir = path.resolve(backendDir, "..");
const sentimentDir = path.join(repositoryDir, "animua-sentiment-service");
const pythonPath = path.join(
  sentimentDir,
  ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python"
);
const sentimentPort = 8002;

const children = [];
let shuttingDown = false;
const useFirebaseEmulators = process.argv.includes("--emulators");
const firebaseEmulatorEnv = useFirebaseEmulators
  ? {
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
      FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
      GCLOUD_PROJECT: "demo-animua",
      FIREBASE_PROJECT_ID: "demo-animua",
      JWT_SECRET: process.env.JWT_SECRET || "animua-local-emulator-secret",
    }
  : {};

function start(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd || backendDir,
    env: { ...process.env, ...options.env },
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(child);
  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(exitCode), 300).unref();
}

function isPortAvailable(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (error) => {
      server.close(() => resolve(false));
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function startSentimentService() {
  if (!fs.existsSync(pythonPath)) {
    console.warn(
      `Tagalog sentiment environment not found at ${pythonPath}. ` +
        "Surrender submissions will use the Node fallback."
    );
    return;
  }

  const portAvailable = await isPortAvailable(sentimentPort);
  if (!portAvailable) {
    console.log(
      `Sentiment service port ${sentimentPort} is already in use; ` +
        "assuming an existing service is available."
    );
    return;
  }

  const sentiment = start(
    pythonPath,
    [
      "-B",
      "-m",
      "uvicorn",
      "--app-dir",
      sentimentDir,
      "app:app",
      "--host",
      "127.0.0.1",
      "--port",
      `${sentimentPort}`,
    ],
    {
      cwd: repositoryDir,
      env: { PYTHONDONTWRITEBYTECODE: "1" },
    }
  );

  sentiment.on("exit", (code) => {
    if (!shuttingDown && code) {
      console.warn(
        `Tagalog sentiment service exited with code ${code}. ` +
          "Surrender submissions will use the Node fallback."
      );
    }
  });
}

function createBackendProcess() {
  const nodemonPath = require.resolve("nodemon/bin/nodemon.js");
  if (process.platform === "win32") {
    console.warn(
      "Windows detected: starting backend with node server.js instead of nodemon to avoid Windows process-tree issues."
    );
    return start(process.execPath, ["server.js"], {
      env: firebaseEmulatorEnv,
    });
  }

  if (useFirebaseEmulators) {
    console.log("Backend is using the local Firebase emulators (demo-animua).");
  }
  return start(process.execPath, [nodemonPath, "server.js"], {
    env: firebaseEmulatorEnv,
  });
}

(async () => {
  await startSentimentService();

  const backend = createBackendProcess();
  backend.on("exit", (code) => shutdown(code || 0));

  process.on("SIGINT", () => shutdown(0));
  process.on("SIGTERM", () => shutdown(0));
})();
