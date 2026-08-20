import "../css/accountSettings.css";
import Swal from "sweetalert2";
import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";
import { renderPageHeader } from "../components/management/pageHeader.js";
import { PAGE_HEADER_CONFIGS } from "../components/management/pageHeaderConfigs.js";
import { apiFetch } from "../utils/api.js";
import { endUserSession, setUserSession } from "../utils/storage.js";

let account = null;
const rules = {
  length: (value) => value.length >= 8,
  upper: (value) => /[A-Z]/.test(value),
  lower: (value) => /[a-z]/.test(value),
  number: (value) => /\d/.test(value),
  special: (value) => /[^A-Za-z0-9]/.test(value),
};
const initials = (name) => String(name || "AU").trim().split(/\s+/).map((part) => part[0]).join("").slice(0,2).toUpperCase();

function renderAccount() {
  document.getElementById("accountAvatar").textContent = initials(account.fullName);
  document.getElementById("accountName").textContent = account.fullName;
  document.getElementById("accountEmail").textContent = account.email;
  document.getElementById("accountRole").textContent = account.role;
  document.getElementById("displayNameInput").value = account.fullName;
  document.getElementById("emailInput").value = account.email;
  document.getElementById("roleInput").value = account.role;
  document.getElementById("settingRole").textContent = account.role;
  document.getElementById("settingProfileStatus").textContent = "Complete";
  document.getElementById("settingEmailStatus").textContent = account.email ? "Verified" : "Pending";
  document.getElementById("settingSecurityScore").textContent = "5/5";
}

function validateDisplayName(value) {
  if (value.length < 2 || value.length > 80) return "Display name must be between 2 and 80 characters.";
  if (!/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u.test(value)) return "Use letters, spaces, periods, apostrophes, or hyphens only.";
  return "";
}

function passwordState(value) {
  return Object.fromEntries(Object.entries(rules).map(([key, test]) => [key, test(value)]));
}

function renderStrength() {
  const value = document.getElementById("newPassword").value;
  const state = passwordState(value);
  const score = Object.values(state).filter(Boolean).length;
  const fill = document.getElementById("strengthFill");
  const labels = ["Enter a new password","Very weak","Weak","Fair","Strong","Very strong"];
  const colors = ["var(--stone-3)","var(--clay)","var(--amber)","var(--amber)","var(--blue)","var(--green)"];
  fill.style.width = (score * 20) + "%";
  fill.style.background = colors[score];
  document.getElementById("strengthLabel").textContent = value ? labels[score] : labels[0];
  Object.entries(state).forEach(([key, valid]) => {
    const item = document.querySelector('[data-rule="' + key + '"]');
    item.classList.toggle("valid", valid);
    item.querySelector("i").className = "bi " + (valid ? "bi-check-circle-fill" : "bi-circle");
  });
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  if (busy) {
    button.dataset.label = button.innerHTML;
    button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> ' + label;
  } else if (button.dataset.label) {
    button.innerHTML = button.dataset.label;
  }
}

async function saveProfile(event) {
  event.preventDefault();
  const input = document.getElementById("displayNameInput");
  const error = document.getElementById("displayNameError");
  const fullName = input.value.trim().replace(/\s+/g, " ");
  error.textContent = validateDisplayName(fullName);
  if (error.textContent) return;
  if (fullName === account.fullName) {
    document.getElementById("accountStatus").textContent = "No profile changes to save.";
    return;
  }
  const button = document.getElementById("saveProfileButton");
  try {
    setBusy(button, true, "Saving");
    const result = await apiFetch("/auth/account/profile", {
      method: "PATCH",
      body: JSON.stringify({ fullName }),
    });
    account.fullName = result.fullName;
    setUserSession({ ...account, fullName: result.fullName });
    renderAccount();
    renderTopbarUser();
    loadSidebar();
    document.getElementById("accountStatus").textContent = "Profile name updated successfully.";
  } catch (requestError) {
    error.textContent = requestError.message;
  } finally {
    setBusy(button, false);
  }
}

async function changePassword(event) {
  event.preventDefault();
  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmation = document.getElementById("confirmPassword").value;
  const error = document.getElementById("passwordError");
  const state = passwordState(newPassword);
  error.textContent = "";
  if (!currentPassword) error.textContent = "Enter your current password.";
  else if (!Object.values(state).every(Boolean)) error.textContent = "New password does not meet every security requirement.";
  else if (newPassword !== confirmation) error.textContent = "New password confirmation does not match.";
  else if (currentPassword === newPassword) error.textContent = "New password must be different from your current password.";
  if (error.textContent) return;

  const confirmed = await Swal.fire({
    icon: "warning",
    title: "Change your password?",
    text: "You will be signed out and asked to log in with the new password.",
    showCancelButton: true,
    confirmButtonText: "Change password",
    confirmButtonColor: "#780116",
  });
  if (!confirmed.isConfirmed) return;
  const button = document.getElementById("changePasswordButton");
  try {
    setBusy(button, true, "Updating");
    await apiFetch("/auth/account/password", {
      method: "PATCH",
      body: JSON.stringify({ oldPassword: currentPassword, newPassword }),
    });
    await Swal.fire({
      icon: "success",
      title: "Password changed",
      text: "Sign in again using your new password.",
      confirmButtonColor: "#780116",
    });
    await endUserSession();
    window.location.replace("/pages/admin-login.html");
  } catch (requestError) {
    error.textContent = requestError.message;
  } finally {
    setBusy(button, false);
  }
}

function bindPasswordToggles() {
  document.querySelectorAll(".password-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.target);
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.querySelector("i").className = "bi " + (show ? "bi-eye-slash" : "bi-eye");
      button.setAttribute("aria-label", show ? "Hide password" : "Show password");
      button.setAttribute("aria-pressed", String(show));
      button.title = show ? "Hide password" : "Show password";
    });
  });
}

async function init() {
  try {
    await protectManagementPage();
    renderTopbarUser();
    loadSidebar();
    renderPageHeader(PAGE_HEADER_CONFIGS.accountSettings);
    const result = await apiFetch("/auth/account");
    account = result.account;
    renderAccount();
    document.getElementById("profileForm").addEventListener("submit", saveProfile);
    document.getElementById("passwordForm").addEventListener("submit", changePassword);
    document.getElementById("newPassword").addEventListener("input", renderStrength);
    bindPasswordToggles();
  } catch (error) {
    console.error("[Account Settings]", error);
    document.getElementById("accountStatus").textContent = error.message || "Unable to load account settings.";
  } finally {
    document.body.classList.remove("loading");
  }
}
window.addEventListener("DOMContentLoaded", init);
