import Swal from "sweetalert2";
import { API_BASE_URL } from "../utils/api.js";
import { clearUserSession, endUserSession, setUserSession } from "../utils/storage.js";
import { normalizeRole } from "../auth/permissions.js";
 
// ── HELPERS ────────────────────────────────────────────
function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function getVal(id) { return document.getElementById(id)?.value?.trim() || ""; }
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
 
// ── LOGIN ──────────────────────────────────────────────
async function handleAdminLogin(e) {
  e.preventDefault();
  clearErrors();
 
  const email    = getVal("login-email");
  const password = document.getElementById("login-password")?.value || "";
 
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
 
  setLoading(true);
 
  try {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.toLowerCase(), password }),
    });
 
    let data = {};
    try { data = await res.json(); } catch (_) {}
 
    if (!res.ok) {
      if (res.status === 403) {
        await Swal.fire({ icon:"error", title:"Account Deactivated", text: data.message || "Your account has been deactivated. Contact a system administrator.", confirmButtonText:"OK", ...swalCfg });
        return;
      }
      await Swal.fire({ icon:"error", title:"Login Failed", text: data.message || "Invalid email or password.", confirmButtonText:"Try Again", ...swalCfg });
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
    setUserSession({ role, fullName, email: data.email || email.toLowerCase() });
    sessionStorage.setItem("show_welcome_toast", "true");
 
    await Swal.fire({
      icon: "success", title: "Welcome back", text: `Signed in as ${fullName}`,
      timer: 1600, showConfirmButton: false, timerProgressBar: true, ...swalCfg,
    });
 
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
})();
