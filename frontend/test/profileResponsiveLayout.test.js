import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homeMarkup = readFileSync(
  new URL("../pages/public/home.html", import.meta.url),
  "utf8",
);
const publicUiScript = readFileSync(
  new URL("../src/public/js/public-ui.js", import.meta.url),
  "utf8",
);
const lightweightProfileScript = readFileSync(
  new URL("../src/public/js/lightweight-profile.js", import.meta.url),
  "utf8",
);
const globalStyles = readFileSync(
  new URL("../src/css/global.css", import.meta.url),
  "utf8",
);

test("profile markup keeps password and notification settings available", () => {
  for (const source of [homeMarkup, publicUiScript, lightweightProfileScript]) {
    assert.match(source, /id="profilePasswordBtn"/);
    assert.match(source, /id="profileNotificationsBtn"/);
    assert.doesNotMatch(source, /profile-modal-card--compact/);
    assert.doesNotMatch(source, /style="width:\s*min\(640px/);
  }
  assert.match(lightweightProfileScript, /data-profile-action="password"/);
  assert.match(lightweightProfileScript, /data-profile-action="notifications"/);
  assert.match(publicUiScript, /openPendingProfileAction/);
});

test("profile layout preserves the original stack and phone scrolling", () => {
  assert.match(
    globalStyles,
    /#profileModal\.profile-modal-overlay \.profile-modal-card[\s\S]*?width:\s*min\(640px,[\s\S]*?max-width:\s*640px/,
  );
  assert.doesNotMatch(
    globalStyles,
    /@media \(min-width: 761px\)\s*\{\s*#profileModal \.profile-form/,
  );
  assert.match(
    globalStyles,
    /@media \(max-width: 760px\)[\s\S]*?#profileModal\.profile-modal-overlay[\s\S]*?\.profile-modal-card[\s\S]*?overflow-y:\s*auto\s*!important/,
  );
});
