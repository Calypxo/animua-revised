import Swal from "sweetalert2";
import { auth } from "../utils/firebase.js";
import { API_BASE_URL } from "../utils/api.js";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { showEmailVerificationScreen } from "./register.js";
import { clearUserSession, setUserSession } from "../utils/storage.js";

const RECAPTCHA_SITE_KEY =
  import.meta.env?.VITE_RECAPTCHA_SITE_KEY ||
  window.ANIMUA_RECAPTCHA_SITE_KEY ||
  "";
const LOGIN_FAILURE_LIMIT = 3;
const LOGIN_CAPTCHA_MESSAGE = "Please complete the CAPTCHA before logging in.";

let loginCaptchaWidgetId = null;
let loginCaptchaRenderPromise = null;
const failedLoginCounts = new Map();

export async function handleLogin(event) {
  event.preventDefault();

  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const authModal = document.getElementById("authModal");
  const submitButton = event.currentTarget?.querySelector(".auth-submit-btn");

  const email = emailInput?.value.trim().toLowerCase();
  const password = passwordInput?.value;
  const captchaRequired = isLoginCaptchaRequired(email);
  let captchaToken = "";

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

  if (captchaRequired) {
    showLoginCaptcha();
    captchaToken = getLoginCaptchaToken();

    if (!captchaToken) {
      setLoginCaptchaError(LOGIN_CAPTCHA_MESSAGE);
      return;
    }
  }

  setSubmitLoading(submitButton, true, "Logging in...");

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password, captchaToken })
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 403 && data.verificationRequired === true) {
        try {
          await signInWithEmailAndPassword(auth, email, password);
          clearFailedLogin(email);
          resetLoginCaptcha();
          hideLoginCaptcha();
          showRegistrationVerificationView(authModal);
          await showEmailVerificationScreen(email);
        } catch (verificationError) {
          console.error("[Resume Email Verification Error]", verificationError);
          recordFailedLogin(email);
          await Swal.fire({
            icon: "error",
            title: "Unable to Resume Verification",
            text: getFirebaseLoginErrorMessage(verificationError),
            confirmButtonText: "OK",
            customClass: {
              popup: "animua-popup animua-auth-feedback-popup",
              confirmButton: "animua-confirm"
            },
            buttonsStyling: false
          });
        }
        return;
      }

      recordFailedLogin(email);
      if (shouldShowLoginCaptcha(email, response.status, data)) {
        showLoginCaptcha();
        resetLoginCaptcha();
      }

      Swal.fire({
        icon: "error",
        title: "Login Failed",
        html: `
          <p>Invalid email or password.</p>
          <p>Please check your credentials and try again.</p>
        `,
        confirmButtonText: "OK",
        customClass: {
          popup: "animua-popup animua-auth-feedback-popup",
          icon: "animua-auth-feedback-icon",
          closeButton: "animua-feedback-close",
          confirmButton: "animua-confirm"
        },
        showCloseButton: true,
        buttonsStyling: false
      });
      return;
    }

    // FIREBASE AUTH LOGIN
    const firebaseCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = firebaseCredential.user;

    // REFRESH USER DATA TO GET LATEST EMAIL VERIFICATION STATUS
    await firebaseUser.reload();

    if (!firebaseUser.emailVerified && !data.phoneVerified) {
      await signOut(auth);

      closeModal(authModal);
      await Swal.fire({
        icon: "info",
        title: "Account Not Verified",
        text: "Please verify your email or phone number before logging in.",
        customClass: {
          popup: "animua-popup",
          confirmButton: "animua-confirm"
        },
        buttonsStyling: false
      });

      return;
    }

    const account = data.account || {};
    const userRole = account.role || data.role || "Public";
    const userFullName = account.fullName || data.fullName || "User";
    const userEmail = account.email || data.email || email;
    const userProfilePhoto = account.profilePhotoDataUrl || "";

    clearFailedLogin(email);
    resetLoginCaptcha();
    hideLoginCaptcha();

    clearUserSession();
    setUserSession({
      ...account,
      role: userRole,
      fullName: userFullName,
      email: userEmail,
      profilePhotoDataUrl: userProfilePhoto,
    });
    sessionStorage.setItem("show_welcome_toast", "true");

    closeModal(authModal);

    await Swal.fire({
      icon: "success",
      title: "Login Successful",
      html: `
        <p>Welcome back!</p>
        <p>You have successfully logged in to ANIMUA.</p>
      `,
      timer: 1600,
      timerProgressBar: true,
      showConfirmButton: false,
      showCloseButton: false,
      customClass: {
        popup: "animua-popup animua-auth-feedback-popup",
        icon: "animua-auth-feedback-icon",
        closeButton: "animua-feedback-close",
        confirmButton: "animua-confirm"
      },
      buttonsStyling: false
    });

    if (userRole === "Admin" || userRole === "Staff") {
      window.location.replace("/pages/dashboard.html");
    } else {
      const pendingPetId = sessionStorage.getItem("animua_selected_pet_id");
      const pendingAction = sessionStorage.getItem("animua_selected_pet_action");

      if (pendingPetId && pendingAction === "adopt") {
        window.location.replace("/pages/public/find-furbabies.html");
      } else {
        window.location.replace("/pages/public/home.html");
      }
    }
  } catch (error) {
    console.error("[Login Error]", error);
    recordFailedLogin(email);
    if (shouldShowLoginCaptcha(email, 0, { message: error.message })) {
      showLoginCaptcha();
    }

    closeModal(authModal);
    Swal.fire({
      icon: "error",
      title: "Connection Error",
      text: error.message || "Cannot connect to the backend. Please check your internet or server status.",
      customClass: {
        popup: "animua-popup",
        confirmButton: "animua-confirm"
      },
      buttonsStyling: false
    });
  } finally {
    setSubmitLoading(submitButton, false);
  }
}

function showRegistrationVerificationView(authModal) {
  const loginSection = document.getElementById("login-section");
  const registerSection = document.getElementById("register-section");

  loginSection?.classList.add("hidden");
  registerSection?.classList.remove("hidden");
  authModal?.classList.remove("hidden");
  authModal?.classList.add("register-mode");
  document.body.classList.add("modal-open", "auth-open");
}

function getFirebaseLoginErrorMessage(error) {
  if (
    error?.code === "auth/invalid-credential" ||
    error?.code === "auth/wrong-password" ||
    error?.code === "auth/user-not-found"
  ) {
    return "The email or password is incorrect. Use the password originally entered for this account.";
  }

  if (error?.code === "auth/too-many-requests") {
    return "Firebase temporarily blocked repeated attempts. Please wait a few minutes and try again.";
  }

  return error?.message || "Firebase could not restore this account verification session.";
}

function closeModal(authModal) {
  if (authModal) authModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  document.body.classList.remove("auth-open");
}

function setSubmitLoading(button, isLoading, loadingText = "Please wait...") {
  if (!button) return;

  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    return;
  }

  button.textContent = button.dataset.originalText || "Log In";
  button.disabled = false;
  button.removeAttribute("aria-busy");
  delete button.dataset.originalText;
}

function getFailedLoginCount(email) {
  return failedLoginCounts.get(email) || 0;
}

function recordFailedLogin(email) {
  if (!email) return;
  failedLoginCounts.set(email, getFailedLoginCount(email) + 1);
}

function clearFailedLogin(email) {
  if (!email) return;
  failedLoginCounts.delete(email);
}

function isLoginCaptchaRequired(email) {
  return getFailedLoginCount(email) >= LOGIN_FAILURE_LIMIT;
}

function isSuspiciousLoginActivity(status, data = {}) {
  const message = String(data.message || "").toLowerCase();
  return (
    status === 429 ||
    message.includes("suspicious") ||
    message.includes("too many") ||
    message.includes("captcha")
  );
}

function shouldShowLoginCaptcha(email, status, data) {
  return isLoginCaptchaRequired(email) || isSuspiciousLoginActivity(status, data);
}

function showLoginCaptcha() {
  const row = document.getElementById("login-captcha-row");
  if (row) row.classList.remove("hidden");
  renderLoginCaptcha();
}

function hideLoginCaptcha() {
  const row = document.getElementById("login-captcha-row");
  const error = document.getElementById("login-captcha-error");
  if (row) row.classList.add("hidden");
  if (error) error.textContent = "";
}

function renderLoginCaptcha() {
  const container = document.getElementById("login-recaptcha");
  if (!container || loginCaptchaWidgetId !== null) return Promise.resolve();
  if (loginCaptchaRenderPromise) return loginCaptchaRenderPromise;

  if (!RECAPTCHA_SITE_KEY) {
    console.error("[Login Captcha Error] Missing reCAPTCHA site key.");
    setLoginCaptchaError(LOGIN_CAPTCHA_MESSAGE);
    return Promise.resolve();
  }

  loginCaptchaRenderPromise = loadRecaptchaApi()
    .then(() => {
      loginCaptchaWidgetId = window.grecaptcha.render(container, {
        sitekey: RECAPTCHA_SITE_KEY,
        theme: "light",
        callback: () => setLoginCaptchaError(""),
        "expired-callback": () => setLoginCaptchaError(LOGIN_CAPTCHA_MESSAGE),
        "error-callback": () => setLoginCaptchaError(LOGIN_CAPTCHA_MESSAGE)
      });
    })
    .catch((error) => {
      console.error("[Login Captcha Error]", error);
      setLoginCaptchaError(LOGIN_CAPTCHA_MESSAGE);
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

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
