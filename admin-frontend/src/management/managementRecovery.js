import { API_BASE_URL } from "../utils/api.js";
import {
  isValidRecoveryEmail,
  validateManagementRecoveryPassword,
} from "./managementRecoveryModel.js";

const RESEND_WAIT_SECONDS = 60;
const STEP_IDS = {
  email: "recoveryEmailStep",
  otp: "recoveryOtpStep",
  password: "recoveryPasswordStep",
  success: "recoverySuccessStep",
};
const STEP_TITLES = {
  email: "recoveryTitle",
  otp: "recoveryOtpTitle",
  password: "recoveryPasswordTitle",
  success: "recoverySuccessTitle",
};
const STEP_DESCRIPTIONS = {
  email: "recoveryDescription",
  otp: "recoveryOtpDescription",
  password: "recoveryPasswordDescription",
  success: "recoverySuccessDescription",
};

async function recoveryRequest(endpoint, body) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) {
    const error = new Error(data.message || "Unable to complete account recovery.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function setButtonBusy(button, busy, busyText) {
  if (!button) return;
  if (!button.dataset.defaultHtml) button.dataset.defaultHtml = button.innerHTML;
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  button.innerHTML = busy
    ? `<span class="recovery-spinner" aria-hidden="true"></span><span>${busyText}</span>`
    : button.dataset.defaultHtml;
}

export function initializeManagementRecovery() {
  const backdrop = document.getElementById("managementRecovery");
  const dialog = backdrop?.querySelector(".recovery-dialog");
  const openButton = document.getElementById("forgotPasswordBtn");
  if (!backdrop || !dialog || !openButton) return;

  const emailForm = document.getElementById("recoveryEmailForm");
  const otpForm = document.getElementById("recoveryOtpForm");
  const passwordForm = document.getElementById("recoveryPasswordForm");
  const emailInput = document.getElementById("recoveryEmail");
  const otpInput = document.getElementById("recoveryOtp");
  const passwordInput = document.getElementById("recoveryNewPassword");
  const confirmationInput = document.getElementById("recoveryConfirmPassword");
  const recoveryUsername = document.getElementById("recoveryUsername");
  const resendButton = document.getElementById("resendRecoveryOtp");
  let recoveryEmail = "";
  let resetToken = "";
  let activeStep = "email";
  let resendRemaining = 0;
  let resendTimer = null;
  let previouslyFocused = null;

  const setError = (id, message = "") => {
    const element = document.getElementById(id);
    if (element) element.textContent = message;
  };
  const clearErrors = () => backdrop.querySelectorAll(".recovery-error").forEach((item) => { item.textContent = ""; });
  const focusable = () => [...dialog.querySelectorAll("button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")]
    .filter((item) => !item.closest("[hidden]"));

  const showStep = (step) => {
    activeStep = step;
    Object.entries(STEP_IDS).forEach(([name, id]) => {
      const element = document.getElementById(id);
      if (element) element.hidden = name !== step;
    });
    dialog.setAttribute("aria-labelledby", STEP_TITLES[step]);
    dialog.setAttribute("aria-describedby", STEP_DESCRIPTIONS[step]);
    const firstField = dialog.querySelector(`#${STEP_IDS[step]} input:not([type='hidden'])`);
    const firstButton = dialog.querySelector(`#${STEP_IDS[step]} button`);
    window.requestAnimationFrame(() => (firstField || firstButton)?.focus());
  };

  const updateResend = () => {
    if (!resendButton) return;
    resendButton.disabled = resendRemaining > 0;
    resendButton.textContent = resendRemaining > 0 ? `Resend in ${resendRemaining}s` : "Resend code";
  };
  const startResendCountdown = () => {
    window.clearInterval(resendTimer);
    resendRemaining = RESEND_WAIT_SECONDS;
    updateResend();
    resendTimer = window.setInterval(() => {
      resendRemaining -= 1;
      updateResend();
      if (resendRemaining <= 0) window.clearInterval(resendTimer);
    }, 1000);
  };

  const resetRecovery = () => {
    window.clearInterval(resendTimer);
    resendRemaining = 0;
    recoveryEmail = "";
    resetToken = "";
    emailForm?.reset();
    otpForm?.reset();
    passwordForm?.reset();
    clearErrors();
    updateResend();
    showStep("email");
  };
  const closeRecovery = () => {
    backdrop.hidden = true;
    document.body.classList.remove("recovery-open");
    resetRecovery();
    previouslyFocused?.focus();
  };
  const openRecovery = () => {
    previouslyFocused = document.activeElement;
    resetRecovery();
    const loginEmail = document.getElementById("login-email")?.value?.trim();
    if (loginEmail && emailInput) emailInput.value = loginEmail;
    backdrop.hidden = false;
    document.body.classList.add("recovery-open");
    window.requestAnimationFrame(() => emailInput?.focus());
  };

  openButton.addEventListener("click", openRecovery);
  backdrop.querySelectorAll("[data-recovery-close], #recoveryClose").forEach((button) => button.addEventListener("click", closeRecovery));
  backdrop.addEventListener("click", (event) => { if (event.target === backdrop) closeRecovery(); });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeRecovery();
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusable();
    if (!items.length) return;
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  emailForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setError("recoveryEmailError");
    const email = emailInput?.value?.trim().toLowerCase() || "";
    if (!isValidRecoveryEmail(email)) {
      setError("recoveryEmailError", "Enter a valid management email address.");
      emailInput?.focus();
      return;
    }
    const button = document.getElementById("sendRecoveryOtp");
    setButtonBusy(button, true, "Sending code…");
    try {
      await recoveryRequest("/auth/management/request-password-reset-otp", { email });
      recoveryEmail = email;
      if (recoveryUsername) recoveryUsername.value = email;
      document.getElementById("recoveryEmailDisplay").textContent = email;
      otpInput.value = "";
      showStep("otp");
      startResendCountdown();
    } catch (error) {
      setError("recoveryEmailError", error.message);
    } finally {
      setButtonBusy(button, false);
    }
  });

  otpInput?.addEventListener("input", () => { otpInput.value = otpInput.value.replace(/\D/g, "").slice(0, 6); });
  otpForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setError("recoveryOtpError");
    const otp = otpInput?.value?.trim() || "";
    if (!/^\d{6}$/.test(otp)) {
      setError("recoveryOtpError", "Enter the complete six-digit verification code.");
      otpInput?.focus();
      return;
    }
    const button = document.getElementById("verifyRecoveryOtp");
    setButtonBusy(button, true, "Verifying…");
    try {
      const data = await recoveryRequest("/auth/management/verify-password-reset-otp", { email: recoveryEmail, otp });
      resetToken = data.resetToken || "";
      if (!resetToken) throw new Error("Verification could not be completed. Request a new code.");
      otpInput.value = "";
      window.clearInterval(resendTimer);
      showStep("password");
    } catch (error) {
      setError("recoveryOtpError", error.message);
    } finally {
      setButtonBusy(button, false);
    }
  });

  resendButton?.addEventListener("click", async () => {
    if (resendRemaining > 0 || !recoveryEmail) return;
    setError("recoveryOtpError");
    setButtonBusy(resendButton, true, "Sending…");
    try {
      await recoveryRequest("/auth/management/request-password-reset-otp", { email: recoveryEmail });
      otpInput.value = "";
      startResendCountdown();
      setError("recoveryOtpError", "A new code was requested. Check your registered email.");
    } catch (error) {
      setError("recoveryOtpError", error.message);
    } finally {
      setButtonBusy(resendButton, false);
      updateResend();
    }
  });

  document.getElementById("changeRecoveryEmail")?.addEventListener("click", () => {
    window.clearInterval(resendTimer);
    otpInput.value = "";
    setError("recoveryOtpError");
    showStep("email");
  });

  backdrop.querySelectorAll("[data-password-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.passwordTarget);
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.setAttribute("aria-label", show ? "Hide password" : "Show password");
      button.setAttribute("aria-pressed", String(show));
      button.querySelector("i").className = show ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
    });
  });

  passwordForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const newPassword = passwordInput?.value || "";
    const confirmPassword = confirmationInput?.value || "";
    const validationError = validateManagementRecoveryPassword(newPassword, confirmPassword);
    setError("recoveryPasswordError", validationError);
    if (validationError) {
      passwordInput?.focus();
      return;
    }
    const button = document.getElementById("completeRecovery");
    setButtonBusy(button, true, "Resetting password…");
    try {
      await recoveryRequest("/auth/management/reset-password", { resetToken, newPassword, confirmPassword });
      resetToken = "";
      passwordForm.reset();
      const loginEmail = document.getElementById("login-email");
      if (loginEmail) loginEmail.value = recoveryEmail;
      showStep("success");
    } catch (error) {
      setError("recoveryPasswordError", error.message);
    } finally {
      setButtonBusy(button, false);
    }
  });

  showStep(activeStep);
}
