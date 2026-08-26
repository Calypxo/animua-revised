import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(testDir, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(frontendDir, relativePath), "utf8");
}

test("every secondary public header initializes the shared notification inbox", () => {
  const scripts = [
    "src/public/js/account-ui.js",
    "src/public/js/announcements-ui.js",
    "src/public/js/contact-ui.js",
    "src/public/js/find-furbabies-ui.js",
    "src/public/js/surrender-ui.js",
  ];

  for (const script of scripts) {
    const source = read(script);
    assert.match(source, /import \{ initializePublicNotifications \} from "\.\/public-notifications\.js";/);
    assert.match(source, /initializePublicNotifications\(\);/);
  }
});

test("shared notifications restore unread count and keep read state server-backed", () => {
  const source = read("src/public/js/public-notifications.js");

  assert.match(source, /\/notifications\?audience=public/);
  assert.match(source, /updatePublicNotificationBadge\(unreadCount\)/);
  assert.match(source, /\/notifications\/read\?audience=public/);
  assert.match(source, /safeCount > 0 \? `Notifications, \$\{safeCount\} unread`/);
});
