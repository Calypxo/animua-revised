import Swal from "sweetalert2";
import { auth, db } from "../utils/firebase.js";
import { API_BASE_URL } from "../utils/api.js";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";

const RECAPTCHA_SITE_KEY =
  import.meta.env?.VITE_RECAPTCHA_SITE_KEY ||
  window.ANIMUA_RECAPTCHA_SITE_KEY ||
  "";
const LOGIN_FAILURE_LIMIT = 3;
const LOGIN_CAPTCHA_MESSAGE = "Please complete the CAPTCHA before logging in.";

let loginCaptchaWidgetId = null;
let loginCaptchaRenderPromise = null;

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
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password, captchaToken })
    });

    const data = await response.json();

    if (!response.ok) {
      recordFailedLogin(email);
      if (shouldShowLoginCaptcha(email, response.status, data)) {
        showLoginCaptcha();
        resetLoginCaptcha();
      }

      Swal.fire({
        icon: "error",
        title: "Login Failed",
        text: data.message || "Incorrect email or password.",
        customClass: {
          popup: "animua-popup",
          confirmButton: "animua-confirm"
        },
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
      // SAVE FOR LOGIN AFTER MANUAL EMAIL VERIFICATION
      localStorage.setItem("pending_verify_email", email);
      localStorage.setItem("pending_verify_password", password);

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

    if (firebaseUser.emailVerified) {
      // Keep login moving; this status sync is not required before redirecting.
      updateDoc(doc(db, "users", firebaseUser.email.toLowerCase()), {
        emailVerified: true,
        status: "Active"
      }).catch((error) => {
        console.warn("[User status sync failed]", error.message);
      });
    }

    const account = data.account || {};
    const userRole = account.role || data.role || "Public";
    const userFullName = account.fullName || data.fullName || "User";
    const userEmail = account.email || data.email || email;
    const userProfilePhoto = account.profilePhotoDataUrl || "";

    clearFailedLogin(email);
    resetLoginCaptcha();
    hideLoginCaptcha();

    localStorage.setItem("animua_token", data.token || "");
    localStorage.setItem("user_role", userRole);
    localStorage.setItem("user_name", userFullName);
    localStorage.setItem("user_email", userEmail);
    localStorage.setItem("is_logged_in", "true");
    if (userProfilePhoto) {
      localStorage.setItem("user_profile_photo", userProfilePhoto);
    } else {
      localStorage.removeItem("user_profile_photo");
    }

    closeModal(authModal);

    await Swal.fire({
      icon: "success",
      title: "Login Successful",
      text: `Welcome back, ${userFullName}!`,
      timer: 1800,
      showConfirmButton: false,
      timerProgressBar: true,
      customClass: {
        popup: "animua-popup"
      }
    });

    if (userRole === "Admin" || userRole === "Staff") {
      window.location.replace("/pages/dashboard.html");
    } else {
      const pendingPetId = localStorage.getItem("animua_selected_pet_id");
      const pendingAction = localStorage.getItem("animua_selected_pet_action");

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

function closeModal(authModal) {
  if (authModal) authModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
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

function getLoginFailureKey(email = "") {
  return `animua_login_failures:${email || "unknown"}`;
}

function getFailedLoginCount(email) {
  return Number(localStorage.getItem(getLoginFailureKey(email)) || "0");
}

function recordFailedLogin(email) {
  if (!email) return;
  localStorage.setItem(getLoginFailureKey(email), String(getFailedLoginCount(email) + 1));
}

function clearFailedLogin(email) {
  if (!email) return;
  localStorage.removeItem(getLoginFailureKey(email));
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
  if (!container || loginCaptchaWidgetId !== null) {
    return loginCaptchaRenderPromise || Promise.resolve();
  }

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
