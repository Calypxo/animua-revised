import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryDir = path.resolve(scriptDir, "..");
const children = [];
let shuttingDown = false;

const emulatorEnv = {
  ...process.env,
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
  GCLOUD_PROJECT: "demo-animua",
  FIREBASE_PROJECT_ID: "demo-animua",
  JWT_SECRET: process.env.JWT_SECRET || "animua-local-emulator-secret",
};

function findJavaExecutable() {
  const pathCheck = spawnSync("java", ["-version"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (!pathCheck.error && pathCheck.status === 0) return "java";

  if (process.platform === "win32") {
    const adoptiumRoot = "C:\\Program Files\\Eclipse Adoptium";
    if (fs.existsSync(adoptiumRoot)) {
      const installations = fs.readdirSync(adoptiumRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
        .reverse();
      for (const installation of installations) {
        const executable = path.join(adoptiumRoot, installation, "bin", "java.exe");
        if (fs.existsSync(executable)) return executable;
      }
    }
  }

  return null;
}

function start(label, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd || repositoryDir,
    env: options.env || process.env,
    stdio: "inherit",
    windowsHide: true,
    shell: options.shell || false,
  });
  child.label = label;
  children.push(child);
  child.on("exit", (code) => {
    if (!shuttingDown && code) {
      console.error(`${label} exited with code ${code}.`);
      shutdown(code);
    }
  });
  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = exitCode;
  for (const child of children) {
    if (child.killed) continue;
    if (process.platform === "win32" && child.pid) {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
    } else {
      child.kill("SIGTERM");
    }
  }
  setTimeout(() => process.exit(exitCode), 500);
}

function waitForPort(port, timeoutMs = 300_000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`Timed out waiting for local service on port ${port}.`));
          return;
        }
        setTimeout(tryConnect, 500);
      });
    };
    tryConnect();
  });
}

function runSeed() {
  const seedScript = path.join(repositoryDir, "backend", "scripts", "seedEmulator.js");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [seedScript], {
      cwd: repositoryDir,
      env: emulatorEnv,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Emulator seed exited with code ${code}.`));
    });
    child.once("error", reject);
  });
}

function firebaseCommand() {
  const globalCli = process.env.APPDATA
    ? path.join(
        process.env.APPDATA,
        "npm",
        "node_modules",
        "firebase-tools",
        "lib",
        "bin",
        "firebase.js"
      )
    : "";
  if (globalCli && fs.existsSync(globalCli)) {
    return { command: process.execPath, args: [globalCli], shell: false };
  }
  return { command: "firebase", args: [], shell: process.platform === "win32" };
}

async function main() {
  const javaExecutable = findJavaExecutable();
  if (!javaExecutable) {
    throw new Error(
      "Java JDK 21 is required for the Firestore emulator. Install it, then run this command again."
    );
  }

  const javaCheck = spawnSync(javaExecutable, ["-version"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (javaCheck.error || javaCheck.status !== 0) {
    throw new Error(
      "Java JDK 21 is required for the Firestore emulator. Install it, then run this command again."
    );
  }
  if (javaExecutable !== "java") {
    const javaBin = path.dirname(javaExecutable);
    emulatorEnv.JAVA_HOME = path.dirname(javaBin);
    emulatorEnv.PATH = `${javaBin}${path.delimiter}${emulatorEnv.PATH || ""}`;
  }

  const firebase = firebaseCommand();
  start(
    "Firebase Emulator Suite",
    firebase.command,
    [
      ...firebase.args,
      "emulators:start",
      "--only",
      "auth,firestore,storage",
      "--project",
      "demo-animua",
    ],
    { env: emulatorEnv, shell: firebase.shell }
  );

  await Promise.all([waitForPort(8080), waitForPort(9099), waitForPort(9199)]);
  await runSeed();

  start(
    "Backend",
    process.execPath,
    [path.join(repositoryDir, "backend", "scripts", "dev.js"), "--emulators"],
    { env: emulatorEnv }
  );
  start(
    "Public frontend",
    process.execPath,
    [
      path.join(repositoryDir, "frontend", "node_modules", "vite", "bin", "vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      "5173",
      "--strictPort",
    ],
    { cwd: path.join(repositoryDir, "frontend") }
  );
  start(
    "Management frontend",
    process.execPath,
    [
      path.join(repositoryDir, "admin-frontend", "node_modules", "vite", "bin", "vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      "5174",
      "--strictPort",
    ],
    { cwd: path.join(repositoryDir, "admin-frontend") }
  );

  await Promise.all([waitForPort(5000), waitForPort(5173), waitForPort(5174)]);

  console.log("Public site: http://127.0.0.1:5173/");
  console.log("Management site: http://127.0.0.1:5174/");
  console.log("Local Firebase UI: http://127.0.0.1:4000");
  console.log("Management login: admin@animua.test / AnimuaDev123!");
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

main().catch((error) => {
  console.error(error.message);
  shutdown(1);
});
