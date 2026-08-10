import test from "node:test";
import assert from "node:assert/strict";

import { collectFormDraft, saveFormDraft, restoreFormDraft, clearFormDraft } from "../src/management/formDrafts.js";

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function fakeForm(fields) {
  return {
    querySelectorAll: () => fields,
    querySelector: (selector) => fields.find((field) => `#${field.id}` === selector) || null,
  };
}

test("form drafts exclude read-only account fields and restore editable values", () => {
  globalThis.CSS = { escape: (value) => value };
  const fields = [
    { id: "notes", type: "textarea", value: "Follow up tomorrow", readOnly: false },
    { id: "vet", type: "text", value: "Admin", readOnly: true },
  ];
  const form = fakeForm(fields);
  assert.deepEqual(collectFormDraft(form), { notes: "Follow up tomorrow" });

  const store = storage();
  saveFormDraft(store, "draft", form);
  fields[0].value = "";
  assert.equal(restoreFormDraft(store, "draft", form), true);
  assert.equal(fields[0].value, "Follow up tomorrow");
  clearFormDraft(store, "draft");
  assert.equal(restoreFormDraft(store, "draft", form), false);
});
