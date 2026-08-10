import test from "node:test";
import assert from "node:assert/strict";

import {
  shouldSendReplyOnKeydown,
  getReplyDraft,
  saveReplyDraft,
  clearReplyDraft,
} from "../src/management/contactReplyComposer.js";

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("Enter sends while Shift+Enter and IME composition do not", () => {
  assert.equal(shouldSendReplyOnKeydown({ key: "Enter", shiftKey: false, isComposing: false }), true);
  assert.equal(shouldSendReplyOnKeydown({ key: "Enter", shiftKey: true, isComposing: false }), false);
  assert.equal(shouldSendReplyOnKeydown({ key: "Enter", shiftKey: false, isComposing: true }), false);
  assert.equal(shouldSendReplyOnKeydown({ key: "a", shiftKey: false, isComposing: false }), false);
});

test("unsent drafts restore and sent drafts clear without reusing the last reply", () => {
  const store = storage();
  saveReplyDraft(store, "MSG-1", "Unsent reply");
  assert.equal(getReplyDraft(store, "MSG-1"), "Unsent reply");
  clearReplyDraft(store, "MSG-1");
  assert.equal(getReplyDraft(store, "MSG-1"), "");
});
