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

test("event notifications show a concise preview instead of the full event description", () => {
  const sharedSource = read("src/public/js/public-notifications.js");
  const homeSource = read("src/public/js/public-ui.js");

  for (const source of [sharedSource, homeSource]) {
    assert.match(
      source,
      /function isEventNotification\(item = \{\}\)[\s\S]*?category === "event" \|\| type\.includes\("event"\)/,
    );
    assert.match(
      source,
      /function getNotificationPreviewMessage\(item = \{\}\)[\s\S]*?isEventNotification\(item\)[\s\S]*?Event announcement — tap to view details\./,
    );
    assert.match(
      source,
      /\$\{getNotificationPreviewMessage\(item\)[\s\S]*?notification-event-preview[\s\S]*?escapeHtml(?:Text)?\(getNotificationPreviewMessage\(item\)\)/,
    );
  }
});

test("event notification preview uses lighter supporting text", () => {
  const styles = read("src/css/global.css");

  assert.match(
    styles,
    /\.notification-item-copy small\.notification-event-preview\s*\{[\s\S]*?color:\s*rgba\(38, 27, 23, 0\.48\);[\s\S]*?font-weight:\s*600;/,
  );
});
