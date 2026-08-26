import Swal from "sweetalert2";
import { API_BASE_URL } from "../utils/api.js";
import { auth } from "../utils/firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  deleteUser
} from "firebase/auth";
import { clearUserSession, setUserSession } from "../utils/storage.js";

const RECAPTCHA_SITE_KEY =
  import.meta.env?.VITE_RECAPTCHA_SITE_KEY ||
  window.ANIMUA_RECAPTCHA_SITE_KEY ||
  "";
const CAPTCHA_REQUIRED_MESSAGE = "Please complete the CAPTCHA before creating your account.";
const CAPTCHA_EXPIRED_MESSAGE = "Verification expired. Please complete the CAPTCHA again.";
const CONSENT_REQUIRED_MESSAGE = "Please confirm that you have read and agree to ANIMUA's Terms and Privacy Notice.";
const POLICY_VERSION = "1.0";
const RESEND_COOLDOWN_SECONDS = 30;

let registerCaptchaWidgetId = null;
let registerCaptchaRenderPromise = null;
let registerCaptchaIsCompact = null;
let registerCaptchaResizeListenerBound = false;
let registerCaptchaResizeTimer = null;
let verificationResendTimer = null;
let verificationResendRemaining = 0;
let pendingVerificationEmail = "";
let activePolicyModal = null;
let activePolicyTrigger = null;
let policyModalKeydownHandler = null;

export async function handleRegistration(event) {
  event.preventDefault();

  const firstNameInput = document.getElementById("reg-first-name");
  const lastNameInput = document.getElementById("reg-last-name");
  const emailInput = document.getElementById("reg-email");
  const passwordInput = document.getElementById("reg-password");
  const confirmPasswordInput = document.getElementById("reg-confirm-password");
  const firstNameError = document.getElementById("reg-first-name-error");
  const lastNameError = document.getElementById("reg-last-name-error");
  const confirmPasswordError = document.getElementById("reg-confirm-password-error");
  const termsInput = document.getElementById("reg-terms");
  const termsError = document.getElementById("reg-terms-error");
  const authModal = document.getElementById("authModal");
  const submitButton = event.currentTarget?.querySelector(".auth-submit-btn");

  const firstName = firstNameInput?.value.trim() || "";
  const lastName = lastNameInput?.value.trim() || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const email = emailInput?.value.trim().toLowerCase();
  const password = passwordInput?.value;
  const confirmPassword = confirmPasswordInput?.value;
  const termsAccepted = Boolean(termsInput?.checked);

  if (termsError) termsError.textContent = "";
  if (firstNameError) firstNameError.textContent = "";
  if (lastNameError) lastNameError.textContent = "";

  if (!firstName || firstName.length < 2) {
    if (firstNameError) firstNameError.textContent = firstName ? "First name must be at least 2 characters." : "First name is required.";
    firstNameInput?.focus();
    return;
  }

  if (!lastName || lastName.length < 2) {
    if (lastNameError) lastNameError.textContent = lastName ? "Last name must be at least 2 characters." : "Last name is required.";
    lastNameInput?.focus();
    return;
  }

  if (!email) {
    closeModal(authModal);
    Swal.fire({
      icon: "warning",
      title: "Missing Email",
      text: "Please enter your email.",
      customClass: {
        popup: "animua-popup",
        confirmButton: "animua-confirm"
      },
      buttonsStyling: false
    });
    return;
  }

  if (!isValidEmail(email)) {
    closeModal(authModal);
    Swal.fire({
      icon: "warning",
      title: "Invalid Email",
      text: "Please enter a valid email address.",
      customClass: {
        popup: "animua-popup",
        confirmButton: "animua-confirm"
      },
      buttonsStyling: false
    });
    return;
  }

if (!password) {
  closeModal(authModal);
  Swal.fire({
    icon: "warning",
    title: "Missing Password",
    text: "Please enter your password.",
    customClass: {
      popup: "animua-popup",
      confirmButton: "animua-confirm"
    },
    buttonsStyling: false
  });
  return;
}

if (confirmPasswordError) confirmPasswordError.textContent = "";

if (password !== confirmPassword) {
  if (confirmPasswordError) {
    confirmPasswordError.textContent = "Passwords do not match.";
  }
  return;
}

if (password.length < 6) {
  closeModal(authModal);
  Swal.fire({
    icon: "warning",
    title: "Invalid Password",
    text: "Password must be at least 6 characters.",
    customClass: {
      popup: "animua-popup",
      confirmButton: "animua-confirm"
    },
    buttonsStyling: false
  });
  return;
}

const passwordError = document.getElementById("reg-password-error");

// clear previous error
if (passwordError) passwordError.textContent = "";

const commonPasswords = [
  "123456",
  "12345678",
  "password",
  "password123",
  "qwerty",
  "admin",
  "111111",
  "abc123"
];

if (commonPasswords.includes(password.toLowerCase())) {
  if (passwordError) {
    passwordError.textContent =
      "This password is too common. Please choose a stronger password.";
  }
  return;
}

const isStrong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);

if (!isStrong) {
  if (passwordError) {
    passwordError.textContent =
      "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.";
  }
  return;
}

  if (!termsAccepted) {
    if (termsError) termsError.textContent = CONSENT_REQUIRED_MESSAGE;
    return;
  }

  const captchaToken = getRegisterCaptchaToken();
  if (!captchaToken) {
    setCaptchaError(CAPTCHA_REQUIRED_MESSAGE);
    return;
  }

  setSubmitLoading(submitButton, true, "Creating account...");

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    try {
      await saveRegistrationProfile({
        firebaseUser: credential.user,
        fullName,
        email,
        password,
        captchaToken,
        termsAccepted
      });
    } catch (error) {
      if (error.status === 409) {
        await deleteUser(credential.user).catch((deleteError) => {
          console.warn("[Firebase cleanup failed]", deleteError.message);
        });
      }

      throw error;
    }

    if (firstNameInput) firstNameInput.value = "";
    if (lastNameInput) lastNameInput.value = "";
    if (emailInput) emailInput.value = "";
    if (passwordInput) passwordInput.value = "";
    if (confirmPasswordInput) confirmPasswordInput.value = "";
    if (termsInput) termsInput.checked = false;
    resetRegisterCaptcha();

    await showEmailVerificationScreen(email);
  } catch (error) {
    console.error("[Register Error]", error);
    resetRegisterCaptcha();

    if (error.code === "auth/email-already-in-use") {
      await handleExistingFirebaseAccount({
        fullName,
        email,
        password,
        captchaToken,
        authModal
      });
      return;
    }

    showRegistrationError(authModal, getRegistrationErrorTitle(error), getRegistrationErrorMessage(error));
  } finally {
    setSubmitLoading(submitButton, false);
  }
}

async function saveRegistrationProfile({
  firebaseUser,
  fullName,
  email,
  password,
  captchaToken
}) {
  if (fullName && firebaseUser.displayName !== fullName) {
    await updateProfile(firebaseUser, { displayName: fullName });
  }

  const firebaseIdToken = await firebaseUser.getIdToken();

  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fullName,
      email,
      password,
      captchaToken,
      termsAccepted: true,
      policyVersion: POLICY_VERSION,
      firebaseUid: firebaseUser.uid,
      firebaseIdToken
    })
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || "Registration failed.");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function handleExistingFirebaseAccount({
  fullName,
  email,
  password,
  captchaToken,
  authModal
}) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);

    try {
      await saveRegistrationProfile({
        firebaseUser: credential.user,
        fullName,
        email,
        password,
        captchaToken
      });
    } catch (error) {
      if (error.status !== 409) throw error;

      await credential.user.reload();
      if (auth.currentUser?.emailVerified) {
        showRegistrationError(
          authModal,
          "Email Already Registered",
          "This email is already verified and registered. Please log in instead."
        );
        return;
      }
    }

    await showEmailVerificationScreen(email);
  } catch (error) {
    if (error.status === 409) {
      showRegistrationError(
        authModal,
        "Email Already Registered",
        "This email is already registered. Please log in instead."
      );
      return;
    }

    if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password") {
      showRegistrationError(
        authModal,
        "Email Already Registered",
        "This email is already registered. Please log in instead, or use a different email."
      );
      return;
    }

    showRegistrationError(authModal, getRegistrationErrorTitle(error), getRegistrationErrorMessage(error));
  }
}

function showRegistrationError(authModal, title, text) {
  closeModal(authModal);
  Swal.fire({
    icon: "error",
    title,
    text,
    customClass: {
      popup: "animua-popup",
      confirmButton: "animua-confirm"
    },
    buttonsStyling: false
  });
}

function getRegistrationErrorTitle(error) {
  if (error.status === 409 || error.code === "auth/email-already-in-use") {
    return "Email Already Registered";
  }

  if (error.code?.startsWith("auth/")) {
    return "Registration Failed";
  }

  return "Connection Error";
}

function getRegistrationErrorMessage(error) {
  if (error.status === 409 || error.code === "auth/email-already-in-use") {
    return "This email is already registered. Please log in instead.";
  }

  if (error.code === "auth/invalid-email") {
    return "Please enter a valid email address.";
  }

  if (error.code === "auth/weak-password") {
    return "Please choose a stronger password.";
  }

  if (error.code?.startsWith("auth/")) {
    return error.message || "Firebase could not create this account.";
  }

  return error.message || "Cannot connect to the backend. Please check your internet or server status.";
}

function closeModal(authModal) {
  if (authModal) authModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  document.body.classList.remove("auth-open");
}

function setSubmitLoading(button, isLoading, loadingText = "Please wait...") {
  if (!button) return;

  if (isLoading) {
    button.dataset.originalHtml = button.innerHTML;
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    return;
  }

  if (button.dataset.originalHtml) {
    button.innerHTML = button.dataset.originalHtml;
  } else {
    button.textContent = button.dataset.originalText || "Create Account";
  }
  button.disabled = false;
  button.removeAttribute("aria-busy");
  delete button.dataset.originalHtml;
  delete button.dataset.originalText;
}

export async function showEmailVerificationScreen(email) {
  const registerSection = document.getElementById("register-section");
  if (!registerSection) return;

  const authModal = registerSection.closest(".auth-modal-overlay") || document.getElementById("authModal");
  const authCard = authModal?.querySelector(".auth-modal-card");
  authModal?.classList.add("register-mode", "email-verification-mode");
  authCard?.setAttribute("aria-hidden", "true");
  authCard?.style.setProperty("display", "none", "important");

  const title = registerSection.querySelector(".auth-title");
  const intro = registerSection.querySelector(".auth-switch-inline");
  const form = document.getElementById("register-form");
  const bottomSwitch = registerSection.querySelector(".auth-bottom-switch");
  let screen = document.getElementById("email-verification-screen");

  if (title) title.classList.add("hidden");
  if (intro) intro.classList.add("hidden");
  if (form) form.classList.add("hidden");
  if (bottomSwitch) bottomSwitch.classList.add("hidden");

  pendingVerificationEmail = email;

  if (!screen) {
    screen = document.createElement("div");
    screen.id = "email-verification-screen";
    screen.className = "email-verification-screen";
    screen.setAttribute("role", "dialog");
    screen.setAttribute("aria-modal", "true");
    screen.setAttribute("aria-labelledby", "email-verification-title");
    (authModal || registerSection).appendChild(screen);
  }

  const user = auth.currentUser;

  renderEmailVerificationStep(user?.email || pendingVerificationEmail);

  const message = document.getElementById("email-verification-message");
  if (!user) {
    if (message) message.textContent = "Please register again before requesting an email OTP.";
    return;
  }

  try {
    if (message) message.textContent = "Sending email OTP...";
    await requestEmailVerificationOtp(user);
    if (message) message.textContent = "We sent a six-digit OTP to your email.";
    startResendCooldown();
  } catch (error) {
    console.error("[Email OTP Request Error]", error);
    if (message) message.textContent = error.message || "Unable to send email OTP. Please try again.";
  }
}

function renderEmailVerificationStep(email) {
  const screen = document.getElementById("email-verification-screen");
  if (!screen) return;
  const safeMaskedEmail = escapeHtml(maskEmail(email));

  screen.innerHTML = `
    <button type="button" class="email-verification-close" id="close-email-verification" aria-label="Close email verification">
      <i class="fa-solid fa-xmark" aria-hidden="true"></i>
    </button>
    <div class="email-verification-visual" aria-hidden="true">
      <span class="email-verification-mail-icon">
        <i class="fa-regular fa-envelope"></i>
        <span><i class="fa-solid fa-shield"></i></span>
      </span>
    </div>
    <h2 id="email-verification-title">Verify your email</h2>
    <p class="email-verification-copy">We'll send a 6-digit verification code to</p>
    <div class="email-verification-email-pill">${safeMaskedEmail}</div>
    <label class="auth-field-label email-verification-label" for="email-verification-code">Email OTP</label>
    <input type="text" id="email-verification-code" class="email-verification-hidden-input" inputmode="numeric" maxlength="6" autocomplete="one-time-code" aria-label="Six-digit email OTP">
    <div class="email-verification-code-grid" id="email-verification-code-grid" aria-hidden="true">
      ${Array.from({ length: 6 }, (_, index) => `<span class="email-verification-code-box" data-otp-index="${index}"></span>`).join("")}
    </div>
    <small class="auth-error email-verification-message" id="email-verification-message"></small>
    <div class="email-verification-resend">
      <span class="email-verification-resend-line"></span>
      <span class="email-verification-resend-help">Didn't receive the code?</span>
      <span class="email-verification-countdown" id="email-verification-countdown" aria-live="polite">Resend in</span>
      <button type="button" class="auth-secondary-action" id="resend-email-verification-btn">Resend Code</button>
    </div>
    <button type="button" class="auth-submit-btn" id="check-email-verification-btn">
      <span>Verify Email</span>
      <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
    </button>
    <button type="button" class="auth-link-action" id="change-email-btn">Use a Different Email</button>
    <div class="email-verification-help-card">
      <span class="email-verification-help-icon"><i class="fa-regular fa-envelope"></i></span>
      <span>
        <strong>Can't find the email?</strong>
        <small>Please check your Spam or Promotions folder.</small>
      </span>
    </div>
  `;

  setupEmailOtpInput();
  document.getElementById("close-email-verification")?.addEventListener("click", () => {
    document.getElementById("closeAuthModal")?.click();
  });
  document.getElementById("check-email-verification-btn")?.addEventListener("click", handleEmailVerifiedClick);
  document.getElementById("resend-email-verification-btn")?.addEventListener("click", handleResendVerificationClick);
  document.getElementById("change-email-btn")?.addEventListener("click", handleChangeEmailClick);
}

function setupEmailOtpInput() {
  const input = document.getElementById("email-verification-code");
  const boxes = Array.from(document.querySelectorAll(".email-verification-code-box"));
  if (!input || !boxes.length) return;

  const syncBoxes = () => {
    const digits = input.value.replace(/\D/g, "").slice(0, 6);
    if (input.value !== digits) input.value = digits;

    boxes.forEach((box, index) => {
      box.textContent = digits[index] || "";
      box.classList.toggle("filled", index < digits.length);
      box.classList.toggle("active", index === digits.length && digits.length < boxes.length);
    });

    if (digits.length === boxes.length) {
      boxes[boxes.length - 1].classList.add("active");
    }
  };

  boxes.forEach((box) => {
    box.addEventListener("click", () => input.focus());
  });

  input.addEventListener("input", syncBoxes);
  input.addEventListener("paste", () => window.setTimeout(syncBoxes, 0));
  input.addEventListener("focus", syncBoxes);
  input.addEventListener("blur", () => boxes.forEach((box) => box.classList.remove("active")));

  input.focus();
  syncBoxes();
}

async function handleEmailVerifiedClick() {
  const message = document.getElementById("email-verification-message");
  const button = document.getElementById("check-email-verification-btn");
  const user = auth.currentUser;
  const otp = document.getElementById("email-verification-code")?.value.trim() || "";
  message?.classList.remove("is-success");

  if (!user) {
    if (message) message.textContent = "Please register again so we can verify your email.";
    return;
  }

  if (!/^\d{6}$/.test(otp)) {
    if (message) message.textContent = "Please enter the six-digit email OTP.";
    return;
  }

  setSubmitLoading(button, true, "Verifying...");

  try {
    const firebaseIdToken = await user.getIdToken(true);
    const response = await fetch(`${API_BASE_URL}/auth/confirm-email-verification-otp`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ firebaseIdToken, otp })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Email OTP verification failed.");
    }

    await user.reload();

    const email = data.email || user.email || pendingVerificationEmail;
    const userRole = data.role || "Public";
    const userFullName = data.fullName || user.displayName || "User";

    clearUserSession();
    setUserSession({ role: userRole, fullName: userFullName, email });
    sessionStorage.setItem("show_welcome_toast", "true");

    if (message) {
      message.textContent = "Account successfully created. Redirecting...";
      message.classList.add("is-success");
    }
    await new Promise((resolve) => window.setTimeout(resolve, 900));

    closeModal(document.getElementById("authModal"));

    const pendingPetId = sessionStorage.getItem("animua_selected_pet_id");
    const pendingAction = sessionStorage.getItem("animua_selected_pet_action");

    if (userRole === "Admin" || userRole === "Staff") {
      window.location.replace("/pages/dashboard.html");
    } else if (pendingPetId && pendingAction === "adopt") {
      window.location.replace("/pages/public/find-furbabies.html");
    } else {
      window.location.replace("/pages/public/home.html");
    }
  } catch (error) {
    if (message) message.textContent = error.message || "Incorrect email OTP. Please try again.";
  } finally {
    setSubmitLoading(button, false);
  }
}

async function handleResendVerificationClick() {
  const message = document.getElementById("email-verification-message");
  const button = document.getElementById("resend-email-verification-btn");
  const user = auth.currentUser;
  message?.classList.remove("is-success");

  if (!user) {
    if (message) message.textContent = "Please register again before requesting another email OTP.";
    return;
  }

  if (verificationResendRemaining > 0) return;

  button.disabled = true;
  try {
    await requestEmailVerificationOtp(user);
    if (message) message.textContent = "We sent a new email OTP. Please check your inbox.";
    startResendCooldown();
  } catch (error) {
    if (message) message.textContent = error.message || "Unable to resend email OTP.";
    if (error.status === 429) {
      startResendCooldown();
    } else {
      updateResendButton();
    }
  }
}

async function requestEmailVerificationOtp(user) {
  const firebaseIdToken = await user.getIdToken(true);
  const response = await fetch(`${API_BASE_URL}/auth/request-email-verification-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ firebaseIdToken })
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || "Unable to send email OTP.");
    error.status = response.status;
    throw error;
  }

  return data;
}

async function handleChangeEmailClick() {
  const changeButton = document.getElementById("change-email-btn");
  if (changeButton) {
    changeButton.disabled = true;
    changeButton.setAttribute("aria-busy", "true");
  }

  try {
    const user = auth.currentUser;
    if (user && !user.emailVerified && !user.phoneNumber) {
      const firebaseIdToken = await user.getIdToken().catch((error) => {
        console.warn("[Firebase token for cleanup failed]", error.message);
        return "";
      });

      if (firebaseIdToken) {
        await fetch(`${API_BASE_URL}/auth/discard-unverified-registration`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ firebaseIdToken })
        }).catch((error) => {
          console.warn("[Unverified profile cleanup failed]", error.message);
        });
      }

      await deleteUser(user).catch((error) => {
        console.warn("[Unverified Firebase account cleanup failed]", error.message);
      });

      if (auth.currentUser) {
        await signOut(auth).catch((error) => {
          console.warn("[Sign out after email change failed]", error.message);
        });
      }
    } else {
      await signOut(auth).catch((error) => {
        console.warn("[Sign out before email change failed]", error.message);
      });
    }

    stopResendCooldown();
    pendingVerificationEmail = "";
    localStorage.removeItem("pending_verify_email");
    localStorage.removeItem("pending_verify_password");

    const registerSection = document.getElementById("register-section");
    const authModal = registerSection?.closest(".auth-modal-overlay") || document.getElementById("authModal");
    const authCard = authModal?.querySelector(".auth-modal-card");
    const title = registerSection?.querySelector(".auth-title");
    const intro = registerSection?.querySelector(".auth-switch-inline");
    const form = document.getElementById("register-form");
    const bottomSwitch = registerSection?.querySelector(".auth-bottom-switch");
    const screen = document.getElementById("email-verification-screen");
    const emailInput = document.getElementById("reg-email");

    if (screen) screen.remove();
    authModal?.classList.remove("email-verification-mode");
    authCard?.removeAttribute("aria-hidden");
    authCard?.style.removeProperty("display");
    if (title) title.classList.remove("hidden");
    if (intro) intro.classList.remove("hidden");
    if (form) form.classList.remove("hidden");
    if (bottomSwitch) bottomSwitch.classList.remove("hidden");
    if (emailInput) {
      emailInput.value = "";
      emailInput.focus();
    }

    resetRegisterCaptcha();
  } finally {
    if (changeButton) {
      changeButton.disabled = false;
      changeButton.removeAttribute("aria-busy");
    }
  }
}

function startResendCooldown() {
  stopResendCooldown();
  verificationResendRemaining = RESEND_COOLDOWN_SECONDS;
  updateResendButton();
  verificationResendTimer = window.setInterval(() => {
    verificationResendRemaining -= 1;
    updateResendButton();

    if (verificationResendRemaining <= 0) {
      stopResendCooldown();
      updateResendButton();
    }
  }, 1000);
}

function stopResendCooldown() {
  if (verificationResendTimer) {
    window.clearInterval(verificationResendTimer);
  }

  verificationResendTimer = null;
  verificationResendRemaining = 0;
}

function updateResendButton() {
  const button = document.getElementById("resend-email-verification-btn");
  const countdown = document.getElementById("email-verification-countdown");
  if (!button) return;

  if (verificationResendRemaining > 0) {
    button.disabled = true;
    button.textContent = formatResendTime(verificationResendRemaining);
    if (countdown) countdown.textContent = "Resend in";
    return;
  }

  button.disabled = false;
  button.textContent = "Resend Code";
  if (countdown) countdown.textContent = "";
}

function formatResendTime(seconds = 0) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function maskEmail(email = "") {
  const [name = "", domain = ""] = email.split("@");
  if (!domain) return email;

  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"*".repeat(Math.max(name.length - visible.length, 3))}@${domain}`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[character]));
}

function setupConsentLinks() {
  ensurePolicyModals();

  document.querySelectorAll("[data-auth-consent-link]").forEach((link) => {
    if (link.dataset.bound === "true") return;
    link.dataset.bound = "true";

    link.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      const type = link.dataset.authConsentLink;
      openPolicyModal(type, link);
    });
  });
}

function ensurePolicyModals() {
  if (document.getElementById("auth-policy-modal-terms-privacy")) return;

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <div class="auth-policy-modal-overlay hidden" id="auth-policy-modal-terms-privacy" data-policy-modal="terms-privacy" aria-hidden="true">
        <section class="auth-policy-modal" role="dialog" aria-modal="true" aria-labelledby="auth-policy-title-terms-privacy" tabindex="-1">
          <header class="auth-policy-modal-head">
            <button type="button" class="auth-policy-modal-close" data-policy-close aria-label="Close ANIMUA Terms and Privacy Notice">
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
            <div class="auth-policy-brand" aria-hidden="true">
              <span class="auth-policy-brand-mark"><i class="fa-solid fa-paw"></i></span>
              <span>
                <strong>animua</strong>
                <small>ANGELES CITY ANIMAL WELFARE PORTAL</small>
              </span>
            </div>
            <h2 id="auth-policy-title-terms-privacy"><span>Terms and Privacy Notice</span></h2>
            <p>Please read these Terms and Privacy Notice before creating your ANIMUA account.</p>
          </header>
          <div class="auth-policy-modal-body">
            <div class="auth-policy-card-grid">
              <section class="auth-policy-section">
                <span class="auth-policy-section-icon" aria-hidden="true"><i class="fa-regular fa-file-lines"></i></span>
                <div class="auth-policy-section-copy">
                  <h3>Terms of Use</h3>
                  <ul>
                    <li>Provide accurate account and request details.</li>
                    <li>Keep your login credentials secure.</li>
                    <li>Do not submit false, abusive, or misleading requests.</li>
                    <li>Applications and surrender requests are reviewed before approval.</li>
                  </ul>
                </div>
              </section>
              <section class="auth-policy-section">
                <span class="auth-policy-section-icon" aria-hidden="true"><i class="fa-solid fa-lock"></i></span>
                <div class="auth-policy-section-copy">
                  <h3>Privacy Notice</h3>
                  <ul>
                    <li>We collect contact details, request forms, quiz answers, and uploaded documents.</li>
                    <li>Your data is used to manage accounts, matches, applications, and shelter updates.</li>
                    <li>Only authorized personnel can access your information.</li>
                    <li>We share data only when required by law, shelter service needs, or your consent.</li>
                  </ul>
                </div>
              </section>
            </div>
            <div class="auth-policy-privacy-note">
              <span class="auth-policy-ack-icon" aria-hidden="true"><i class="fa-solid fa-paw"></i></span>
              <p>Your information is used only for ANIMUA services and handled by authorized personnel.</p>
            </div>
          </div>
          <footer class="auth-policy-modal-actions">
            <label class="auth-policy-consent" for="auth-policy-modal-consent">
              <input type="checkbox" id="auth-policy-modal-consent">
              <span class="auth-policy-consent-box" aria-hidden="true"></span>
              <span>I have read, understood, and agree to the <strong>Terms &amp; Privacy Notice.</strong></span>
            </label>
            <div class="auth-policy-action-row">
              <button type="button" class="auth-policy-action auth-policy-action-secondary" data-policy-close>Cancel</button>
              <button type="button" class="auth-policy-action auth-policy-action-primary" data-policy-accept>
                <i class="fa-solid fa-paw" aria-hidden="true"></i>
                <span>Agree &amp; Continue</span>
              </button>
            </div>
          </footer>
        </section>
      </div>
    `
  );

  document.querySelectorAll(".auth-policy-modal-overlay").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closePolicyModal();
    });

    modal.querySelectorAll("[data-policy-close]").forEach((button) => {
      button.addEventListener("click", closePolicyModal);
    });

    modal.querySelectorAll("[data-policy-accept]").forEach((button) => {
      button.addEventListener("click", () => {
        const modalConsent = document.getElementById("auth-policy-modal-consent");
        const termsInput = document.getElementById("reg-terms");
        const termsError = document.getElementById("reg-terms-error");

        if (modalConsent) modalConsent.checked = true;
        if (termsInput) {
          termsInput.checked = true;
          termsInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
        if (termsError) termsError.textContent = "";

        closePolicyModal();
      });
    });
  });

  const modalConsent = document.getElementById("auth-policy-modal-consent");
  modalConsent?.addEventListener("change", () => {
    const termsInput = document.getElementById("reg-terms");
    const termsError = document.getElementById("reg-terms-error");

    if (termsInput) {
      termsInput.checked = modalConsent.checked;
      termsInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (modalConsent.checked && termsError) {
      termsError.textContent = "";
    }
  });
}

function openPolicyModal(type, trigger) {
  const modal = document.getElementById("auth-policy-modal-terms-privacy");
  if (!modal) return;

  const modalConsent = document.getElementById("auth-policy-modal-consent");
  const termsInput = document.getElementById("reg-terms");
  if (modalConsent && termsInput) {
    modalConsent.checked = termsInput.checked;
  }

  activePolicyModal = modal;
  activePolicyTrigger = trigger;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("legal-modal-open");

  policyModalKeydownHandler = (event) => {
    if (!activePolicyModal) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closePolicyModal();
      return;
    }

    if (event.key === "Tab") {
      trapPolicyModalFocus(event);
    }
  };

  document.addEventListener("keydown", policyModalKeydownHandler);

  const firstFocusable = getPolicyFocusableElements(modal)[0];
  (firstFocusable || modal.querySelector(".auth-policy-modal") || modal).focus();
}

function closePolicyModal() {
  if (!activePolicyModal) return;

  const modal = activePolicyModal;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("legal-modal-open");

  if (policyModalKeydownHandler) {
    document.removeEventListener("keydown", policyModalKeydownHandler);
  }

  policyModalKeydownHandler = null;
  activePolicyModal = null;

  if (activePolicyTrigger?.isConnected) {
    activePolicyTrigger.focus();
  }
  activePolicyTrigger = null;
}

function trapPolicyModalFocus(event) {
  const focusable = getPolicyFocusableElements(activePolicyModal);
  if (!focusable.length) {
    event.preventDefault();
    activePolicyModal.querySelector(".auth-policy-modal")?.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
    return;
  }

  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function getPolicyFocusableElements(container) {
  if (!container) return [];

  return Array.from(
    container.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => element.offsetParent !== null);
}

export function setupRegisterCaptcha() {
  const container = document.getElementById("register-recaptcha");
  if (!container) return;
  container.closest(".auth-recaptcha-row")?.classList.remove("hidden");
  renderRegisterCaptcha();

  if (!registerCaptchaResizeListenerBound) {
    registerCaptchaResizeListenerBound = true;
    window.addEventListener("resize", () => {
      window.clearTimeout(registerCaptchaResizeTimer);
      registerCaptchaResizeTimer = window.setTimeout(() => {
      const shouldUseCompact = window.matchMedia("(max-width: 330px)").matches;
        if (registerCaptchaIsCompact !== null && registerCaptchaIsCompact !== shouldUseCompact) {
          resetRegisterCaptcha(true);
          renderRegisterCaptcha();
        }
      }, 150);
    });
  }
}

function renderRegisterCaptcha() {
  const useCompactCaptcha = window.matchMedia("(max-width: 330px)").matches;
  if (registerCaptchaWidgetId !== null && registerCaptchaIsCompact === useCompactCaptcha) {
    return registerCaptchaRenderPromise;
  }

  if (!RECAPTCHA_SITE_KEY) {
    console.error("[Register Captcha Error] Missing reCAPTCHA site key.");
    return Promise.resolve(null);
  }

  registerCaptchaRenderPromise = loadRecaptchaApi()
    .then(() => {
      const container = document.getElementById("register-recaptcha");
      if (!container || registerCaptchaWidgetId !== null) return registerCaptchaWidgetId;

      registerCaptchaWidgetId = window.grecaptcha.render(container, {
        sitekey: RECAPTCHA_SITE_KEY,
        theme: "light",
        size: useCompactCaptcha ? "compact" : "normal",
        callback: () => setCaptchaError(""),
        "expired-callback": () => {
          setCaptchaError(CAPTCHA_EXPIRED_MESSAGE);
        },
        "error-callback": () => {
          setCaptchaError("Unable to complete CAPTCHA. Please try again.");
        }
      });
      registerCaptchaIsCompact = useCompactCaptcha;
      return registerCaptchaWidgetId;
    })
    .catch((error) => {
      console.error("[Register Captcha Error]", error);
      registerCaptchaRenderPromise = null;
      return null;
    });

  return registerCaptchaRenderPromise;
}

function getRegisterCaptchaToken() {
  if (registerCaptchaWidgetId === null || !window.grecaptcha?.getResponse) {
    return "";
  }

  return window.grecaptcha.getResponse(registerCaptchaWidgetId);
}

function resetRegisterCaptcha(clearContainer = false) {
  if (registerCaptchaWidgetId !== null && window.grecaptcha?.reset) {
    window.grecaptcha.reset(registerCaptchaWidgetId);
  }

  if (clearContainer) {
    const container = document.getElementById("register-recaptcha");
    if (container) container.innerHTML = "";
    registerCaptchaWidgetId = null;
    registerCaptchaRenderPromise = null;
    registerCaptchaIsCompact = null;
  }
}

function setCaptchaError(message) {
  const error = document.getElementById("reg-captcha-error");
  if (error) error.textContent = message;
}

function loadRecaptchaApi() {
  if (window.grecaptcha?.render) {
    return Promise.resolve();
  }

  if (window.animuaRecaptchaLoading) {
    return window.animuaRecaptchaLoading;
  }

  window.animuaRecaptchaLoading = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[src^="https://www.google.com/recaptcha/api.js"]');
    let attempts = 0;

    const waitForRender = () => {
      if (window.grecaptcha?.render) {
        resolve();
        return;
      }

      attempts += 1;
      if (attempts > 80) {
        reject(new Error("Google reCAPTCHA did not finish loading."));
        return;
      }

      window.setTimeout(waitForRender, 100);
    };

    window.animuaRecaptchaReady = waitForRender;

    if (existingScript) {
      waitForRender();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js?onload=animuaRecaptchaReady&render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = waitForRender;
    script.onerror = () => reject(new Error("Unable to load Google reCAPTCHA."));
    document.head.appendChild(script);
  });

  return window.animuaRecaptchaLoading;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setupRegisterCaptcha();
    setupConsentLinks();
  });
} else {
  setupRegisterCaptcha();
  setupConsentLinks();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(password);
}
