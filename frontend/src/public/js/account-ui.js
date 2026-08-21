const menuToggle = document.getElementById("menuToggle");
const navbar = document.getElementById("navbar");
const header = document.querySelector(".header");
const notificationBtn = document.getElementById("notificationBtn");
const notificationPopup = document.getElementById("notificationPopup");
const loginNavBtn = document.getElementById("loginNavBtn");
const userMenuBtn = document.getElementById("userMenuBtn");
const userDropdown = document.getElementById("userDropdown");
const profileModal = document.getElementById("profileModal");

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

function openProfileModal() {
  if (!profileModal) return;

  const userName = localStorage.getItem("user_name") || "Account";
  const userEmail = localStorage.getItem("user_email") || "";
  const userPhoto = localStorage.getItem("user_profile_photo") || "";
  const fullName = document.getElementById("profileFullName");
  const email = document.getElementById("profileEmail");

  document.getElementById("profileSummaryName")?.replaceChildren(document.createTextNode(firstName(userName)));
  if (fullName) fullName.value = userName;
  if (email) email.value = userEmail;
  renderAvatar(document.getElementById("profileAvatarPreview"), userName, userPhoto);

  profileModal.classList.remove("hidden");
  profileModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeProfileModal() {
  profileModal?.classList.add("hidden");
  profileModal?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
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
    header.classList.add("scrolled");
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
    openProfileModal();
  });

  document.querySelectorAll("[data-profile-close], .profile-modal-backdrop").forEach((button) => {
    button.addEventListener("click", closeProfileModal);
  });

  document.getElementById("myApplicationsBtn")?.addEventListener("click", () => {
    window.location.href = "my-submissions.html";
  });

  document.getElementById("compatibilityResultsBtn")?.addEventListener("click", () => {
    window.location.href = "compatibilityResults.html";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindHeader();
  bindMenus();
  updateAuthUI();
});
