import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const globalStyles = readFileSync(
  new URL("../src/css/global.css", import.meta.url),
  "utf8",
);
const furbabiesStyles = readFileSync(
  new URL("../src/css/public/furbabies.css", import.meta.url),
  "utf8",
);
const surrenderStyles = readFileSync(
  new URL("../src/css/public/surrender.css", import.meta.url),
  "utf8",
);

test("composite public text fields put the accessibility ring on the full control", () => {
  const compositeFields = [
    ".auth-field",
    ".chatbot-search-field",
    ".contact-thread-reply-field",
    ".search-box",
    ".profile-info-row",
  ];

  for (const field of compositeFields) {
    assert.match(
      globalStyles,
      new RegExp(`Composite text controls[\\s\\S]*?${field.replace(".", "\\.")}[\\s\\S]*?:focus-within`),
      `${field} must receive the full-control focus ring`,
    );
  }

  assert.match(
    globalStyles,
    /\.search-box > input:focus-visible[\s\S]*?outline:\s*none\s*!important;[\s\S]*?box-shadow:\s*none\s*!important;/,
  );
});

test("adoption and surrender dropdowns use the yellow full-control focus state", () => {
  assert.match(
    furbabiesStyles,
    /Custom adoption selects[\s\S]*?\.adoption-select-menu:is\(\.is-open, :focus-within\) \.adoption-select-trigger\s*\{[\s\S]*?border-color:\s*rgba\(241, 192, 69, 0\.92\)\s*!important;[\s\S]*?outline:\s*3px solid rgba\(241, 192, 69, 0\.92\)\s*!important;/,
  );
  assert.match(
    surrenderStyles,
    /Custom surrender selects[\s\S]*?\.surrender-select-menu:is\(\.is-open, :focus-within\) \.surrender-select-trigger\s*\{[\s\S]*?border-color:\s*rgba\(241, 192, 69, 0\.92\)\s*!important;[\s\S]*?outline:\s*3px solid rgba\(241, 192, 69, 0\.92\)\s*!important;/,
  );
});
