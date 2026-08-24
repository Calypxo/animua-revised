export function isValidRecoveryEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export function validateManagementRecoveryPassword(password, confirmation) {
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return "Use a password between 8 and 128 characters.";
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return "Include uppercase, lowercase, number, and special characters.";
  }
  if (password !== confirmation) return "New password and confirmation do not match.";
  return "";
}
