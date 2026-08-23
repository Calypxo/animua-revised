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
const userMenuBtn = document.getElementById("userMenuBtn");
const userDropdown = document.getElementById("userDropdown");
const profileModal = document.getElementById("profileModal");

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

function clearSession() {
  clearUserSession();
}

function openProfileModal() {
  if (!profileModal) return;

  const session = getUserSession();
  const userName = session?.fullName || "Account";
  const userEmail = session?.email || "";
  const userPhoto = session?.profilePhotoDataUrl || "";
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

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await endUserSession();
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

document.addEventListener("DOMContentLoaded", async () => {
  clearSession();
  try {
    await ensureUserSession();
  } catch (error) {
    console.warn("Unable to restore account session:", error.message);
  }
  bindHeader();
  bindMenus();
  updateAuthUI();
});
