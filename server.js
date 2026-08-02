const { spawn } = require("node:child_process");
const path = require("node:path");

const backendDir = path.join(__dirname, "backend");
const child = spawn(process.execPath, ["server.js"], {
  cwd: backendDir,
  stdio: "inherit",
  windowsHide: true,
});

child.on("exit", (code) => process.exit(code));
child.on("error", (error) => {
  console.error("Failed to start backend/server.js:", error);
  process.exit(1);
});

process.on("SIGINT", () => {
  child.kill("SIGTERM");
  process.exit(0);
});

process.on("SIGTERM", () => {
  child.kill("SIGTERM");
  process.exit(0);
});
