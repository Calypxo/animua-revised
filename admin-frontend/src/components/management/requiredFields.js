const CONTROL_SELECTOR = "input, select, textarea";
let errorSequence = 0;

function labelsFor(field) {
  const labels = [...(field.labels || [])];
  if (labels.length) return labels;
  const group = field.closest(".form-group");
  const label = group?.querySelector("label:not([for])");
  if (label && field.id && group.querySelector(CONTROL_SELECTOR) === field) {
    label.htmlFor = field.id;
    return [label];
  }
  return [];
}

export function syncRequiredMarkers(root = document) {
  root.querySelectorAll(CONTROL_SELECTOR).forEach((field) => {
    if (field.type === "hidden") return;
    const required = field.required || field.getAttribute("aria-required") === "true";
    labelsFor(field).forEach((label) => {
      const generated = label.querySelector("[data-required-marker]");
      if (!required || field.disabled) {
        generated?.remove();
        return;
      }
      if (label.querySelector(".req, [data-required-marker]")) return;
      const marker = field.ownerDocument.createElement("span");
      marker.className = "req";
      marker.dataset.requiredMarker = "true";
      marker.setAttribute("aria-hidden", "true");
      marker.textContent = " *";
      // Wrapped labels keep their marker beside the heading, above the input.
      const heading = label.querySelector(":scope > span > strong")
        || [...(label.children || [])].find((child) =>
          ["SPAN", "SMALL"].includes(child.tagName) && !child.contains(field)
          && child.textContent.trim() && !child.classList.contains("req"));
      if (heading) heading.append(marker);
      else if (label.contains(field)) field.before(marker);
      else label.append(marker);
    });
  });
}

export function fieldValidationMessage(field) {
  if (field.disabled || field.readOnly || field.type === "hidden") return "";
  const required = field.required || field.getAttribute("aria-required") === "true";
  if (field.validity?.badInput) return "Enter a valid number.";
  if (required && (field.type === "checkbox" ? !field.checked : !String(field.value ?? "").trim())) {
    return field.tagName === "SELECT" ? "Please select an option." : "This field is required.";
  }
  if (field.validity && !field.validity.valid) return field.validationMessage || "Enter a valid value.";
  return "";
}

function errorElement(field) {
  if (field.__requiredError?.isConnected) return field.__requiredError;
  const group = field.closest(".inventory-batch-field, .account-field, .form-group");
  const existing = group?.querySelectorAll(CONTROL_SELECTOR).length === 1
    ? group.querySelector(".form-err, .account-error") : null;
  const error = existing || field.ownerDocument.createElement("span");
  if (!error.id) error.id = `management-field-error-${++errorSequence}`;
  error.classList.add("management-field-error");
  error.setAttribute("aria-live", "polite");
  if (!existing) {
    const passwordWrap = field.closest(".password-input-wrap, .password-wrap, .input-with-icon");
    const settingHeading = field.closest(".cq-setting-row")?.querySelector(":scope > span > strong");
    if (settingHeading) settingHeading.parentElement.append(error);
    else (passwordWrap || field).after(error);
  }
  const describedBy = new Set((field.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean));
  describedBy.add(error.id);
  field.setAttribute("aria-describedby", [...describedBy].join(" "));
  field.__requiredError = error;
  return error;
}

function showError(field, message) {
  const error = message ? errorElement(field) : field.__requiredError;
  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
  if (message) field.setAttribute("aria-invalid", "true");
  else if (error) field.removeAttribute("aria-invalid");
}

function isActive(field) {
  if (field.disabled || field.type === "hidden" || field.closest("[hidden], [aria-hidden='true']")) return false;
  // A collapsed details section still contains applicable fields: open it on error.
  const view = field.ownerDocument.defaultView;
  for (let node = field; node && node !== field.ownerDocument.body; node = node.parentElement) {
    if (view?.getComputedStyle(node).display === "none") return false;
  }
  return true;
}

function focusError(field) {
  for (let section = field.closest("details"); section; section = section.parentElement?.closest("details")) section.open = true;
  field.focus();
}

export function validateFormFields(root) {
  if (!root) return false;
  let firstInvalid;
  root.querySelectorAll(CONTROL_SELECTOR).forEach((field) => {
    const message = isActive(field) ? fieldValidationMessage(field) : "";
    showError(field, message);
    if (message && !firstInvalid) firstInvalid = field;
  });
  if (firstInvalid) focusError(firstInvalid);
  return !firstInvalid;
}

export function initializeRequiredFields(root = document) {
  if (root.__requiredFieldsInitialized) return;
  root.__requiredFieldsInitialized = true;
  root.addEventListener("submit", (event) => {
    if (event.submitter?.formNoValidate) return;
    if (!validateFormFields(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  // Native validation runs before submit; provide the same inline feedback.
  let firstNativeInvalid;
  root.addEventListener("invalid", (event) => {
    event.preventDefault();
    showError(event.target, fieldValidationMessage(event.target));
    if (!firstNativeInvalid) {
      firstNativeInvalid = event.target;
      queueMicrotask(() => { focusError(firstNativeInvalid); firstNativeInvalid = null; });
    }
  }, true);
  const clear = (event) => {
    if (event.target.matches?.(CONTROL_SELECTOR) && event.target.__requiredError) {
      showError(event.target, fieldValidationMessage(event.target));
    }
  };
  root.addEventListener("input", clear);
  root.addEventListener("change", clear);
  root.addEventListener("reset", (event) => {
    event.target.querySelectorAll(CONTROL_SELECTOR).forEach((field) => showError(field, ""));
  });
}
