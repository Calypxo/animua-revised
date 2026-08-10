export function collectFormDraft(form) {
  const values = {};
  form.querySelectorAll("input[id], select[id], textarea[id]").forEach((field) => {
    if (field.type === "file" || field.readOnly || field.closest?.("[hidden]")) return;
    values[field.id] = field.type === "checkbox" || field.type === "radio"
      ? field.checked
      : field.value;
  });
  return values;
}

export function applyFormDraft(form, values = {}) {
  Object.entries(values).forEach(([id, value]) => {
    const field = form.querySelector(`#${CSS.escape(id)}`);
    if (!field || field.type === "file" || field.readOnly) return;
    if (field.type === "checkbox" || field.type === "radio") field.checked = Boolean(value);
    else field.value = value;
  });
}

export function saveFormDraft(storage, key, form) {
  storage.setItem(key, JSON.stringify(collectFormDraft(form)));
}

export function restoreFormDraft(storage, key, form) {
  const raw = storage.getItem(key);
  if (!raw) return false;
  try {
    applyFormDraft(form, JSON.parse(raw));
    return true;
  } catch {
    storage.removeItem(key);
    return false;
  }
}

export function clearFormDraft(storage, key) {
  storage.removeItem(key);
}
