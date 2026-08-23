import {
  clearUserSession,
  endUserSession,
  ensureUserSession,
  getUserSession,
  hasUserSession,
} from "../../utils/storage.js";

const menuToggle = document.getElementById("menuToggle");
const navbar = document.getElementById("navbar");
const header = document.querySelector(".header");
const notificationBtn = document.getElementById("notificationBtn");
const notificationPopup = document.getElementById("notificationPopup");
const loginNavBtn = document.getElementById("loginNavBtn");
const authModal = document.getElementById("authModal");
const closeAuthModalBtn = document.getElementById("closeAuthModal");
const userMenuBtn = document.getElementById("userMenuBtn");
const userDropdown = document.getElementById("userDropdown");

function firstName(name = "User") {
  const first = String(name || "").trim().split(/\s+/)[0] || "User";
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function initial(name = "User") {
  return firstName(name).charAt(0).toUpperCase() || "U";
}

function renderAvatar(element, fullName = "User", photoDataUrl = "") {
  if (!element) return;
  element.innerHTML = photoDataUrl ? `<img src="${photoDataUrl}" alt="">` : initial(fullName);
}

function updateAuthUI() {
  const session = getUserSession();
  const hasToken = hasUserSession();
  const userName = session?.fullName || "User";
  const userPhoto = session?.profilePhotoDataUrl || "";
  const displayName = firstName(userName);
  const userLoggedInBox = document.getElementById("userLoggedInBox");
  const loggedUserName = document.getElementById("loggedUserName");
  const dropdownUserName = document.getElementById("dropdownUserName");
  const dropdownUserInitial = document.getElementById("dropdownUserInitial");
  const userAvatarMini = document.querySelector(".user-avatar-mini");
  const dropdownAvatar = document.querySelector(".user-dropdown-avatar");

  loginNavBtn?.classList.toggle("hidden", hasToken);
  userLoggedInBox?.classList.toggle("hidden", !hasToken);
  if (loggedUserName) loggedUserName.textContent = displayName;
  if (dropdownUserName) dropdownUserName.textContent = displayName;
  if (dropdownUserInitial) dropdownUserInitial.textContent = initial(userName);
  renderAvatar(userAvatarMini, userName, userPhoto);
  renderAvatar(dropdownAvatar, userName, userPhoto);
}

function openAuthModal(event) {
  event?.preventDefault();
  if (!authModal) return;
  if (hasUserSession()) {
    updateAuthUI();
    return;
  }
  authModal.classList.remove("hidden");
  document.body.classList.add("modal-open", "auth-open");
}

function closeAuthModal() {
  authModal?.classList.add("hidden");
  document.body.classList.remove("modal-open", "auth-open");
}

function clearSession() {
  clearUserSession();
}

function bindAuthForms() {
  document.getElementById("login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { handleLogin } = await import("../../auth/login.js");
    await handleLogin(event);
    updateAuthUI();
  });

  document.getElementById("register-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const { handleRegistration } = await import("../../auth/register.js");
    await handleRegistration(event);
    updateAuthUI();
  });
}

function bindPasswordToggles() {
  document.addEventListener("click", (event) => {
    const toggle = event.target.closest(".toggle-password");
    if (!toggle) return;
    const input = document.getElementById(toggle.dataset.target);
    const icon = toggle.querySelector("i");
    if (!input || !icon) return;
    const showPassword = input.type === "password";
    input.type = showPassword ? "text" : "password";
    icon.classList.toggle("fa-eye", showPassword);
    icon.classList.toggle("fa-eye-slash", !showPassword);
  });
}

function bindHeader() {
  menuToggle?.addEventListener("click", () => {
    navbar?.classList.toggle("show");
    document.body.classList.toggle("menu-open");
  });

  navbar?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navbar.classList.remove("show");
      document.body.classList.remove("menu-open");
    });
  });

  if (header) {
    const syncHeader = () => header.classList.toggle("scrolled", window.scrollY > 20);
    syncHeader();
    window.addEventListener("scroll", syncHeader, { passive: true });
  }
}

function bindMenus() {
  notificationBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    notificationPopup?.classList.toggle("show");
  });

  userMenuBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    userDropdown?.classList.toggle("hidden");
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".notification-wrap")) notificationPopup?.classList.remove("show");
    if (!event.target.closest(".user-menu")) userDropdown?.classList.add("hidden");
  });

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await endUserSession();
    updateAuthUI();
    window.location.href = "home.html";
  });

  document.getElementById("viewProfileBtn")?.addEventListener("click", () => {
    userDropdown?.classList.add("hidden");
    import("./lightweight-profile.js").then(({ openProfileModal }) => openProfileModal());
  });

  document.getElementById("myApplicationsBtn")?.addEventListener("click", () => {
    window.location.href = "my-submissions.html";
  });

  document.getElementById("compatibilityResultsBtn")?.addEventListener("click", () => {
    window.location.href = "compatibilityResults.html";
  });
}

function resetAuthPanelScroll(panel) {
  const registerPanel = document.getElementById("register-section");
  if (panel) panel.scrollTop = 0;
  if (registerPanel) registerPanel.scrollTop = 0;
  window.requestAnimationFrame(() => {
    if (panel) panel.scrollTop = 0;
    if (registerPanel) registerPanel.scrollTop = 0;
  });
  window.setTimeout(() => {
    if (panel) panel.scrollTop = 0;
    if (registerPanel) registerPanel.scrollTop = 0;
  }, 160);
}

function syncAuthSidePanel(showRegister) {
  const sideTitle = document.getElementById("authModalTitle");
  const sideText = document.getElementById("authSideText");
  const sideAction = document.getElementById("authSideAction");

  if (sideTitle) sideTitle.textContent = showRegister ? "Join Animua." : "Welcome back.";
  if (sideText) {
    sideText.textContent = showRegister
      ? "Create your account and start connecting rescued animals with safer homes."
      : "Continue managing matches, applications, and rescued animals through Animua.";
  }
  if (sideAction) sideAction.textContent = showRegister ? "Log In" : "Create account";
}

window.toggleAuthView = function toggleAuthView() {
  const loginSection = document.getElementById("login-section");
  const registerSection = document.getElementById("register-section");
  if (!loginSection || !registerSection) return;
  const showRegister = !loginSection.classList.contains("hidden");
  const authPanel = authModal?.querySelector(".auth-modal-right");
  resetAuthPanelScroll(authPanel);
  loginSection.classList.toggle("hidden", showRegister);
  registerSection.classList.toggle("hidden", !showRegister);
  authModal?.classList.toggle("register-mode", showRegister);
  syncAuthSidePanel(showRegister);
  resetAuthPanelScroll(authPanel);
  if (showRegister) import("../../auth/register.js");
};

document.addEventListener("DOMContentLoaded", async () => {
  clearSession();
  try {
    await ensureUserSession();
  } catch (error) {
    console.warn("Unable to restore account session:", error.message);
  }
  document.querySelectorAll(".reveal").forEach((element) => element.classList.add("show"));
  bindHeader();
  bindMenus();
  bindAuthForms();
  bindPasswordToggles();
  updateAuthUI();
  loginNavBtn?.addEventListener("click", openAuthModal);
  closeAuthModalBtn?.addEventListener("click", closeAuthModal);
  authModal?.addEventListener("click", (event) => {
    if (event.target === authModal) closeAuthModal();
  });
});
