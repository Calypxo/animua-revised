function updateAuthPanel() {
  const loginSection = document.getElementById("login-section");
  const isLoginVisible = loginSection && !loginSection.classList.contains("hidden");

  const authSideTag = document.getElementById("authSideTag");
  const authTitle = document.getElementById("authModalTitle");
  const authText = document.getElementById("authSideText");

  if (!authSideTag || !authTitle || !authText) return;

  if (isLoginVisible) {
    authSideTag.textContent = "Welcome Back";
    authTitle.innerHTML = "Hello,<br>Welcome back to Animua!";
    authText.textContent = "Log in to continue exploring rescued animals and shelter services.";
  } else {
    authSideTag.textContent = "New Here?";
    authTitle.innerHTML = "Create your<br>Animua account";
    authText.textContent = "Sign up to start your journey with Animua and access shelter features easily.";
  }
}

function toggleAuthView() {
  const loginSection = document.getElementById("login-section");
  const registerSection = document.getElementById("register-section");

  if (!loginSection || !registerSection) return;

  loginSection.classList.toggle("hidden");
  registerSection.classList.toggle("hidden");
  clearAuthErrors();
  updateAuthPanel();
}

function openAuthModal() {
  const authModal = document.getElementById("authModal");
  if (!authModal) return;

  authModal.classList.remove("hidden");
  document.body.classList.add("auth-open");
  updateAuthPanel();
}

function closeAuthModal() {
  const authModal = document.getElementById("authModal");
  if (!authModal) return;

  authModal.classList.add("hidden");
  document.body.classList.remove("auth-open");
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

  const fullName = document.getElementById("reg-name")?.value.trim() || "";
  const email = document.getElementById("reg-email")?.value.trim() || "";
  const password = document.getElementById("reg-password")?.value || "";
  let isValid = true;

  if (!fullName) {
    setError("reg-name-error", "Full name is required.");
    isValid = false;
  } else if (fullName.length < 2) {
    setError("reg-name-error", "Please enter your full name.");
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