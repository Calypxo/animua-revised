import Swal from "sweetalert2";
import { API_BASE_URL } from "../utils/api.js";
import { clearUserSession, endUserSession, setUserSession } from "../utils/storage.js";
import { normalizeRole } from "../auth/permissions.js";
import { initializeManagementRecovery } from "./managementRecovery.js";

const RECAPTCHA_SITE_KEY =
  import.meta.env?.VITE_RECAPTCHA_SITE_KEY ||
  window.ANIMUA_RECAPTCHA_SITE_KEY ||
  "";
const LOGIN_CAPTCHA_MESSAGE = "Please complete the CAPTCHA before logging in.";
let loginCaptchaWidgetId = null;
let loginCaptchaRenderPromise = null;
 
// ── HELPERS ────────────────────────────────────────────
function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function getVal(id) { return document.getElementById(id)?.value?.trim() || ""; }
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}
function showErr(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = "block"; }
}
function clearErrors() {
  document.querySelectorAll(".field-error").forEach(e => {
    e.textContent = ""; e.style.display = "none";
  });
}
function setLoading(loading) {
  const btn  = document.getElementById("loginBtn");
  const spin = document.getElementById("loginSpinner");
  const txt  = document.getElementById("loginBtnText");
  if (!btn) return;
  btn.disabled = loading;
  if (spin) spin.style.display = loading ? "inline-block" : "none";
  if (txt)  txt.textContent   = loading ? "Signing in…" : "Sign In";
}

const MANAGEMENT_ROLES = [
  "Admin",
  "Staff",
  "Veterinarian",
];
 
const swalCfg = {
  customClass: { popup: "animua-swal-popup", confirmButton: "animua-swal-btn" },
  buttonsStyling: false,
};

function showLoginWelcome({ fullName, role }) {
  const safeName = escapeHtml(fullName);
  const safeRole = escapeHtml(role);
  const firstName = escapeHtml(String(fullName || "User").trim().split(/\s+/)[0]);

  return Swal.fire({
    icon: "success",
    title: `Welcome back, ${firstName}!`,
    html: `
      <div class="login-welcome-copy">
        <span class="login-welcome-kicker">
          <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
          Secure management session
        </span>
        <p>Good to have you back. Your ANIMUA shelter workspace is ready.</p>
        <div class="login-welcome-access" aria-label="Active signed-in account">
          <span class="login-welcome-access-icon" aria-hidden="true">
            <i class="fa-solid fa-user-check"></i>
          </span>
          <span class="login-welcome-identity">
            <small>Signed in as</small>
            <strong>${safeName}</strong>
          </span>
          <span class="login-welcome-role">
            <span class="login-welcome-status-dot" aria-hidden="true"></span>
            ${safeRole}
          </span>
        </div>
      </div>
    `,
    timer: 2200,
    timerProgressBar: true,
    showConfirmButton: false,
    allowOutsideClick: false,
    allowEscapeKey: false,
    buttonsStyling: false,
    customClass: {
      container: "animua-login-welcome-container",
      popup: "animua-swal-popup animua-login-welcome",
      icon: "animua-login-welcome-icon",
      title: "animua-login-welcome-title",
      htmlContainer: "animua-login-welcome-content",
      timerProgressBar: "animua-login-welcome-progress",
    },
  });
}
 
// ── LOGIN ──────────────────────────────────────────────
async function handleAdminLogin(e) {
  e.preventDefault();
  clearErrors();
 
  const email    = getVal("login-email");
  const password = document.getElementById("login-password")?.value || "";
  const captchaRow = document.getElementById("login-captcha-row");
  const captchaRequired = Boolean(captchaRow && !captchaRow.hidden);
  const captchaToken = captchaRequired ? getLoginCaptchaToken() : "";
 
  let valid = true;
  if (!email) {
    showErr("err-email", "Email is required."); valid = false;
  } else if (!isValidEmail(email)) {
    showErr("err-email", "Enter a valid email address."); valid = false;
  }
  if (!password) {
    showErr("err-password", "Password is required."); valid = false;
  } else if (password.length < 6) {
    showErr("err-password", "Password must be at least 6 characters."); valid = false;
  }
  if (!valid) return;

  if (captchaRequired && !captchaToken) {
    setLoginCaptchaError(LOGIN_CAPTCHA_MESSAGE);
    return;
  }
 
  setLoading(true);
 
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.toLowerCase(),
        password,
        captchaToken,
        portal: "management",
      }),
    });
 
    let data = {};
    try { data = await res.json(); } catch (_) {}
 
    if (!res.ok) {
      if (data.captchaRequired === true || data.code === "CAPTCHA_REQUIRED") {
        showLoginCaptcha();
        resetLoginCaptcha();
        setLoginCaptchaError(
          data.code === "CAPTCHA_REQUIRED"
            ? (data.message || LOGIN_CAPTCHA_MESSAGE)
            : ""
        );
      }
      if (res.status === 403 && data.code !== "CAPTCHA_REQUIRED") {
        await Swal.fire({ icon:"error", title:"Account Deactivated", text: data.message || "Your account has been deactivated. Contact a system administrator.", confirmButtonText:"OK", ...swalCfg });
        return;
      }
      await Swal.fire({
        icon:"error",
        title: res.status === 429 ? "Too Many Attempts" : "Login Failed",
        text: data.message || "Invalid email or password.",
        confirmButtonText:"Try Again",
        ...swalCfg,
      });
      return;
    }
 
    const role     = normalizeRole(data.role);
    const fullName = data.fullName || "User";
 
 if (!MANAGEMENT_ROLES.includes(role)) {
  await endUserSession();
  await Swal.fire({
    icon: "warning",
    title: "Access Denied",
    text: "This account is not authorized to access the management portal.",
    confirmButtonText: "OK",
    ...swalCfg,
  });

  return;
}
 
    clearUserSession();
    resetLoginCaptcha();
    hideLoginCaptcha();
    setUserSession({ role, fullName, email: data.email || email.toLowerCase() });
 
    await showLoginWelcome({ fullName, role });
 
    window.location.replace("/pages/dashboard.html");
 
  } catch (err) {
    console.error("[Admin Login Error]", err);
    const isNet = err instanceof TypeError && err.message === "Failed to fetch";
    await Swal.fire({
      icon: "error",
      title: isNet ? "Cannot Reach Server" : "Login Error",
      html: isNet
        ? `<p>Unable to connect to the backend.</p><p style="margin-top:8px;font-size:12px;color:#7a7870;">Endpoint: <code>${API_BASE_URL}</code></p>`
        : (err.message || "Something went wrong."),
      confirmButtonText: "OK", ...swalCfg,
    });
  } finally {
    setLoading(false);
  }
}

function showLoginCaptcha() {
  const row = document.getElementById("login-captcha-row");
  if (row) row.hidden = false;
  renderLoginCaptcha();
}

function hideLoginCaptcha() {
  const row = document.getElementById("login-captcha-row");
  const error = document.getElementById("login-captcha-error");
  if (row) row.hidden = true;
  if (error) {
    error.textContent = "";
    error.style.display = "none";
  }
}

function renderLoginCaptcha() {
  const container = document.getElementById("login-recaptcha");
  if (!container || loginCaptchaWidgetId !== null) return Promise.resolve();
  if (loginCaptchaRenderPromise) return loginCaptchaRenderPromise;

  if (!RECAPTCHA_SITE_KEY) {
    setLoginCaptchaError("CAPTCHA is not configured. Contact the administrator.");
    return Promise.resolve();
  }

  loginCaptchaRenderPromise = loadRecaptchaApi()
    .then(() => {
      loginCaptchaWidgetId = window.grecaptcha.render(container, {
        sitekey: RECAPTCHA_SITE_KEY,
        theme: "light",
        callback: () => setLoginCaptchaError(""),
        "expired-callback": () => setLoginCaptchaError(LOGIN_CAPTCHA_MESSAGE),
        "error-callback": () => setLoginCaptchaError(LOGIN_CAPTCHA_MESSAGE),
      });
    })
    .catch((error) => {
      console.error("[Management Login Captcha Error]", error);
      setLoginCaptchaError("Unable to load CAPTCHA. Please try again.");
      loginCaptchaRenderPromise = null;
    });

  return loginCaptchaRenderPromise;
}

function getLoginCaptchaToken() {
  if (loginCaptchaWidgetId === null) {
    renderLoginCaptcha();
    return "";
  }
  return window.grecaptcha?.getResponse(loginCaptchaWidgetId) || "";
}

function resetLoginCaptcha() {
  if (loginCaptchaWidgetId !== null && window.grecaptcha?.reset) {
    window.grecaptcha.reset(loginCaptchaWidgetId);
  }
}

function setLoginCaptchaError(message) {
  const error = document.getElementById("login-captcha-error");
  if (!error) return;
  error.textContent = message;
  error.style.display = message ? "block" : "none";
}

function loadRecaptchaApi() {
  if (window.grecaptcha?.render) return Promise.resolve();
  if (window.animuaRecaptchaLoading) return window.animuaRecaptchaLoading;

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
 
// ── PASSWORD TOGGLE ────────────────────────────────────
(function setupToggle() {
  const btn   = document.getElementById("togglePassword");
  const field = document.getElementById("login-password");
  const icon  = document.getElementById("eye-icon");
  if (!btn || !field || !icon) return;
 
  const eyeOpen = `<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>`;
  const eyeClosed = `<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-10-8-10-8a18.44 18.44 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 10 8 10 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;

  icon.innerHTML = eyeClosed;
 
  btn.addEventListener("click", () => {
    const show = field.type === "password";
    field.type = show ? "text" : "password";
    icon.innerHTML = show ? eyeOpen : eyeClosed;
    btn.setAttribute("aria-pressed", String(show));
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    btn.title = show ? "Hide password" : "Show password";
  });
})();
 
// ── INIT ───────────────────────────────────────────────
(async function init() {
  clearUserSession();

  try {
    const response = await fetch(`${API_BASE_URL}/protected`, {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (response.ok) {
      const data = await response.json();
      const serverRole = normalizeRole(data.user?.role);

      if (MANAGEMENT_ROLES.includes(serverRole)) {
        setUserSession(data.user);
        window.location.replace("/pages/dashboard.html");
        return;
      }
    }
  } catch (error) {
    console.warn("[Admin Session Restore] Backend validation unavailable:", error.message);
  }

  document.getElementById("login-form")?.addEventListener("submit", handleAdminLogin);
  initializeManagementRecovery();
})();
