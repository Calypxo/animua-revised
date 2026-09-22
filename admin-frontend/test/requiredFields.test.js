import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  fieldValidationMessage,
  validateFormFields,
  syncRequiredMarkers,
  initializeRequiredFields,
} from "../src/components/management/requiredFields.js";

function field(overrides = {}) {
  const attributes = new Map();
  const doc = {
    body: {},
    createElement: () => ({
      isConnected: true, classList: { add() {} }, setAttribute() {},
    }),
    defaultView: { getComputedStyle: (node) => ({ display: node.display || "block" }) },
  };
  return {
    tagName: "INPUT", type: "text", value: "", required: true,
    validity: { valid: true }, ownerDocument: doc,
    closest(selector) { return selector.startsWith("[hidden]") && this.hidden ? {} : null; },
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: (key) => attributes.delete(key),
    after(error) { this.insertedError = error; },
    focus() { this.focused = true; },
    ...overrides,
  };
}

const form = (...fields) => ({ querySelectorAll: () => fields });

test("blank and whitespace-only required fields are rejected; optional blanks are allowed", () => {
  for (const value of ["", "   ", "\n\t"]) {
    assert.equal(fieldValidationMessage(field({ value })), "This field is required.");
  }
  assert.equal(fieldValidationMessage(field({ required: false })), "");
  assert.equal(fieldValidationMessage(field({ tagName: "SELECT" })), "Please select an option.");
  assert.equal(fieldValidationMessage(field({ required: false, getAttribute: () => "true" })), "This field is required.");
});

test("explicit zero stock is valid; blank stock and invalid quantities are rejected", () => {
  assert.equal(fieldValidationMessage(field({ type: "number", value: "0" })), "");
  assert.equal(fieldValidationMessage(field({ type: "number" })), "This field is required.");
  assert.equal(fieldValidationMessage(field({ type: "number", validity: { badInput: true, valid: false } })), "Enter a valid number.");
  for (const value of ["-1", "1.5"]) {
    assert.equal(fieldValidationMessage(field({ type: "number", value,
      validity: { valid: false }, validationMessage: "Enter a positive whole number." })), "Enter a positive whole number.");
  }
});

test("all invalid fields receive separate inline errors and the first receives focus", () => {
  const first = field({ getAttribute: (key) => key === "aria-describedby" ? "existing-help" : null });
  const second = field({ tagName: "SELECT" });
  assert.equal(validateFormFields(form(first, second)), false);
  assert.equal(first.focused, true);
  assert.equal(second.focused, undefined);
  assert.notEqual(first.__requiredError.id, second.__requiredError.id);
  assert.match(first.__requiredError.textContent, /required/);
  assert.match(second.__requiredError.textContent, /select/);
  first.value = "Cat food";
  second.value = "Feed";
  assert.equal(validateFormFields(form(first, second)), true);
  assert.equal(first.__requiredError.textContent, "");
  assert.equal(second.getAttribute("aria-invalid"), undefined);
});

test("hidden, disabled and read-only fields do not block the active form", () => {
  assert.equal(validateFormFields(form(
    field({ hidden: true }), field({ disabled: true }), field({ readOnly: true }),
    field({ display: "none" }), field({ type: "hidden" }), field({ required: false }),
  )), true);
});

test("a required field inside a collapsed details section is validated and revealed", () => {
  const details = { open: false };
  const notes = field({ closest: (selector) => selector === "details" ? details : null });
  assert.equal(validateFormFields(form(notes)), false);
  assert.equal(details.open, true);
  assert.equal(notes.focused, true);
});

test("conditional markers appear once and disappear when the field becomes optional", () => {
  let marker;
  const label = { querySelector: (selector) => selector.startsWith(":scope") ? null : marker,
    contains: () => false, append: (value) => { marker = value; } };
  const input = field({ labels: [label] });
  let created = 0;
  input.ownerDocument.createElement = () => {
    created++;
    return { dataset: {}, setAttribute() {}, remove() { marker = undefined; } };
  };
  syncRequiredMarkers(form(input));
  syncRequiredMarkers(form(input));
  assert.equal(created, 1);
  assert.equal(marker.textContent, " *");
  input.required = false;
  syncRequiredMarkers(form(input));
  assert.equal(marker, undefined);
});

test("submit prevents incomplete saves but preserves an explicitly unvalidated draft action", () => {
  const listeners = new Map();
  initializeRequiredFields({ addEventListener: (name, fn) => listeners.set(name, fn) });
  let blocked = 0;
  const event = { target: form(field()), preventDefault() { blocked++; }, stopImmediatePropagation() {} };
  listeners.get("submit")(event);
  assert.equal(blocked, 1);
  listeners.get("submit")({ ...event, submitter: { formNoValidate: true } });
  assert.equal(blocked, 1);
});

test("an incomplete later batch row prevents every inventory write", async () => {
  const source = readFileSync(new URL("../src/management/inventory.js", import.meta.url), "utf8");
  for (const name of ["saveBatchStockIn", "saveBatchStockOut"]) {
    const start = source.indexOf(`async function ${name}()`);
    const tail = source.slice(start);
    const end = tail.slice(1).search(/\n(?:async )?function /) + 1;
    const fn = tail.slice(0, end);
    let writes = 0;
    const root = form(field({ value: "ITM01" }), field({ value: "2", type: "number" }), field({ tagName: "SELECT" }), field({ value: "3", type: "number" }));
    const context = vm.createContext({ validateFormFields, document: { getElementById: () => root },
      can: () => true, applyInventoryMovement: () => { writes++; } });
    await vm.runInContext(`${fn}\n${name}();`, context);
    assert.equal(writes, 0);
    assert.equal(root.querySelectorAll()[2].focused, true);
  }
});
