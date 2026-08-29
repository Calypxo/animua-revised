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

test("adoption and surrender dropdowns use consistent hover, focus, and open states", () => {
  assert.match(
    furbabiesStyles,
    /Keep custom select feedback[\s\S]*?\.adoption-select-menu:not\(\.is-disabled, \.is-open\) \.adoption-select-trigger:hover\s*\{[\s\S]*?outline:\s*none\s*!important;[\s\S]*?box-shadow:\s*0 0 0 2px rgba\(241, 192, 69, 0\.12\)\s*!important;/,
  );
  assert.match(
    surrenderStyles,
    /Keep custom select feedback[\s\S]*?\.surrender-select-menu:not\(\.is-disabled, \.is-open\) \.surrender-select-trigger:hover\s*\{[\s\S]*?outline:\s*none\s*!important;[\s\S]*?box-shadow:\s*0 0 0 2px rgba\(241, 192, 69, 0\.12\)\s*!important;/,
  );

  assert.match(
    furbabiesStyles,
    /Desktop adoption dropdowns share the same focus color[\s\S]*?@media\s*\(min-width:\s*901px\)[\s\S]*?\.adoption-select-menu:is\(\.is-open, :focus-within\) \.adoption-select-trigger\s*\{[\s\S]*?border-color:\s*var\(--animua-red\)\s*!important;[\s\S]*?outline:\s*3px solid rgba\(241, 192, 69, 0\.92\)\s*!important;[\s\S]*?outline-offset:\s*3px\s*!important;[\s\S]*?box-shadow:\s*0 0 0 4px rgba\(142, 42, 32, 0\.12\)\s*!important;/,
  );
  assert.match(
    surrenderStyles,
    /Desktop surrender dropdowns use the same dark-gold focus treatment[\s\S]*?@media\s*\(min-width:\s*901px\)[\s\S]*?\.surrender-select-menu:is\(\.is-open, :focus-within\) \.surrender-select-trigger\s*\{[\s\S]*?border-color:\s*var\(--animua-red\)\s*!important;[\s\S]*?outline:\s*3px solid rgba\(241, 192, 69, 0\.92\)\s*!important;[\s\S]*?outline-offset:\s*3px\s*!important;[\s\S]*?box-shadow:\s*0 0 0 4px rgba\(142, 42, 32, 0\.12\)\s*!important;/,
  );

  assert.match(
    globalStyles,
    /Native dropdowns use a quieter interaction state[\s\S]*?select:focus-visible\s*\{[\s\S]*?outline:\s*2px solid rgba\(241, 192, 69, 0\.34\)\s*!important;[\s\S]*?box-shadow:\s*0 4px 12px rgba\(75, 43, 33, 0\.08\)\s*!important;/,
  );
});
