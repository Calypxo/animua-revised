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
  return name.trim().split(/\s+/)[0] || "User";
}

function initial(name = "User") {
  return firstName(name).charAt(0).toUpperCase() || "U";
}

function renderAvatar(element, fullName = "User", photoDataUrl = "") {
  if (!element) return;
  element.innerHTML = photoDataUrl ? `<img src="${photoDataUrl}" alt="">` : initial(fullName);
}

function updateAuthUI() {
  const hasToken = Boolean(localStorage.getItem("animua_token"));
  const userName = localStorage.getItem("user_name") || "User";
  const userPhoto = localStorage.getItem("user_profile_photo") || "";
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
  if (localStorage.getItem("animua_token")) {
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
  [
    "animua_token",
    "user_role",
    "user_name",
    "user_email",
    "user_profile_photo",
    "is_logged_in",
    "show_welcome_toast",
  ].forEach((key) => localStorage.removeItem(key));
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

  document.getElementById("logoutBtn")?.addEventListener("click", () => {
    clearSession();
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

window.toggleAuthView = function toggleAuthView() {
  const loginSection = document.getElementById("login-section");
  const registerSection = document.getElementById("register-section");
  if (!loginSection || !registerSection) return;
  const showRegister = !loginSection.classList.contains("hidden");
  loginSection.classList.toggle("hidden", showRegister);
  registerSection.classList.toggle("hidden", !showRegister);
  authModal?.classList.toggle("register-mode", showRegister);
  if (showRegister) import("../../auth/register.js");
};

document.addEventListener("DOMContentLoaded", () => {
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
