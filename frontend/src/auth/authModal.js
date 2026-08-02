function updateAuthPanel() {
  const loginSection = document.getElementById("login-section");
  const isLoginVisible = loginSection && !loginSection.classList.contains("hidden");

  const authSideTag = document.getElementById("authSideTag");
  const authTitle = document.getElementById("authModalTitle");
  const authText = document.getElementById("authSideText");
  const authSideAction = document.getElementById("authSideAction");
  const authModal = document.getElementById("authModal");

  if (!authTitle || !authText) return;

  if (isLoginVisible) {
    if (authModal) authModal.classList.remove("register-mode");
    if (authSideTag) authSideTag.textContent = "Welcome Back";
    authTitle.textContent = "Welcome back to Animua";
    authText.innerHTML = 'Continue helping rescued animals find <span class="auth-gold">safer homes</span>.';
    if (authSideAction) authSideAction.textContent = "Sign up";
  } else {
    if (authModal) authModal.classList.add("register-mode");
    if (authSideTag) authSideTag.textContent = "New Here?";
    authTitle.textContent = "Join the Animua community";
    authText.innerHTML = 'Help rescued animals take their next step toward <span class="auth-gold">safer homes</span>.';
    if (authSideAction) authSideAction.textContent = "Sign in";
  }
}

function toggleAuthView() {
  const loginSection = document.getElementById("login-section");
  const registerSection = document.getElementById("register-section");

  if (!loginSection || !registerSection) return;

  const authModal = document.getElementById("authModal");
  if (authModal && authModal.classList.contains("auth-switching")) return;

  const loginVisible = !loginSection.classList.contains("hidden");
  const currentSection = loginVisible ? loginSection : registerSection;
  const nextSection = loginVisible ? registerSection : loginSection;

  if (authModal) {
    authModal.classList.remove("slide-to-register", "slide-to-login");
    authModal.classList.add(loginVisible ? "slide-to-register" : "slide-to-login");
    authModal.classList.add("auth-switching");
    window.setTimeout(() => {
      authModal.classList.remove("auth-switching", "slide-to-register", "slide-to-login");
    }, 480);
  }

  nextSection.classList.add("hidden");
  nextSection.classList.remove("auth-view-exit", "auth-view-enter");
  currentSection.classList.remove("auth-view-exit", "auth-view-enter");
  currentSection.classList.add("auth-view-exit");
  window.setTimeout(() => {
    currentSection.classList.add("hidden");
    currentSection.classList.remove("auth-view-exit");
    nextSection.classList.remove("hidden");
    nextSection.classList.add("auth-view-enter");
  }, 120);

  window.setTimeout(() => {
    nextSection.classList.remove("auth-view-enter");
  }, 260);

  clearAuthErrors();
  if (authModal) {
    if (loginVisible) {
      authModal.classList.add("register-mode");
    } else {
      authModal.classList.remove("register-mode");
    }
  }

  const authSideTag = document.getElementById("authSideTag");
  const authTitle = document.getElementById("authModalTitle");
  const authText = document.getElementById("authSideText");
  const authSideAction = document.getElementById("authSideAction");

  if (loginVisible) {
    if (authSideTag) authSideTag.textContent = "New Here?";
    if (authTitle) authTitle.textContent = "Join the Animua community";
    if (authText) authText.innerHTML = 'Help rescued animals take their next step toward <span class="auth-gold">safer homes</span>.';
    if (authSideAction) authSideAction.textContent = "Sign in";
  } else {
    if (authSideTag) authSideTag.textContent = "Welcome Back";
    if (authTitle) authTitle.textContent = "Welcome back to Animua";
    if (authText) authText.innerHTML = 'Continue helping rescued animals find <span class="auth-gold">safer homes</span>.';
    if (authSideAction) authSideAction.textContent = "Sign up";
  }
}

function openAuthModal() {
  const authModal = document.getElementById("authModal");
  if (!authModal) return;

  if (localStorage.getItem("animua_token")) {
    closeAuthModal();
    return;
  }

  authModal.classList.remove("hidden");
  document.body.classList.add("auth-open");
  document.body.classList.add("modal-open");
  updateAuthPanel();
}

function closeAuthModal() {
  const authModal = document.getElementById("authModal");
  if (!authModal) return;

  authModal.classList.add("hidden");
  document.body.classList.remove("auth-open");
  document.body.classList.remove("modal-open");
  clearAuthErrors();
}

function setError(id, message) {
  const errorElement = document.getElementById(id);
  if (errorElement) {
    errorElement.textContent = message;
  }
}

function clearAuthErrors() {
  document.querySelectorAll(".auth-error").forEach((error) => {
    error.textContent = "";
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateLoginForm() {
  clearAuthErrors();

  const email = document.getElementById("login-email")?.value.trim() || "";
  const password = document.getElementById("login-password")?.value || "";
  let isValid = true;

  if (!email) {
    setError("login-email-error", "Email is required.");
    isValid = false;
  } else if (!isValidEmail(email)) {
    setError("login-email-error", "Please enter a valid email.");
    isValid = false;
  }

  if (!password) {
    setError("login-password-error", "Password is required.");
    isValid = false;
  } else if (password.length < 6) {
    setError("login-password-error", "Password must be at least 6 characters.");
    isValid = false;
  }

  return isValid;
}

function validateRegisterForm() {
  clearAuthErrors();

  const firstName = document.getElementById("reg-first-name")?.value.trim() || "";
  const lastName = document.getElementById("reg-last-name")?.value.trim() || "";
  const email = document.getElementById("reg-email")?.value.trim() || "";
  const password = document.getElementById("reg-password")?.value || "";
  let isValid = true;

  if (!firstName) {
    setError("reg-first-name-error", "First name is required.");
    isValid = false;
  } else if (firstName.length < 2) {
    setError("reg-first-name-error", "First name must be at least 2 characters.");
    isValid = false;
  }

  if (!lastName) {
    setError("reg-last-name-error", "Last name is required.");
    isValid = false;
  } else if (lastName.length < 2) {
    setError("reg-last-name-error", "Last name must be at least 2 characters.");
    isValid = false;
  }

  if (!email) {
    setError("reg-email-error", "Email is required.");
    isValid = false;
  } else if (!isValidEmail(email)) {
    setError("reg-email-error", "Please enter a valid email.");
    isValid = false;
  }

  if (!password) {
    setError("reg-password-error", "Password is required.");
    isValid = false;
  } else if (password.length < 6) {
    setError("reg-password-error", "Password must be at least 6 characters.");
    isValid = false;
  }

  return isValid;
}

function setupPasswordToggles() {
  const toggles = document.querySelectorAll(".toggle-password");

  toggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const targetId = toggle.getAttribute("data-target");
      const input = document.querySelector(`#${targetId}`);
      const icon = toggle.querySelector("i");
      console.log(input);

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
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const openBtn = document.getElementById("openAuthModal");
  const closeBtn = document.getElementById("closeAuthModal");
  const authModal = document.getElementById("authModal");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");

  console.log("openBtn:", openBtn);
  console.log("authModal:", authModal);

  if (openBtn) {
    openBtn.addEventListener("click", (event) => {
      event.preventDefault();
      openAuthModal();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      closeAuthModal();
    });
  }

  if (authModal) {
    authModal.addEventListener("click", (event) => {
      if (event.target === authModal) {
        closeAuthModal();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAuthModal();
    }
  });

  setupPasswordToggles();
  updateAuthPanel();

  if (loginForm) {
    loginForm.addEventListener("submit", (event) => {
      if (!validateLoginForm()) {
        event.preventDefault();
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", (event) => {
      if (!validateRegisterForm()) {
        event.preventDefault();
      }
    });
  }
});

window.toggleAuthView = toggleAuthView;
