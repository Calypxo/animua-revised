import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const homeMarkup = readFileSync(
  new URL("../pages/public/home.html", import.meta.url),
  "utf8",
);
const globalStyles = readFileSync(
  new URL("../src/css/global.css", import.meta.url),
  "utf8",
);

test("phone header keeps the notification bell visible and tappable", () => {
  assert.match(
    homeMarkup,
    /class="notification-btn" id="notificationBtn" aria-label="Notifications"/,
  );
  assert.match(
    globalStyles,
    /Phone header: keep notifications[\s\S]*?@media \(max-width: 760px\)[\s\S]*?\.notification-wrap[\s\S]*?display:\s*block\s*!important[\s\S]*?\.notification-btn[\s\S]*?display:\s*inline-grid\s*!important/,
  );
  assert.match(
    globalStyles,
    /Phone header: keep notifications[\s\S]*?\.notification-btn[\s\S]*?border:\s*0\s*!important;[\s\S]*?background:\s*transparent\s*!important;[\s\S]*?box-shadow:\s*none\s*!important/,
  );
  assert.match(
    globalStyles,
    /@media \(max-width: 430px\)[\s\S]*?\.notification-wrap,[\s\S]*?\.notification-btn[\s\S]*?width:\s*40px\s*!important/,
  );
});
