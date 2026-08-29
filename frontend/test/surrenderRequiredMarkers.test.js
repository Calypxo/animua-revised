import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const markup = readFileSync(
  new URL("../pages/public/surrender.html", import.meta.url),
  "utf8",
);
const formMarkup = markup.match(/<form class="surrender-form"[\s\S]*?<\/form>/)?.[0] || "";

test("every required surrender-form control has a visible asterisk", () => {
  assert.match(formMarkup, /<label for="ownerName">[^<]*<span class="req">\*<\/span><\/label>[\s\S]*?<input[^>]+id="ownerName"[^>]+required/);
  assert.match(formMarkup, /<label for="contactNo">[^<]*<span class="req">\*<\/span><\/label>[\s\S]*?<input[^>]+id="contactNo"[^>]+required/);
  assert.match(formMarkup, /<label for="ownerAddress">[^<]*<span class="req">\*<\/span><\/label>[\s\S]*?<input[^>]+id="ownerAddress"[^>]+required/);
  assert.match(formMarkup, /<label for="ownerBarangay">[^<]*<span class="req">\*<\/span><\/label>[\s\S]*?<select[^>]+id="ownerBarangay"[^>]+required/);
  assert.match(formMarkup, /for="identityIdFront"[\s\S]*?id="identityIdFrontLabel">Upload front of ID<\/span>\s*<span class="req"[^>]*>\*<\/span>[\s\S]*?<input[^>]+id="identityIdFront"[^>]+required/);
  assert.match(formMarkup, /for="identityIdBack"[\s\S]*?id="identityIdBackLabel">Upload back of ID<\/span>\s*<span class="req"[^>]*>\*<\/span>[\s\S]*?<input[^>]+id="identityIdBack"[^>]+required/);
  assert.match(formMarkup, /<label for="petName">[^<]*<span class="req"[^>]*>\*<\/span><\/label><input[^>]+id="petName"[^>]+required/);
  assert.match(formMarkup, /<label for="species">[^<]*<span class="req"[^>]*>\*<\/span><\/label><select[^>]+id="species"[^>]+required/);
  assert.match(formMarkup, /<label for="breed">[^<]*<span class="req"[^>]*>\*<\/span><\/label><input[^>]+id="breed"[^>]+required/);
  assert.match(formMarkup, /<label for="petAge">[^<]*<span class="req"[^>]*>\*<\/span><\/label><input[^>]+id="petAge"[^>]+required/);
  assert.match(formMarkup, /<label for="petSex">[^<]*<span class="req"[^>]*>\*<\/span><\/label><select[^>]+id="petSex"[^>]+required/);
  assert.match(formMarkup, /<label for="colorMarkings">[^<]*<span class="req"[^>]*>\*<\/span><\/label><input[^>]+id="colorMarkings"[^>]+required/);
  assert.match(formMarkup, /<legend>Reproductive status\s*<span class="req"[^>]*>\*<\/span><\/legend>[\s\S]*?<input[^>]+id="statusIntact"[^>]+required/);
  assert.match(formMarkup, /<label for="vaccinationHistory">[^<]*<span class="req"[^>]*>\*<\/span><\/label><textarea[^>]+id="vaccinationHistory"[^>]+required/);
  assert.match(formMarkup, /<label for="reasons">[^<]*<span class="req">\*<\/span><\/label>[\s\S]*?<textarea[^>]+id="reasons"[^>]+required/);
  assert.match(formMarkup, /<input[^>]+id="agreeAllTerms"[^>]+required[\s\S]*?id="agreementConsentText"[\s\S]*?<span class="req"[^>]*>\*<\/span>/);
});

test("animal photo remains optional", () => {
  assert.match(formMarkup, /<label for="animalPhoto">Animal photo<\/label>/);
  assert.doesNotMatch(formMarkup, /<input[^>]+id="animalPhoto"[^>]+required/);
});
