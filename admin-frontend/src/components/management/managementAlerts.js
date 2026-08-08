import Swal from "sweetalert2";

const MANAGEMENT_ALERT_CLASSES = {
  popup: "animua-management-swal",
  confirmButton: "animua-management-swal-confirm",
  cancelButton: "animua-management-swal-cancel",
};

function mergeClasses(customClass = {}) {
  const keys = new Set([...Object.keys(MANAGEMENT_ALERT_CLASSES), ...Object.keys(customClass)]);
  return Object.fromEntries([...keys].map((key) => [
    key,
    [MANAGEMENT_ALERT_CLASSES[key], customClass[key]].filter(Boolean).join(" ").trim(),
  ]));
}

export function fireManagementAlert(options = {}) {
  return Swal.fire({
    buttonsStyling: false,
    ...options,
    customClass: mergeClasses(options.customClass),
  });
}

export async function confirmManagementAction({
  title,
  text,
  icon = "question",
  confirmButtonText = "Confirm",
  cancelButtonText = "Cancel",
  danger = false,
} = {}) {
  const result = await fireManagementAlert({
    icon,
    title,
    text,
    showCancelButton: true,
    reverseButtons: true,
    focusCancel: true,
    confirmButtonText,
    cancelButtonText,
    customClass: danger ? { confirmButton: "animua-management-swal-danger" } : {},
  });
  return result.isConfirmed;
}

export async function promptManagementText({
  title,
  text,
  placeholder = "",
  value = "",
  input = "text",
  confirmButtonText = "Continue",
  requiredMessage = "This field is required.",
  inputAttributes = {},
  validate,
} = {}) {
  const result = await fireManagementAlert({
    icon: "question",
    title,
    text,
    input,
    inputValue: value,
    inputPlaceholder: placeholder,
    inputAttributes,
    showCancelButton: true,
    reverseButtons: true,
    focusCancel: false,
    confirmButtonText,
    cancelButtonText: "Cancel",
    inputValidator: (rawValue) => {
      const normalized = typeof rawValue === "string" ? rawValue.trim() : rawValue;
      if (normalized === "" || normalized === null || normalized === undefined) return requiredMessage;
      return validate?.(normalized) || undefined;
    },
  });

  if (!result.isConfirmed) return null;
  return typeof result.value === "string" ? result.value.trim() : result.value;
}

export function showManagementNotice({
  title,
  text,
  icon = "info",
  confirmButtonText = "Okay",
} = {}) {
  return fireManagementAlert({ icon, title, text, confirmButtonText });
}
