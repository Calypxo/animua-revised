import Swal from "sweetalert2";
import { handleLogin } from "../../auth/login.js";
import { handleRegistration } from "../../auth/register.js";

const menuToggle = document.getElementById("menuToggle");
const navbar = document.getElementById("navbar");
const body = document.body;
const header = document.querySelector(".header");

const notificationBtn = document.getElementById("notificationBtn");
const notificationPopup = document.getElementById("notificationPopup");

const authModal = document.getElementById("authModal");
const openAuthModalBtn =
  document.getElementById("loginNavBtn") ||
  document.getElementById("openAuthModal");
const closeAuthModalBtn = document.getElementById("closeAuthModal");

const loginSection = document.getElementById("login-section");
const registerSection = document.getElementById("register-section");

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

const authSideTag = document.getElementById("authSideTag");
const authModalTitle = document.getElementById("authModalTitle");
const authSideText = document.getElementById("authSideText");

const revealElements = document.querySelectorAll(".reveal");

function clearFormErrors() {
  const errorIds = [
    "login-email-error",
    "login-password-error",
    "reg-name-error",
    "reg-email-error",
    "reg-password-error"
  ];

  errorIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });
}

function openAuthModal(event) {
  if (event) event.preventDefault();
  if (authModal) authModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeAuthModal() {
  if (authModal) authModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function showLoginView() {
  clearFormErrors();

  if (loginSection) loginSection.classList.remove("hidden");
  if (registerSection) registerSection.classList.add("hidden");

  if (authSideTag) authSideTag.textContent = "Welcome Back";
  if (authModalTitle) authModalTitle.innerHTML = "Hello,<br>Welcome back to Animua!";
  if (authSideText) {
    authSideText.textContent =
      "Log in to continue exploring rescued animals and shelter services.";
  }
}

function showRegisterView() {
  clearFormErrors();

  if (registerSection) registerSection.classList.remove("hidden");
  if (loginSection) loginSection.classList.add("hidden");

  if (authSideTag) authSideTag.textContent = "New Here?";
  if (authModalTitle) authModalTitle.innerHTML = "Create your<br>Animua account!";
  if (authSideText) {
    authSideText.textContent =
      "Join Animua and start connecting with rescued animals and shelter services.";
  }
}

function setupPasswordToggles() {
  if (document.body.dataset.passwordToggleBound === "true") return;
  document.body.dataset.passwordToggleBound = "true";

  document.addEventListener("click", (event) => {
    const toggle = event.target.closest(".toggle-password");
    if (!toggle) return;

    event.preventDefault();

    const targetId = toggle.getAttribute("data-target");
    const input = document.getElementById(targetId);
    const icon = toggle.querySelector("i");

    if (!input || !icon) return;

    if (input.type === "password") {
      input.type = "text";
      icon.classList.remove("fa-eye-slash");
      icon.classList.add("fa-eye");
    } else {
      input.type = "password";
      icon.classList.remove("fa-eye");
      icon.classList.add("fa-eye-slash");
    }
  });
}

function updateAuthUI() {
  const loginNavBtn = document.getElementById("loginNavBtn");
  const userLoggedInBox = document.getElementById("userLoggedInBox");
  const loggedUserName = document.getElementById("loggedUserName");
  const logoutBtn = document.getElementById("logoutBtn");

  const isLoggedIn = localStorage.getItem("is_logged_in") === "true";
  const userName = localStorage.getItem("user_name") || "User";

  if (isLoggedIn) {
    if (loginNavBtn) loginNavBtn.classList.add("hidden");
    if (userLoggedInBox) userLoggedInBox.classList.remove("hidden");
    if (loggedUserName) loggedUserName.textContent = userName;
  } else {
    if (loginNavBtn) loginNavBtn.classList.remove("hidden");
    if (userLoggedInBox) userLoggedInBox.classList.add("hidden");
  }

  if (logoutBtn && !logoutBtn.dataset.bound) {
    logoutBtn.dataset.bound = "true";
    logoutBtn.addEventListener("click", async () => {
      const result = await Swal.fire({
  icon: "question",
  title: "Logout",
  text: "Are you sure you want to log out?",
  showCancelButton: true,
  confirmButtonText: "Yes",
  cancelButtonText: "Cancel",
  customClass: {
    popup: "animua-popup",
    confirmButton: "animua-confirm",
    cancelButton: "animua-cancel"
  },
  buttonsStyling: false
});

      if (!result.isConfirmed) return;

      localStorage.removeItem("animua_token");
      localStorage.removeItem("user_role");
      localStorage.removeItem("user_name");
      localStorage.removeItem("user_email");
      localStorage.removeItem("is_logged_in");
      localStorage.removeItem("show_welcome_toast");

      window.location.href = "/pages/public/home.html";
    });
  }
}

function showWelcomeToastIfNeeded() {
  const shouldShow = localStorage.getItem("show_welcome_toast") === "true";
  const userName = localStorage.getItem("user_name") || "User";

  if (shouldShow) {
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: `Welcome, ${userName}!`,
      showConfirmButton: false,
      timer: 2500,
      timerProgressBar: true
    });

    localStorage.removeItem("show_welcome_toast");
  }
}

function setupRevealAnimations() {
  if ("IntersectionObserver" in window && revealElements.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("show");
          }
        });
      },
      {
        threshold: 0.15
      }
    );

    revealElements.forEach((element) => observer.observe(element));
  } else {
    revealElements.forEach((element) => element.classList.add("show"));
  }
}

window.toggleAuthView = function () {
  const loginVisible = loginSection && !loginSection.classList.contains("hidden");

  if (loginVisible) {
    showRegisterView();
  } else {
    showLoginView();
  }
};

if (menuToggle && navbar) {
  menuToggle.addEventListener("click", () => {
    navbar.classList.toggle("show");
    body.classList.toggle("menu-open");
  });
}

document.querySelectorAll(".navbar a").forEach((link) => {
  link.addEventListener("click", () => {
    if (navbar) {
      navbar.classList.remove("show");
    }
    body.classList.remove("menu-open");
  });
});

if (header) {
  window.addEventListener("scroll", () => {
    if (window.scrollY > 20) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  });
}

if (notificationBtn && notificationPopup) {
  notificationBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    notificationPopup.classList.toggle("show");
  });

  document.addEventListener("click", (event) => {
    if (
      !notificationPopup.contains(event.target) &&
      !notificationBtn.contains(event.target)
    ) {
      notificationPopup.classList.remove("show");
    }
  });
}

if (openAuthModalBtn) {
  openAuthModalBtn.addEventListener("click", openAuthModal);
}

if (closeAuthModalBtn) {
  closeAuthModalBtn.addEventListener("click", closeAuthModal);
}

if (authModal) {
  authModal.addEventListener("click", (event) => {
    if (event.target === authModal) {
      closeAuthModal();
    }
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", handleLogin);
}

if (registerForm) {
  registerForm.addEventListener("submit", handleRegistration);
}

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

function setupPasswordStrengthMeter() {
  const regPasswordInput = document.getElementById("reg-password");
  const strengthText = document.getElementById("password-strength-text");

  if (!regPasswordInput || !strengthText) return;

  regPasswordInput.addEventListener("input", () => {
    const password = regPasswordInput.value;

    if (!password) {
      strengthText.textContent = "";
      return;
    }

    if (commonPasswords.includes(password.toLowerCase())) {
      strengthText.textContent = "Very weak password";
      strengthText.style.color = "red";
      return;
    }

    let score = 0;

    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[@$!%*?&]/.test(password)) score++;

    if (score <= 2) {
      strengthText.textContent = "Weak password";
      strengthText.style.color = "red";
    } else if (score <= 4) {
      strengthText.textContent = "Medium password";
      strengthText.style.color = "orange";
    } else {
      strengthText.textContent = "Strong password";
      strengthText.style.color = "green";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupPasswordToggles();
  setupPasswordStrengthMeter();
  setupRevealAnimations();
  updateAuthUI();
  showWelcomeToastIfNeeded();

  if (loginSection && registerSection) {
    showLoginView();
  }

  if (window.location.pathname.includes("login.html") && authModal) {
    authModal.classList.remove("hidden");
  }
const shouldOpenAuthModal = localStorage.getItem("animua_open_auth_modal") === "true";
  if (shouldOpenAuthModal) {
    showLoginView();
    openAuthModal();
    localStorage.removeItem("animua_open_auth_modal");
  }
  
});