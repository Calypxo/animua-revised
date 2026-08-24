import Swal from "sweetalert2";
import { handleLogin } from "../../auth/login.js";
import { handleRegistration } from "../../auth/register.js";
import { API_BASE_URL } from "../../utils/api.js";
import { auth } from "../../utils/firebase.js";
import { signOut } from "firebase/auth";
import {
  clearUserSession,
  endUserSession,
  ensureUserSession,
  getUserSession,
  hasUserSession,
  isAuthenticationFailure,
  setUserSession,
} from "../../utils/storage.js";

const CHATBOT_MIN_TYPING_MS = 1000;
const PASSWORD_OTP_RESEND_SECONDS = 60;
const NEWS_CCA_CAT_RESCUE_IMAGE = new URL(
  "../../assets/images/news-cca-cat-rescue.png",
  import.meta.url
).href;
const NEWS_BALIBAGO_DOG_RESCUE_IMAGE = new URL(
  "../../assets/images/news-balibago-dog-rescue.jpg",
  import.meta.url
).href;
const NEWS_NEPO_STRAY_CATS_RESCUE_IMAGE = new URL(
  "../../assets/images/news-angeles-stray-cats-rescue.png",
  import.meta.url
).href;
const NEWS_NEPO_STRAY_CATS_STORY_IMAGE = new URL(
  "../../assets/images/news-nepo-stray-cats-rescue.jpg",
  import.meta.url
).href;
const HIGHLIGHT_NEWS_ALERT_IMAGE = new URL(
  "../../assets/images/optimized/home/highlight-news-alert-palit-an-720.webp",
  import.meta.url
).href;
const HIGHLIGHT_SUCCESS_STORY_IMAGE = new URL(
  "../../assets/images/optimized/home/success-stories-688.webp",
  import.meta.url
).href;
const HIGHLIGHT_UPCOMING_EVENT_IMAGE = new URL(
  "../../assets/images/optimized/home/highlight-upcoming-event-720.webp",
  import.meta.url
).href;
const SUCCESS_ZACH_ADOPTION_IMAGE = new URL(
  "../../assets/images/success-zach-adoption.jpg",
  import.meta.url
).href;
const SUCCESS_LOLONG_ADOPTION_IMAGE = new URL(
  "../../assets/images/success-lolong-adoption.jpg",
  import.meta.url
).href;
const SUCCESS_WHITY_ADOPTION_IMAGE = new URL(
  "../../assets/images/success-whity-adoption.jpg",
  import.meta.url
).href;
const SUCCESS_MARCIA_ADOPTION_IMAGE = new URL(
  "../../assets/images/success-marcia-adoption.jpg",
  import.meta.url
).href;
const announcementStoryHref = (storyId, type = "") => {
  const params = new URLSearchParams({ story: storyId });
  if (type) params.set("type", type);
  return `announcements.html?${params.toString()}`;
};

const menuToggle = document.getElementById("menuToggle");
const navbar = document.getElementById("navbar");
const body = document.body;
const header = document.querySelector(".header");

const notificationBtn = document.getElementById("notificationBtn");
const notificationPopup = document.getElementById("notificationPopup");
const notificationDot = document.querySelector(".notification-dot");

const authModal = document.getElementById("authModal");
const openAuthModalBtn =
  document.getElementById("loginNavBtn") ||
  document.getElementById("openAuthModal");
const closeAuthModalBtn = document.getElementById("closeAuthModal");
const quizIntroModal = document.getElementById("quiz-match-info");
const quizIntroTriggers = document.querySelectorAll("[data-quiz-intro-trigger]");
const quizIntroCloseButtons = document.querySelectorAll("[data-quiz-intro-close]");
const quizPageModal = document.getElementById("quizPageModal");
const quizPageFrame = document.getElementById("quizPageFrame");
const quizPageTriggers = document.querySelectorAll("[data-quiz-page-trigger]");
const quizPageCloseButtons = document.querySelectorAll("[data-quiz-page-close]");
let lastQuizIntroTrigger = null;
let profileModal = document.querySelector("#profileModal.profile-modal-overlay");
let profileModalCard = profileModal?.querySelector(".profile-modal-card");
let profileCloseButtons = document.querySelectorAll("[data-profile-close]");
let profileForm = document.getElementById("profileForm");
let profileEditBtn = document.getElementById("profileEditBtn");
let profileSaveBtn = document.getElementById("profileSaveBtn");
let profileChangePhotoBtn = document.getElementById("profileChangePhotoBtn");
let profileAvatarPhotoBtn = document.getElementById("profileAvatarPhotoBtn");
let profilePhotoInput = document.getElementById("profilePhotoInput");
let profilePasswordBtn = document.getElementById("profilePasswordBtn");
let profileNotificationsBtn = document.getElementById("profileNotificationsBtn");
const PROFILE_PHOTO_MAX_SIDE = 420;
const PROFILE_PHOTO_MAX_BYTES = 320000;
const DEFAULT_NOTIFICATION_SETTINGS = {
  applicationUpdates: true,
  surrenderRequestUpdates: true,
};
let currentProfileAccount = null;
let pendingProfilePhotoDataUrl = "";
let lastProfileTrigger = null;
let hasPendingProfileChanges = false;
let pendingPasswordChange = null;
let pendingForgotPassword = null;
let passwordOtpResendTimer = null;
let passwordOtpResendRemaining = 0;
let isSessionReauthenticationPending = false;

const loginSection = document.getElementById("login-section");
const registerSection = document.getElementById("register-section");

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

const authSideTag = document.getElementById("authSideTag");
const authModalTitle = document.getElementById("authModalTitle");
const authSideText = document.getElementById("authSideText");
const authSideAction = document.getElementById("authSideAction");

const revealElements = document.querySelectorAll(".reveal");
const heroLearnMore = document.querySelector(".hero-learn-more");

function clearFormErrors() {
  const errorIds = [
    "login-email-error",
    "login-password-error",
    "login-captcha-error",
    "reg-first-name-error",
    "reg-last-name-error",
    "reg-email-error",
    "reg-password-error",
    "reg-confirm-password-error",
    "reg-captcha-error",
    "email-verification-message"
  ];

  errorIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = "";
  });
}

function openAuthModal(event) {
  if (!authModal) return;
  if (event) event.preventDefault();

  // The redirect hand-off has been consumed once a page can open its modal.
  // Clearing it here prevents a later Home navigation from reopening login.
  sessionStorage.removeItem("animua_open_auth_modal");

  if (hasUserSession()) {
    closeAuthModal();
    updateAuthUI();
    return;
  }

  authModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  document.body.classList.add("auth-open");
}

function closeAuthModal() {
  if (authModal) authModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  document.body.classList.remove("auth-open");
}

function openQuizIntroModal(event) {
  if (event) {
    event.preventDefault();
    lastQuizIntroTrigger = event.currentTarget || event.target?.closest("[data-quiz-intro-trigger]") || null;
  } else {
    lastQuizIntroTrigger = document.querySelector("[data-quiz-intro-trigger]") || null;
  }
  if (!quizIntroModal) return;

  quizIntroModal.classList.remove("hidden");
  quizIntroModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  document.body.classList.add("quiz-intro-open");
  quizIntroModal.querySelector(".quiz-intro-close")?.focus();
}

function clearQuizIntroUrlState() {
  const url = new URL(window.location.href);
  url.searchParams.delete("quizIntro");

  if (url.hash === "#quiz-match-info") {
    url.hash = "";
  }

  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}

function closeQuizIntroModal(event) {
  if (event) event.preventDefault();
  if (!quizIntroModal) return;

  quizIntroModal.classList.add("hidden");
  quizIntroModal.setAttribute("aria-hidden", "true");
  if (!quizPageModal || quizPageModal.classList.contains("hidden")) {
    document.body.classList.remove("modal-open");
  }
  document.body.classList.remove("quiz-intro-open");

  clearQuizIntroUrlState();
  if (lastQuizIntroTrigger && typeof lastQuizIntroTrigger.focus === "function") {
    lastQuizIntroTrigger.focus();
  }
}

function openQuizPageModal(event) {
  if (event) event.preventDefault();
  if (!quizPageModal || !quizPageFrame) return;

  closeQuizIntroModal();
  quizPageFrame.src = "/pages/public/petCompatibility.html";
  quizPageModal.classList.remove("hidden");
  quizPageModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeQuizPageModal(event) {
  if (event) event.preventDefault();
  if (!quizPageModal) return;

  quizPageModal.classList.add("hidden");
  quizPageModal.setAttribute("aria-hidden", "true");
  if (quizPageFrame) quizPageFrame.src = "";
  document.body.classList.remove("modal-open");
}

function getAccountProfileModalMarkup() {
  return `
    <section class="profile-modal-overlay hidden" id="profileModal" aria-hidden="true" aria-labelledby="profileModalTitle">
      <button type="button" class="profile-modal-backdrop" data-profile-close aria-label="Close profile"></button>
      <article class="profile-modal-card profile-modal-card--compact" role="dialog" aria-modal="true" tabindex="-1" style="width: min(640px, calc(100vw - 64px)); max-width: 640px;">
        <button type="button" class="profile-modal-close" data-profile-close aria-label="Close profile">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>

        <div class="profile-modal-shell">
          <div class="profile-modal-title">
            <span class="profile-title-icon" aria-hidden="true">
              <i class="fa-regular fa-user"></i>
            </span>
            <h2 id="profileModalTitle">My Profile</h2>
          </div>

          <section class="profile-summary-card">
            <div class="profile-summary-main">
              <div class="profile-avatar-wrap">
                <div class="profile-summary-avatar" id="profileAvatarPreview">A</div>
                <button type="button" class="profile-avatar-camera" id="profileAvatarPhotoBtn" aria-label="Change profile photo">
                  <i class="fa-solid fa-camera" aria-hidden="true"></i>
                </button>
              </div>
              <div>
                <h3 id="profileSummaryName">Account</h3>
                <small>Member since <span id="profileMemberSince">2026</span> <b aria-hidden="true"></b></small>
              </div>
            </div>

            <div class="profile-summary-actions">
              <input type="file" id="profilePhotoInput" accept="image/png,image/jpeg,image/webp" hidden>
              <button type="button" class="profile-outline-btn" id="profileChangePhotoBtn">
                <i class="fa-solid fa-camera" aria-hidden="true"></i>
                <span>Change Photo</span>
              </button>
            </div>
          </section>

          <form class="profile-form" id="profileForm">
            <section class="profile-info-card">
              <div class="profile-section-head">
                <h3><i class="fa-solid fa-circle-user" aria-hidden="true"></i> Personal Information</h3>
                <button type="button" class="profile-outline-btn profile-edit-inline" id="profileEditBtn">
                  <i class="fa-solid fa-pen" aria-hidden="true"></i>
                  <span>Edit Profile</span>
                </button>
              </div>

              <label class="profile-info-row">
                <i class="fa-regular fa-user" aria-hidden="true"></i>
                <span><strong>Full Name</strong><input type="text" id="profileFullName" autocomplete="name" readonly></span>
              </label>

              <label class="profile-info-row">
                <i class="fa-regular fa-envelope" aria-hidden="true"></i>
                <span><strong>Email Address</strong><input type="email" id="profileEmail" autocomplete="email" readonly></span>
              </label>

              <label class="profile-info-row">
                <i class="fa-solid fa-phone" aria-hidden="true"></i>
                <span><strong>Mobile Number</strong><input type="tel" id="profilePhone" autocomplete="tel" readonly placeholder="Not added yet"></span>
              </label>
            </section>

            <section class="profile-info-card profile-settings-card">
              <h3><i class="fa-solid fa-gear" aria-hidden="true"></i> Account Settings</h3>

              <button type="button" class="profile-settings-row" id="profilePasswordBtn">
                <i class="fa-solid fa-lock" aria-hidden="true"></i>
                <span><strong>Password</strong><small>Update your account password</small></span>
                <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
              </button>

              <button type="button" class="profile-settings-row" id="profileNotificationsBtn">
                <i class="fa-regular fa-bell" aria-hidden="true"></i>
                <span><strong>Notifications</strong><small id="profileNotificationSummary">Manage email and push notifications</small></span>
                <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
              </button>
            </section>

            <p class="profile-status-message" id="profileStatusMessage" aria-live="polite"></p>

            <div class="profile-modal-actions">
              <button type="submit" class="profile-save-btn" id="profileSaveBtn">
                <i class="fa-regular fa-floppy-disk" aria-hidden="true"></i>
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </div>
      </article>
    </section>
  `;
}

function refreshProfileModalElements() {
  profileModal = document.querySelector("#profileModal.profile-modal-overlay");
  profileModalCard = profileModal?.querySelector(".profile-modal-card");
  profileModalCard?.classList.add("profile-modal-card--compact");
  profileCloseButtons = document.querySelectorAll("[data-profile-close]");
  profileForm = document.getElementById("profileForm");
  profileEditBtn = document.getElementById("profileEditBtn");
  profileSaveBtn = document.getElementById("profileSaveBtn");
  profileChangePhotoBtn = document.getElementById("profileChangePhotoBtn");
  profileAvatarPhotoBtn = document.getElementById("profileAvatarPhotoBtn");
  profilePhotoInput = document.getElementById("profilePhotoInput");
  profilePasswordBtn = document.getElementById("profilePasswordBtn");
  profileNotificationsBtn = document.getElementById("profileNotificationsBtn");
}

function ensureAccountProfileModal() {
  if (!document.querySelector("#profileModal.profile-modal-overlay")) {
    document.body.insertAdjacentHTML("beforeend", getAccountProfileModalMarkup());
  }
  refreshProfileModalElements();
  return profileModal;
}

function lockCompactProfileModalSize() {
  if (!profileModalCard) return;
  profileModalCard.classList.add("profile-modal-card--compact");
  profileModalCard.style.setProperty("width", "min(640px, calc(100vw - 64px))", "important");
  profileModalCard.style.setProperty("max-width", "640px", "important");
}

function showLoginView() {
  clearFormErrors();

  if (loginSection) loginSection.classList.remove("hidden");
  if (registerSection) registerSection.classList.add("hidden");
  if (authModal) authModal.classList.remove("register-mode");
  resetAuthPanelScroll();

  if (authSideTag) authSideTag.textContent = "Welcome Back";
  if (authModalTitle) authModalTitle.textContent = "Welcome back.";
  if (authSideText) {
    authSideText.textContent =
      "Continue managing matches, applications, and rescued animals through Animua.";
  }
  if (authSideAction) authSideAction.textContent = "Create account";
}

function showRegisterView() {
  clearFormErrors();

  if (registerSection) registerSection.classList.remove("hidden");
  if (loginSection) loginSection.classList.add("hidden");
  if (authModal) authModal.classList.add("register-mode");
  resetAuthPanelScroll();

  if (authSideTag) authSideTag.textContent = "New Here?";
  if (authModalTitle) authModalTitle.textContent = "Join Animua.";
  if (authSideText) {
    authSideText.textContent =
      "Create your account and start connecting rescued animals with safer homes.";
  }
  if (authSideAction) authSideAction.textContent = "Sign in";
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

function setupDateInputs() {
  document.querySelectorAll("[data-date-input]").forEach((input) => {
    input.addEventListener("focus", () => {
      input.type = "date";
    });

    input.addEventListener("blur", () => {
      if (!input.value) {
        input.type = "text";
      }
    });
  });
}

function getFirstName(name = "User") {
  const first = String(name || "").trim().split(/\s+/)[0] || "User";
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function getInitial(name = "User") {
  return getFirstName(name).charAt(0).toUpperCase() || "U";
}

function renderUserAvatar(element, fullName = "User", photoDataUrl = "") {
  if (!element) return;

  element.innerHTML = photoDataUrl
    ? `<img src="${photoDataUrl}" alt="">`
    : getInitial(fullName);
}

function clearPublicSession() {
  clearUserSession();
  currentProfileAccount = null;
  pendingProfilePhotoDataUrl = "";
  hasPendingProfileChanges = false;
}

function isSessionExpiredError(errorOrMessage = "") {
  return isAuthenticationFailure(errorOrMessage);
}

function promptLoginAfterSessionExpired() {
  if (isSessionReauthenticationPending) return;
  isSessionReauthenticationPending = true;
  clearPublicSession();
  updateAuthUI();
  closeProfileModal();
  notificationPopup?.classList.remove("show");
  updateNotificationBadge(0);
  Swal.fire({
    icon: "info",
    title: "Please Log In Again",
    text: "Your session expired. Sign in again to view your notifications.",
    customClass: {
      container: "animua-session-expired-container",
      popup: "animua-popup",
      confirmButton: "animua-confirm"
    },
    buttonsStyling: false
  }).then(() => {
    sessionStorage.setItem("animua_open_auth_modal", "true");
    showLoginView();
    openAuthModal();
  });
}

function updateAuthUI() {
  const dropdownUserName = document.getElementById("dropdownUserName");
  const loginNavBtn = document.getElementById("loginNavBtn");
  const userLoggedInBox = document.getElementById("userLoggedInBox");
  const loggedUserName = document.getElementById("loggedUserName");
  const userAvatarMini = document.querySelector(".user-avatar-mini");
  const dropdownUserInitial = document.getElementById("dropdownUserInitial");
  const logoutBtn = document.getElementById("logoutBtn");

  const session = getUserSession();
  const isLoggedIn = Boolean(session);
  const userName = session?.fullName || "User";
  const userPhoto = session?.profilePhotoDataUrl || "";
  const displayName = getFirstName(userName);
  const dropdownAvatar = document.querySelector(".user-dropdown-avatar");

  if (isLoggedIn) {
    if (loginNavBtn) loginNavBtn.classList.add("hidden");
    if (userLoggedInBox) userLoggedInBox.classList.remove("hidden");
    if (loggedUserName) loggedUserName.textContent = displayName;
    if (dropdownUserName) dropdownUserName.textContent = displayName;
    renderUserAvatar(userAvatarMini, userName, userPhoto);
    renderUserAvatar(dropdownAvatar, userName, userPhoto);
  } else {
    if (loginNavBtn) loginNavBtn.classList.remove("hidden");
    if (userLoggedInBox) userLoggedInBox.classList.add("hidden");
    if (userAvatarMini) {
      userAvatarMini.innerHTML = '<i class="fa-solid fa-user"></i>';
    }
    renderUserAvatar(dropdownAvatar, "Account", "");
  }

  if (logoutBtn && !logoutBtn.dataset.bound) {
    logoutBtn.dataset.bound = "true";
    logoutBtn.addEventListener("click", async () => {
      const result = await Swal.fire({
        title: "Log Out?",
        html: `
          <p class="animua-logout-copy">You will need to sign in again to access your account.</p>
        `,
        iconHtml: '<span class="animua-logout-mark"><i class="fa-solid fa-right-from-bracket"></i></span>',
        showCancelButton: true,
        showCloseButton: false,
        confirmButtonText: '<span>Log Out</span>',
        cancelButtonText: "Cancel",
        customClass: {
          popup: "animua-popup animua-logout-popup",
          icon: "animua-logout-icon",
          closeButton: "animua-logout-close",
          confirmButton: "animua-confirm",
          cancelButton: "animua-cancel"
        },
        buttonsStyling: false
      });

      if (!result.isConfirmed) return;

      await Promise.allSettled([
        endUserSession(),
        signOut(auth),
      ]);
      clearPublicSession();

      window.location.href = "/pages/public/home.html";
    });
  }
}

function showWelcomeToastIfNeeded() {
  const shouldShow = sessionStorage.getItem("show_welcome_toast") === "true";
  const userName = getUserSession()?.fullName || "User";
  const safeUserName = escapeToastHtml(userName);

  if (shouldShow) {
    showAnimuaWelcomeToast(safeUserName, userName);
    sessionStorage.removeItem("show_welcome_toast");
  }
}

function resetAuthPanelScroll() {
  const authPanel = authModal?.querySelector(".auth-modal-right");
  const registerPanel = document.getElementById("register-section");

  if (authPanel) authPanel.scrollTop = 0;
  if (registerPanel) registerPanel.scrollTop = 0;
  window.requestAnimationFrame(() => {
    if (authPanel) authPanel.scrollTop = 0;
    if (registerPanel) registerPanel.scrollTop = 0;
  });
  window.setTimeout(() => {
    if (authPanel) authPanel.scrollTop = 0;
    if (registerPanel) registerPanel.scrollTop = 0;
  }, 160);
}

function showAnimuaWelcomeToast(safeUserName, rawUserName) {
  document.querySelector(".animua-native-toast")?.remove();

  const toast = document.createElement("div");
  toast.className = "animua-native-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.setAttribute("aria-label", `Welcome, ${rawUserName}. You are signed in to ANIMUA.`);
  toast.innerHTML = `
    <span class="animua-native-toast-check" aria-hidden="true">
      <i class="fa-solid fa-check"></i>
    </span>
    <span class="animua-native-toast-copy">
      <strong>Welcome, ${safeUserName}!</strong>
      <span>You are signed in to ANIMUA.</span>
    </span>
    <span class="animua-native-toast-paw" aria-hidden="true">
      <i class="fa-solid fa-paw"></i>
    </span>
    <button type="button" class="animua-native-toast-close" aria-label="Dismiss welcome message">
      <i class="fa-solid fa-xmark" aria-hidden="true"></i>
    </button>
    <span class="animua-native-toast-progress" aria-hidden="true"></span>
  `;

  const dismissToast = () => {
    toast.classList.add("is-leaving");
    window.setTimeout(() => toast.remove(), 180);
  };

  toast.querySelector(".animua-native-toast-close")?.addEventListener("click", dismissToast);
  document.body.appendChild(toast);
  window.setTimeout(dismissToast, 3200);
}

function escapeToastHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function setupHomeStories() {
  const storyButtons = document.querySelectorAll(".home-highlight-story");
  const storyModal = document.getElementById("storyModal");
  const storyModalCard = storyModal?.querySelector(".story-modal-card");
  const storyModalProgress = storyModal?.querySelector(".story-modal-progress");
  const storyModalClose = document.getElementById("storyModalClose");
  const storyModalPrev = document.getElementById("storyModalPrev");
  const storyModalNext = document.getElementById("storyModalNext");
  const storyModalAvatar = document.getElementById("storyModalAvatar");
  const storyModalImage = document.getElementById("storyModalImage");
  const storyModalTag = document.getElementById("storyModalTag");
  const storyModalBrandTag = document.getElementById("storyModalBrandTag");
  const storyModalDate = document.getElementById("storyModalDate");
  const storyModalTitle = document.getElementById("storyModalTitle");
  const storyModalText = document.getElementById("storyModalText");
  const storyModalContent = document.getElementById("storyModalContent");
  const storyModalActions = document.getElementById("storyModalActions");
  const upcomingEventSection = document.getElementById("upcomingEventSection");
  const upcomingEventMedia = document.getElementById("upcomingEventMedia");
  const upcomingEventImage = document.getElementById("upcomingEventImage");
  const upcomingEventTitle = document.getElementById("upcomingEventTitle");
  const upcomingEventLabel = document.getElementById("upcomingEventLabel");
  const upcomingEventDate = document.getElementById("upcomingEventDate");
  const upcomingEventTime = document.getElementById("upcomingEventTime");
  const upcomingEventLocation = document.getElementById("upcomingEventLocation");
  const upcomingEventDescription = document.getElementById("upcomingEventDescription");
  const upcomingEventAction = document.getElementById("upcomingEventAction");

  if (!storyButtons.length || !storyModal || !storyModalCard) return;

  let lastFocusedHighlight = null;
  let animalsLoaded = false;
  let newestPets = [];
  let eventsLoadPromise = null;
  let upcomingEvents = [];
  let adoptedStoriesLoaded = false;
  let adoptedStories = [];
  let activeHighlightKey = null;
  let activeStoryIndex = 0;
  let activeStoryDeck = [];
  let storyAdvanceTimer = null;
  const STORY_AUTO_ADVANCE_MS = 7000;
  const STORY_FRESH_DAYS = 14;
  const STORY_FRESH_MS = STORY_FRESH_DAYS * 24 * 60 * 60 * 1000;
  let announcementStoriesPromise = null;
  let announcementStories = {
    news: [],
    success: [],
    events: []
  };
  const newsAlerts = [
    {
      id: "highlight-news-nepo-stray-cats",
      tag: "News & Alerts",
      title: "Pag-rescue sa stray cats, nagpapatuloy sa Angeles City",
      titleHtml: 'Pag-rescue sa<br><span>stray cats</span>',
      date: "July 21, 2026",
      sortDate: "2026-07-21",
      image: HIGHLIGHT_NEWS_ALERT_IMAGE,
      imageAlt: "Rescued cats inside a pet carrier",
      source: "CLTV36 News",
      photoCredit: "Photo from Angeles CIO",
      href: "https://www.facebook.com/cltv36news",
      hashtag: "#CentralLuzonNews #CLTV36 #Pampanga #AngelesCity #straycats",
      paragraphs: [
        "Ipinagpatuloy ng Angeles City Veterinary Office ang stray cat rescue operation sa Nepo Mart nitong Martes, July 21, bilang bahagi ng kanilang programa na tiyakin ang kapakanan ng mga hayop.",
        "Layon ng opisina na panatilihin ang kaligtasan at kalinisan ng mga pampublikong lugar, habang sinisigurado ang maayos at makataong pagtrato sa mga ligaw na hayop.",
        "Ligtas namang dinala ang mga nahuling stray cat sa Angeles City Pound, kung saan oobserbahan sila at bibigyan ng kinakailangang veterinary procedures na nakaayon sa animal welfare protocols.",
        "Patuloy namang hinihikayat ng City Veterinary Office ang mga Angeleno na maging responsableng pet owners at makibahagi sa mga inisyatibang nagsusulong ng animal welfare sa lungsod. | via Noel Celeste, CLTV36 News"
      ],
      storyParagraphs: [
        "Ipinagpatuloy ng Angeles City Veterinary Office ang stray cat rescue operation sa Nepo Mart.",
        "Ligtas na dinala ang mga nahuling stray cat sa Angeles City Pound para sa observation at veterinary procedures.",
        "Hinihikayat ang mga Angeleno na maging responsableng pet owners at makibahagi sa animal welfare initiatives."
      ]
    },
    {
      id: "highlight-news-cca-cat-rescue",
      tag: "News & Alerts",
      title: "Stray cat rescue at CCA",
      titleHtml: 'Stray cat rescue<br><span>at CCA</span>',
      date: "July 20, 2026",
      sortDate: "2026-07-20",
      image: NEWS_CCA_CAT_RESCUE_IMAGE,
      imageAlt: "Stray cat rescue operation at City College of Angeles",
      source: "CLTV36 News",
      photoCredit: "Photo: Angeles City Information Office",
      href: "https://www.facebook.com/share/p/1Dm62o3wpH/",
      hashtag: "#CentralLuzonNews #CLTV36 #Pampanga #straycat #rescue",
      paragraphs: [
        "Nagsagawa ng stray cat rescue operation ang Angeles City Veterinary Office ngayong Lunes, July 20, sa City College of Angeles (CCA).",
        "Ayon sa City Veterinary Office, bahagi ito ng kanilang programa para sa animal welfare at responsableng pangangalaga sa mga ligaw na hayop.",
        "Ligtas na nahuli at dinala sa Angeles City Pound ang mga stray cat upang mabigyan ng kinakailangang pagkalinga at serbisyong beterinaryo.",
        "Layunin din ng programa na mapanatili ang kaligtasan at kalinisan sa komunidad habang tinutugunan ang isyu ng mga ligaw na hayop sa mga pampublikong lugar.",
        "Kaugnay nito, hinimok ng City Veterinary Office ang mga Angeleno na isulong ang responsible pet ownership at i-report ang mga hayop na nangangailangan ng tulong upang agad na mabigyan ng kaukulang aksyon. | via Joanna Borbon, CLTV36 News"
      ],
      storyParagraphs: [
        "Nagsagawa ng stray cat rescue operation ang Angeles City Veterinary Office sa City College of Angeles (CCA).",
        "Ligtas na nahuli at dinala sa Angeles City Pound ang mga stray cat upang mabigyan ng pagkalinga at serbisyong beterinaryo.",
        "Hinimok din ang mga Angeleno na isulong ang responsible pet ownership at i-report ang hayop na nangangailangan ng tulong."
      ]
    },
    {
      id: "highlight-news-balibago-dog-rescue",
      tag: "News & Alerts",
      title: "Aso na-rescue sa Balibago",
      titleHtml: 'Aso na-rescue<br><span>sa Balibago</span>',
      date: "May 14, 2025",
      sortDate: "2025-05-14",
      image: NEWS_BALIBAGO_DOG_RESCUE_IMAGE,
      imageAlt: "Rescued dog at the Balibago collapsed construction site",
      source: "Angeles City Information Office",
      photoCredit: "Photos: Bureau of Fire Protection Central Luzon",
      href: "https://www.facebook.com/angelescityinfo/posts/pfbid0d7amcF8R4hxvhZB4HeaPTxj4yHwJr4AJCWTwEMQMK55xW1BCmtp8wtVWqGbVhNTgl",
      hashtag: "#AngelesCity",
      paragraphs: [
        "Sa gitna ng search and rescue operations sa gumuhong ginagawang gusali sa Balibago, isang aso ang na-rescue at kasalukuyang nasa pangangalaga ng mga responders.",
        "Ayon sa ulat sa construction site, ang aso ay biglang nakita na papalabas mula sa rubble habang naagsasagawa ng operasyon. Agad itong inasikaso at inilipat sa ligtas na pangangalaga ng mga rescuers.",
        "Isasailalim ang aso sa masusing check-up sa pangangalaga ng City Veterinary Office ng Angeles City."
      ],
      storyParagraphs: [
        "Ayon sa ulat sa construction site, ang aso ay biglang nakita na papalabas mula sa rubble habang naagsasagawa ng operasyon.",
        "Agad itong inasikaso at inilipat sa ligtas na pangangalaga ng mga rescuers.",
        "Isasailalim ang aso sa masusing check-up ng City Veterinary Office ng Angeles City."
      ]
    }
  ].sort((a, b) => Date.parse(b.sortDate || b.date) - Date.parse(a.sortDate || a.date));
  const latestNewsAlert = newsAlerts[0];
  const successStories = [
    {
      id: "highlight-success-zach",
      tag: "Success Stories",
      title: "Zach starts a new life",
      titleHtml: 'Zach starts<br><span>a new life</span>',
      date: "Adoption Story",
      image: SUCCESS_ZACH_ADOPTION_IMAGE,
      imageAlt: "Zach with his adopter",
      intro: "Rescued dog Zach is now starting a new life with his loving fur-parent.",
      adopter: "Hamara Dela Cruz of Brgy. Ninoy Aquino",
      petName: "Zach",
      storyParagraphs: [
        "Rescued dog Zach is now starting a new life with his loving fur-parent.",
        "Zach was adopted by Hamara Dela Cruz of Brgy. Ninoy Aquino.",
        "His adoption supports the Angeles City Government's Adopt, Don't Shop initiative."
      ]
    },
    {
      id: "highlight-success-lolong",
      tag: "Success Stories",
      title: "Lolong welcomed home",
      titleHtml: 'Lolong welcomed<br><span>home</span>',
      date: "Adoption Story",
      image: SUCCESS_LOLONG_ADOPTION_IMAGE,
      imageAlt: "Lolong in a carrier with adopter Analyn Rivera",
      intro: "Rescued cat Lolong is now starting a new life with a loving fur-parent.",
      adopter: "Analyn Rivera of Brgy. Anunas",
      petName: "Lolong",
      storyParagraphs: [
        "Rescued cat Lolong is now starting a new life with a loving fur-parent.",
        "Lolong was welcomed by Analyn Rivera of Brgy. Anunas.",
        "The Angeles City Dog Pound and Animal Shelter continues to help rescued pets find forever homes."
      ]
    },
    {
      id: "highlight-success-whity",
      tag: "Success Stories",
      title: "Whity finds a family",
      titleHtml: 'Whity finds<br><span>a family</span>',
      date: "Adoption Story",
      image: SUCCESS_WHITY_ADOPTION_IMAGE,
      imageAlt: "Whity with adopter Noel Agustin",
      intro: "Rescued cat Whity is now starting a new life with a loving fur-parent.",
      adopter: "Noel Agustin of Barangay Margot",
      petName: "Whity",
      storyParagraphs: [
        "Rescued cat Whity is now starting a new life with a loving fur-parent.",
        "Whity was adopted by Noel Agustin of Barangay Margot.",
        "This adoption is part of the city's continuing effort to promote responsible pet ownership."
      ]
    },
    {
      id: "highlight-success-marcia",
      tag: "Success Stories",
      title: "Marcia finds care",
      titleHtml: 'Marcia finds<br><span>care</span>',
      date: "Adoption Story",
      image: SUCCESS_MARCIA_ADOPTION_IMAGE,
      imageAlt: "Marcia in a carrier with adopter Analyn Rivera",
      intro: "Rescued cat Marcia is now starting a new life with a loving fur-parent.",
      adopter: "Analyn Rivera of Brgy. Anunas",
      petName: "Marcia",
      storyParagraphs: [
        "Rescued cat Marcia is now starting a new life with a loving fur-parent.",
        "Marcia was welcomed by Analyn Rivera of Brgy. Anunas.",
        "The shelter gives rescued animals not just temporary care, but a chance at a forever home."
      ]
    }
  ];

  const getNewsAlertConfig = (alert = latestNewsAlert) => ({
    tag: alert.tag,
    title: alert.title,
    titleHtml: alert.titleHtml,
    date: alert.date,
    image: alert.image,
    imageAlt: alert.imageAlt,
    intro: "",
    primary: { label: "View full update", href: announcementStoryHref(alert.id || "highlight-news-nepo-stray-cats") }
  });

  const getSuccessStoryConfig = (story = successStories[0]) => ({
    tag: story.tag,
    title: story.title,
    titleHtml: story.titleHtml,
    date: story.date,
    image: story.image,
    imageAlt: story.imageAlt,
    intro: story.intro,
    primary: { label: "View full update", href: announcementStoryHref(story.id || "highlight-success-zach") }
  });

  const getTimeValue = (value) => {
    if (!value) return 0;
    if (value?.toDate) return value.toDate().getTime();
    if (value?._seconds) return value._seconds * 1000;
    if (value?.seconds) return value.seconds * 1000;
    if (typeof value === "number") return value;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const storyFreshCutoff = () => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.getTime() - STORY_FRESH_MS;
  };

  const isFreshStoryDate = (value) => {
    const time = getTimeValue(value);
    return Boolean(time) && time >= storyFreshCutoff();
  };

  const normalizeAnnouncementType = (value = "") => {
    const type = String(value || "").toLowerCase().trim();
    if (type.includes("event")) return "Upcoming Events";
    if (type.includes("success") || type.includes("rescue")) return "Success Stories";
    return "News & Article";
  };

  const formatStoryDate = (value, fallback = "Recently") => {
    const time = getTimeValue(value);
    if (!time) return fallback;
    return new Date(time).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  };

  const formatStoryTitleHtml = (title = "", fallbackSecondLine = "latest") => {
    const cleanTitle = String(title || "ANIMUA community update").trim();
    if (cleanTitle.length <= 30) {
      return `${escapeHtml(cleanTitle)}<br><span>${escapeHtml(fallbackSecondLine)}</span>`;
    }

    const words = cleanTitle.split(/\s+/);
    let firstLine = "";
    const secondLine = [];

    words.forEach((word) => {
      if (!firstLine || `${firstLine} ${word}`.length <= 30) {
        firstLine = firstLine ? `${firstLine} ${word}` : word;
      } else {
        secondLine.push(word);
      }
    });

    return `${escapeHtml(firstLine)}<br><span>${escapeHtml(secondLine.join(" ") || fallbackSecondLine)}</span>`;
  };

  const getAnnouncementStoryDate = (item = {}) =>
    item.createdAt || item.publishedAt || item.updatedAt || item.eventDate || "";

  const getAnnouncementImage = (item = {}, type = "") => {
    const fallback =
      type === "Upcoming Events"
        ? HIGHLIGHT_UPCOMING_EVENT_IMAGE
        : type === "Success Stories"
          ? HIGHLIGHT_SUCCESS_STORY_IMAGE
          : HIGHLIGHT_NEWS_ALERT_IMAGE;
    return item.imageUrl || item.image || item.imageURL || item.photoURL || item.coverImage || fallback;
  };

  const getAnnouncementParagraphs = (item = {}) => {
    const sources = [
      item.caption,
      item.description,
      item.summary,
      item.body,
      item.content,
      ...(Array.isArray(item.details) ? item.details : []),
      ...(Array.isArray(item.storyParagraphs) ? item.storyParagraphs : [])
    ];
    const seen = new Set();
    return sources
      .flatMap((value) => String(value || "").split(/\n{1,}/))
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .filter((paragraph) => {
        const key = paragraph.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const getAnnouncementStoryConfig = (item = {}) => {
    const type = normalizeAnnouncementType(item.type);
    const title = item.title || "ANIMUA community update";
    const paragraphs = getAnnouncementParagraphs(item);
    const intro = paragraphs[0] || item.caption || item.description || "Official ANIMUA community update.";
    const image = getAnnouncementImage(item, type);

    return {
      id: item.id || item.slug || title,
      tag: type === "News & Article" ? "News & Alerts" : type,
      title,
      titleHtml: formatStoryTitleHtml(title, type === "Upcoming Events" ? "upcoming" : "latest"),
      date: formatStoryDate(getAnnouncementStoryDate(item)),
      image,
      imageAlt: `${title} cover`,
      intro,
      source: item.source || "ANIMUA City Government",
      photoCredit: image ? "Official ANIMUA update" : "",
      hashtag: type,
      storyParagraphs: paragraphs.length ? paragraphs : [intro],
      primary: { label: "View full update", href: announcementStoryHref(item.id || title, type) }
    };
  };

  const getAnnouncementEventConfig = (item = {}) => ({
    ...item,
    date: item.eventDate || item.date || "",
    time: item.eventTime || item.time || "",
    description: item.caption || item.description || item.summary || "",
    image: getAnnouncementImage(item, "Upcoming Events"),
    status: "Published",
    isPublic: true,
    createdAt: item.createdAt || item.updatedAt || ""
  });

  const loadAnnouncementStories = async () => {
    if (announcementStoriesPromise) return announcementStoriesPromise;

    announcementStoriesPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/announcements/public`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Announcement stories request failed with status ${response.status}.`);
        }

        const data = await response.json();
        const rawAnnouncements = Array.isArray(data) ? data : data?.announcements || [];
        const recent = rawAnnouncements
          .filter((item) => isFreshStoryDate(getAnnouncementStoryDate(item)))
          .sort((a, b) => getTimeValue(getAnnouncementStoryDate(b)) - getTimeValue(getAnnouncementStoryDate(a)));

        announcementStories = {
          news: recent
            .filter((item) => normalizeAnnouncementType(item.type) === "News & Article")
            .map(getAnnouncementStoryConfig)
            .slice(0, 4),
          success: recent
            .filter((item) => normalizeAnnouncementType(item.type) === "Success Stories")
            .map(getAnnouncementStoryConfig)
            .slice(0, 4),
          events: recent
            .filter((item) => normalizeAnnouncementType(item.type) === "Upcoming Events")
            .map(getAnnouncementEventConfig)
            .slice(0, 4)
        };
      } catch (error) {
        console.warn("Homepage announcement stories load skipped:", error);
        announcementStories = { news: [], success: [], events: [] };
      }

      return announcementStories;
    })();

    return announcementStoriesPromise;
  };

  const highlightContent = {
    "new-furbabies": {
      tag: "Available Animals",
      title: "Meet Our Newest Furbabies",
      image: "../../src/assets/images/optimized/home/highlight-new-furbabies-cat-720.webp",
      intro:
        "Discover the newest animals currently available for adoption at the Angeles City Veterinary Office. View their profiles to learn about their age, temperament, health information, and care needs.",
      primary: { label: "View All Furbabies", href: "find-furbabies.html" }
    },
    "news-alerts": getNewsAlertConfig(latestNewsAlert),
    "success-stories": {
      tag: "Success Stories",
      title: successStories[0].title,
      titleHtml: successStories[0].titleHtml,
      date: successStories[0].date,
      image: successStories[0].image,
      imageAlt: successStories[0].imageAlt,
      intro: successStories[0].intro,
      primary: { label: "View full update", href: announcementStoryHref(successStories[0].id) }
    },
    events: {
      tag: "Events",
      title: "Upcoming Events",
      image: HIGHLIGHT_UPCOMING_EVENT_IMAGE,
      imageAlt: "Angeles City Veterinary Office speaking at a community event",
      intro:
        "Stay informed about the nearest published shelter or community event from the Angeles City Veterinary Office.",
      primary: { label: "View full update", href: announcementStoryHref("demo-upcoming-event") }
    }
  };

  const escapeHtml = (value = "") =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const clearStoryAdvanceTimer = () => {
    if (!storyAdvanceTimer) return;
    window.clearTimeout(storyAdvanceTimer);
    storyAdvanceTimer = null;
  };

  const renderStoryProgress = (count = 1, activeIndex = 0) => {
    if (!storyModalProgress) return;

    const safeCount = Math.max(1, count);
    storyModalProgress.style.setProperty("--story-progress-count", safeCount);
    storyModalProgress.innerHTML = Array.from({ length: safeCount }, (_, index) => {
      const className =
        index < activeIndex ? "is-complete" : index === activeIndex ? "is-active" : "";
      return `<span${className ? ` class="${className}"` : ""}></span>`;
    }).join("");
  };

  const updateStoryNavigation = (count = 1) => {
    const hasMultipleStories = count > 1;

    [storyModalPrev, storyModalNext].forEach((button) => {
      if (!button) return;
      button.hidden = !hasMultipleStories;
      button.disabled = !hasMultipleStories;
    });
  };

  const restartStoryAnimation = () => {
    storyModalCard.classList.remove("is-story-playing");
    void storyModalCard.offsetWidth;
    storyModalCard.classList.add("is-story-playing");
  };

  const applyStoryConfig = (key, config, progressCount = 1, progressIndex = 0) => {
    storyModalCard.dataset.storyKey = key;
    renderStoryProgress(progressCount, progressIndex);
    updateStoryNavigation(progressCount);

    if (storyModalImage) {
      storyModalImage.src = config.image || "";
      storyModalImage.alt = config.imageAlt || config.title || "";
    }
    if (storyModalAvatar) {
      const avatarImage = config.avatarImage || config.image || "";
      storyModalAvatar.src = avatarImage;
      storyModalAvatar.closest(".story-modal-avatar")?.classList.toggle("is-empty", !avatarImage);
    }
    if (storyModalTag) storyModalTag.textContent = config.tag || "";
    if (storyModalBrandTag) storyModalBrandTag.textContent = config.tag || "";
    if (storyModalDate) storyModalDate.textContent = config.date || "";
    if (storyModalTitle) {
      if (config.titleHtml) {
        storyModalTitle.innerHTML = config.titleHtml;
      } else {
        storyModalTitle.textContent = config.title || "";
      }
    }
    if (storyModalText) storyModalText.textContent = config.intro || "";
    if (storyModalContent) storyModalContent.innerHTML = config.contentHtml || "";
    if (storyModalActions) renderActions(config);
  };

  const petTypeLabel = (pet = {}) => {
    const species = pet.species || pet.type || "";
    const breed = pet.breed || "";
    return [species, breed].filter(Boolean).join(" / ") || "Furbaby";
  };

  const fallbackPetImage = (pet = {}) => {
    const species = (pet.species || pet.type || "").toLowerCase();
    if (species.includes("dog")) return "../../src/assets/images/dog.jpg";
    if (species.includes("cat")) return "../../src/assets/images/cat.jpg";
    return "../../src/assets/images/service-browse-animal.jpg";
  };

  const getPetDateValue = (pet = {}) => {
    const value = pet.createdAt || pet.updatedAt || pet.intakeDate || "";
    return getTimeValue(value);
  };

  const normalizePets = (data) => {
    const rawPets = Array.isArray(data) ? data : data?.pets || [];
    return rawPets
      .filter((pet) => {
        const status = String(pet.status || "").toLowerCase();
        return (!status || status === "ready" || status.includes("adoption")) &&
          isFreshStoryDate(pet.createdAt || pet.updatedAt || pet.intakeDate);
      })
      .sort((a, b) => getPetDateValue(b) - getPetDateValue(a))
      .slice(0, 3);
  };

  const loadNewestPets = async () => {
    if (animalsLoaded) return newestPets;
    animalsLoaded = true;

    try {
      const response = await fetch(`${API_BASE_URL}/public/pets`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load public pets");

      newestPets = normalizePets(await response.json());
    } catch (error) {
      console.error("Homepage newest pets load error:", error);
      newestPets = [];
    }

    return newestPets;
  };

  const getEventDateValue = (event = {}) => {
    const value = event.date || event.eventDate || event.startDate || event.startsAt || event.startAt || "";
    if (value?.toDate) return value.toDate().getTime();
    if (value?._seconds) return value._seconds * 1000;
    if (value?.seconds) return value.seconds * 1000;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const getEventStatus = (event = {}) =>
    String(event.status || event.state || event.publishStatus || "").toLowerCase();

  const isPublishedEvent = (event = {}) => {
    const status = getEventStatus(event);
    const archived =
      event.archived === true ||
      event.isArchived === true ||
      status.includes("archive");
    const unpublished =
      event.published === false ||
      event.isPublished === false ||
      status.includes("draft") ||
      status.includes("unpublish") ||
      status.includes("private");
    const published =
      event.published === true ||
      event.isPublished === true ||
      event.isPublic === true ||
      status.includes("publish") ||
      status.includes("upcoming") ||
      status.includes("active") ||
      status.includes("live");

    return published && !unpublished && !archived;
  };

  const normalizeEvents = (data) => {
    const rawEvents = Array.isArray(data) ? data : data?.events || data?.items || [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return rawEvents
      .filter((event) => {
        if (!isPublishedEvent(event)) return false;
        const dateValue = getEventDateValue(event);
        return Boolean(dateValue) && dateValue >= now.getTime();
      })
      .sort((a, b) => getEventDateValue(a) - getEventDateValue(b))
      .slice(0, 4);
  };

  const isUpcomingEvent = (event = {}) => {
    const dateValue = getEventDateValue(event);
    if (!dateValue) return false;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return dateValue >= now.getTime();
  };

  const getDemoUpcomingEvent = () => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    date.setHours(9, 0, 0, 0);

    return {
      id: "demo-upcoming-event",
      title: "Veterinary Services Brought Closer to Angelenos",
      date: date.toISOString(),
      time: "9:00 AM - 3:00 PM",
      location: "Savannah Phase 1, Savannah Phase 2, and Green Plain Phase 3",
      description:
        "The City of Angeles, through the City Veterinary Office, continues its free anti-rabies vaccination program to protect pets and help prevent the spread of rabies in local communities.",
      image: "../../src/assets/images/demo-rabies-vaccination-drive.jpg",
      status: "Upcoming",
      isPublic: true,
      isDemo: true
    };
  };

  const loadUpcomingEvents = async () => {
    if (eventsLoadPromise) return eventsLoadPromise;

    eventsLoadPromise = (async () => {
      const stories = await loadAnnouncementStories();
      const announcementEvents = normalizeEvents(stories.events);

      try {
        const response = await fetch(`${API_BASE_URL}/public/events`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Events request failed with status ${response.status}.`);
        }

        upcomingEvents = [
          ...announcementEvents,
          ...normalizeEvents(await response.json())
        ].slice(0, 4);
        if (upcomingEvents.length) {
          return upcomingEvents;
        }
      } catch (error) {
        console.warn("Homepage events API load skipped:", error);
      }

      if (announcementEvents.length) {
        upcomingEvents = announcementEvents;
        return upcomingEvents;
      }

      upcomingEvents = [getDemoUpcomingEvent()];
      return upcomingEvents;
    })();

    return eventsLoadPromise;
  };

  const normalizeAdoptedStories = (data) => {
    const rawPets = Array.isArray(data) ? data : data?.stories || data?.pets || data?.animals || [];
    return rawPets
      .filter((pet) => {
        const status = String(pet.status || pet.adoptionStatus || "").toLowerCase();
        return status.includes("adopted") || status.includes("finalized");
      })
      .sort((a, b) => {
        const aDate = a.adoptionDate || a.approvedAt || a.updatedAt || a.createdAt || "";
        const bDate = b.adoptionDate || b.approvedAt || b.updatedAt || b.createdAt || "";
        return getPetDateValue({ updatedAt: bDate }) - getPetDateValue({ updatedAt: aDate });
      })
      .slice(0, 3);
  };

  const loadAdoptedStories = async () => {
    if (adoptedStoriesLoaded) return adoptedStories;
    adoptedStoriesLoaded = true;

    try {
      const response = await fetch(`${API_BASE_URL}/public/adopted-stories`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Adopted stories request failed with status ${response.status}.`);
      }
      adoptedStories = normalizeAdoptedStories(await response.json());
    } catch (error) {
      console.warn("Homepage adopted stories load skipped:", error);
      adoptedStories = [];
    }

    return adoptedStories;
  };

  const formatEventDate = (event = {}) => {
    const value = event.date || event.eventDate || event.startDate || event.startsAt || event.startAt || "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value || "";
    return parsed.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  };

  const formatEventTime = (event = {}) => {
    const value = event.time || event.eventTime || event.startTime || "";
    if (value) return value;

    const dateValue = event.startsAt || event.startAt || "";
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return "";

    return parsed.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit"
    });
  };

  const getEventLocation = (event = {}) => event.location || event.venue || event.address || "";
  const getEventDescription = (event = {}) => {
    const text = event.summary || event.shortDescription || event.description || "";
    return text.length > 180 ? `${text.slice(0, 177).trim()}...` : text;
  };
  const getEventImage = (event = {}) =>
    event.image || event.imageUrl || event.imageURL || event.photoURL || event.coverImage || "";

  const getPetImage = (pet = {}) =>
    pet.photoURL || pet.image || pet.imageUrl || pet.imageURL || pet.photo || fallbackPetImage(pet);

  const getFurbabyStoryConfig = (pet = {}) => {
    const name = pet.displayLabel || pet.shelterLabel || pet.name || `Animal ${pet.id || ""}`.trim() || "Newest furbaby";
    const details = [
      petTypeLabel(pet),
      pet.ageEstimate || pet.age || "Unknown age",
      pet.sex || "Unknown sex"
    ].filter(Boolean);
    const status = pet.status || "Ready for adoption";

    return {
      tag: "New Furbabies",
      title: name,
      titleHtml: `${escapeHtml(name)}<br><span>ready to meet</span>`,
      image: getPetImage(pet),
      imageAlt: `${name} available for adoption`,
      intro: `${name} is one of the newest furbabies available through ANIMUA.`,
      primary: { label: "View furbabies", href: "find-furbabies.html" },
      contentHtml: `
        <div class="story-news-caption">
          <p>${escapeHtml(details.join(" / "))}</p>
          <p>${escapeHtml(status)}</p>
          <p>Open Find Furbabies to view the full profile and submit an adoption application.</p>
        </div>
      `
    };
  };

  const getEventStoryConfig = (event = {}) => {
    const title = event.title || event.name || "Shelter Event";
    const date = formatEventDate(event);
    const time = formatEventTime(event);
    const location = getEventLocation(event);
    const description = getEventDescription(event);
    const detailHref = announcementStoryHref(event.id || "demo-upcoming-event", "Upcoming Events");
    const contentRows = [date, time, location].filter(Boolean).join(" / ");

    return {
      tag: isUpcomingEvent(event) ? "Upcoming Events" : "Event Highlight",
      title,
      titleHtml: `${escapeHtml(title)}<br><span>${isUpcomingEvent(event) ? "upcoming" : "highlight"}</span>`,
      date: date || "Event",
      image: getEventImage(event),
      imageAlt: title,
      intro: description || "Stay informed about Angeles City Veterinary Office events and community activities.",
      primary: { label: "View full update", href: detailHref },
      contentHtml: `
        <div class="story-news-caption">
          ${contentRows ? `<p>${escapeHtml(contentRows)}</p>` : ""}
          ${description ? `<p>${escapeHtml(description)}</p>` : ""}
        </div>
      `
    };
  };

  const updateHighlightPreview = (key, image, alt) => {
    const button = document.querySelector(`.home-highlight-story[data-highlight-key="${key}"]`);
    const img = button?.querySelector(".highlight-cover img");
    if (!button || !img || !image) return;

    img.src = image;
    img.alt = alt || img.alt || "";
  };

  const setHighlightAvailable = (key, isAvailable) => {
    const button = document.querySelector(`.home-highlight-story[data-highlight-key="${key}"]`);
    if (!button) return;
    button.hidden = !isAvailable;
  };

  const setOptionalEventRow = (rowId, valueElement, value) => {
    const row = document.getElementById(rowId);
    if (!row || !valueElement) return;
    row.hidden = !value;
    valueElement.textContent = value || "";
  };

  const openEventsModal = () => {
    const eventsButton = document.querySelector('.home-highlight-story[data-highlight-key="events"]');
    if (eventsButton) {
      eventsButton.click();
    }
  };

  const renderUpcomingEventSection = async () => {
    if (!upcomingEventSection) return;

    const events = await loadUpcomingEvents();
    const event = events[0] || getDemoUpcomingEvent();

    const image = HIGHLIGHT_UPCOMING_EVENT_IMAGE;
    const title = event.title || event.name || "Shelter Event";
    const description = getEventDescription(event);
    const isUpcoming = isUpcomingEvent(event);

    updateHighlightPreview("events", image, title);

    if (upcomingEventLabel) {
      upcomingEventLabel.textContent = isUpcoming ? "UPCOMING EVENT" : "EVENT HIGHLIGHT";
    }
    upcomingEventSection.setAttribute("aria-label", isUpcoming ? "Upcoming event" : "Event highlight");
    upcomingEventTitle.textContent = title;
    setOptionalEventRow("upcomingEventDateRow", upcomingEventDate, formatEventDate(event));
    setOptionalEventRow("upcomingEventTimeRow", upcomingEventTime, formatEventTime(event));
    setOptionalEventRow("upcomingEventLocationRow", upcomingEventLocation, getEventLocation(event));

    if (upcomingEventDescription) {
      upcomingEventDescription.textContent = description;
      upcomingEventDescription.hidden = !description;
    }

    if (upcomingEventMedia && upcomingEventImage) {
      upcomingEventMedia.hidden = !image;
      upcomingEventSection.classList.toggle("is-text-only", !image);
      if (image) {
        upcomingEventImage.src = image;
        upcomingEventImage.alt = title;
      }
    }

    if (upcomingEventAction) {
      upcomingEventAction.textContent = "View Event";
      upcomingEventAction.addEventListener("click", openEventsModal);
    }

    upcomingEventSection.classList.remove("hidden");
  };

  const renderAction = (action, style = "primary") => {
    if (!action) return "";
    const isExternal = /^https?:\/\//i.test(action.href);
    return `<a class="story-modal-action story-modal-action-${style}" href="${escapeHtml(action.href)}"${isExternal ? ' target="_blank" rel="noopener noreferrer"' : ""}>${escapeHtml(action.label)}</a>`;
  };

  const renderActions = (config) => {
    storyModalActions.innerHTML = [
      renderAction(config.primary, "primary"),
      renderAction(config.secondary, "secondary")
    ].join("");
  };

  const renderSteps = (steps) => `
    <div class="story-step-list">
      ${steps
        .map(
          (step) => `
            <section class="story-step-card">
              <h3>${escapeHtml(step.title)}</h3>
              <p>${escapeHtml(step.text)}</p>
            </section>
          `
        )
        .join("")}
    </div>
  `;

  const renderBulletList = (items) => `
    <ul class="story-bullet-list">
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;

  const renderNewFurbabies = async () => {
    storyModalContent.innerHTML = '<p class="story-loading">Loading newest furbabies...</p>';
    const pets = await loadNewestPets();

    if (!pets.length) {
      storyModalContent.innerHTML =
        '<p class="story-empty-state">No new furbabies are available right now. Please check again soon.</p>';
      return;
    }

    showStoryDeck("new-furbabies", pets.map(getFurbabyStoryConfig), 0);
  };

  const renderEvents = async () => {
    storyModalContent.innerHTML = '<p class="story-loading">Loading upcoming events...</p>';
    const events = await loadUpcomingEvents();

    if (!events.length) {
      storyModalContent.innerHTML =
        '<p class="story-empty-state">There are no upcoming events at the moment. Please check again soon.</p>';
      return;
    }

    showStoryDeck("events", events.map(getEventStoryConfig), 0);
  };

  const renderSuccessStories = async () => {
    storyModalContent.innerHTML = '<p class="story-loading">Loading success stories...</p>';
    const stories = await loadAnnouncementStories();
    const deck = stories.success.length ? stories.success : successStories.map(getSuccessStoryConfig);
    showStoryDeck("success-stories", deck, 0);
  };

  const renderStaticContent = (key) => {
    if (key === "news-alerts") {
      const alert = activeStoryDeck[activeStoryIndex] || newsAlerts[activeStoryIndex] || latestNewsAlert;
      const storyParagraphs = alert.storyParagraphs || alert.paragraphs?.slice(1) || [];
      storyModalContent.innerHTML = `
        <div class="story-news-caption">
          ${storyParagraphs
            .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
            .join("")}
          ${alert.photoCredit ? `<p class="story-news-credit"><i class="fa-regular fa-image" aria-hidden="true"></i> ${escapeHtml(alert.photoCredit)}</p>` : ""}
          <p class="story-news-source">${escapeHtml(alert.source || "ANIMUA City Government")}${alert.hashtag ? ` | ${escapeHtml(alert.hashtag)}` : ""}</p>
        </div>
      `;
    } else if (key === "success-stories") {
      const story = activeStoryDeck[activeStoryIndex] || successStories[activeStoryIndex] || successStories[0];
      storyModalContent.innerHTML = `
        <div class="story-news-caption">
          ${(story.storyParagraphs || [])
            .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
            .join("")}
          <p class="story-news-credit"><i class="fa-solid fa-heart" aria-hidden="true"></i> Rescued pets now with new homes</p>
          <p class="story-news-source">${escapeHtml(story.source || "Adopt, Don't Shop | Angeles City Dog Pound and Animal Shelter")}</p>
        </div>
      `;
    }
  };

  const showStoryDeck = (key, deck = [], index = 0) => {
    if (!deck.length) return;

    activeHighlightKey = key;
    activeStoryDeck = deck;
    activeStoryIndex = ((index % deck.length) + deck.length) % deck.length;

    applyStoryConfig(key, activeStoryDeck[activeStoryIndex], activeStoryDeck.length, activeStoryIndex);
    renderStaticContent(key);
    restartStoryAnimation();

    clearStoryAdvanceTimer();
    if (activeStoryDeck.length > 1 && !storyModal.classList.contains("hidden")) {
      storyAdvanceTimer = window.setTimeout(() => {
        showStoryDeck(key, activeStoryDeck, activeStoryIndex + 1);
      }, STORY_AUTO_ADVANCE_MS);
    }
  };

  const showNewsAlert = (index = 0) => {
    storyModalContent.innerHTML = '<p class="story-loading">Loading news and alerts...</p>';
    loadAnnouncementStories().then((stories) => {
      const deck = stories.news.length ? stories.news : newsAlerts.map(getNewsAlertConfig);
      showStoryDeck("news-alerts", deck, index);
    });
  };

  const goToStory = (direction) => {
    if (!activeHighlightKey || activeStoryDeck.length <= 1) return;
    showStoryDeck(activeHighlightKey, activeStoryDeck, activeStoryIndex + direction);
  };

  const initializeHighlightPreviews = async () => {
    const pets = await loadNewestPets();
    const stories = await loadAnnouncementStories();

    if (pets[0]) {
      updateHighlightPreview(
        "new-furbabies",
        getPetImage(pets[0]),
        pets[0].displayLabel || pets[0].shelterLabel || pets[0].name || "Newest furbaby"
      );
    }
    setHighlightAvailable("new-furbabies", true);

    const events = await loadUpcomingEvents();
    if (events[0]) {
      updateHighlightPreview(
        "events",
        getEventImage(events[0]) || HIGHLIGHT_UPCOMING_EVENT_IMAGE,
        events[0]?.title || events[0]?.name || "Upcoming event"
      );
    }
    setHighlightAvailable("events", true);

    if (stories.success[0] || successStories[0]) {
      const story = stories.success[0] || successStories[0];
      updateHighlightPreview(
        "success-stories",
        story.image || HIGHLIGHT_SUCCESS_STORY_IMAGE,
        story.title
      );
    }
    setHighlightAvailable("success-stories", true);

    if (stories.news[0] || latestNewsAlert) {
      const story = stories.news[0] || latestNewsAlert;
      updateHighlightPreview(
        "news-alerts",
        story.image || HIGHLIGHT_NEWS_ALERT_IMAGE,
        story.title
      );
    }
    setHighlightAvailable("news-alerts", true);
  };

  const closeStoryModal = () => {
    clearStoryAdvanceTimer();
    activeHighlightKey = null;
    activeStoryIndex = 0;
    activeStoryDeck = [];
    updateStoryNavigation(1);
    storyModal.classList.add("hidden");
    storyModal.setAttribute("aria-hidden", "true");
    storyModalCard.classList.remove("is-story-playing");
    document.body.classList.remove("modal-open");
    storyButtons.forEach((button) => {
      button.classList.remove("is-selected");
      button.setAttribute("aria-pressed", "false");
    });
    if (lastFocusedHighlight) lastFocusedHighlight.focus();
  };

  storyButtons.forEach((button) => {
    button.setAttribute("aria-haspopup", "dialog");
    button.setAttribute("aria-pressed", "false");

    button.addEventListener("click", async () => {
      const key = button.dataset.highlightKey;
      const config = highlightContent[key];
      if (!config) return;

      lastFocusedHighlight = button;
      activeHighlightKey = key;
      activeStoryIndex = 0;
      activeStoryDeck = [];
      clearStoryAdvanceTimer();
      storyButtons.forEach((item) => {
        item.classList.toggle("is-selected", item === button);
        item.setAttribute("aria-pressed", item === button ? "true" : "false");
      });

      applyStoryConfig(key, config);

      storyModal.classList.remove("hidden");
      storyModal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
      restartStoryAnimation();
      storyModalCard.focus();

      if (key === "news-alerts") {
        showNewsAlert(0);
      } else if (key === "new-furbabies") {
        await renderNewFurbabies();
      } else if (key === "events") {
        await renderEvents();
      } else if (key === "success-stories") {
        await renderSuccessStories();
      } else {
        renderStaticContent(key);
      }
    });
  });

  if (storyModalClose) {
    storyModalClose.addEventListener("click", closeStoryModal);
  }

  if (storyModalPrev) {
    storyModalPrev.addEventListener("click", (event) => {
      event.stopPropagation();
      goToStory(-1);
    });
  }

  if (storyModalNext) {
    storyModalNext.addEventListener("click", (event) => {
      event.stopPropagation();
      goToStory(1);
    });
  }

  renderUpcomingEventSection();
  initializeHighlightPreviews();

  storyModal.addEventListener("click", (event) => {
    if (event.target === storyModal) {
      closeStoryModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (storyModal.classList.contains("hidden")) return;

    if (event.key === "Escape") {
      closeStoryModal();
      return;
    }

    if (activeStoryDeck.length > 1 && event.key === "ArrowLeft") {
      event.preventDefault();
      goToStory(-1);
      return;
    }

    if (activeStoryDeck.length > 1 && event.key === "ArrowRight") {
      event.preventDefault();
      goToStory(1);
      return;
    }

    if (event.key === "Tab") {
      const focusable = storyModal.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
}

function setupFeaturedFurbabies() {
  const grid = document.getElementById("featuredFurbabiesGrid");
  if (!grid) return;

  const escapeHtml = (value = "") =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const petTypeLabel = (pet = {}) => {
    const details = [pet.species, pet.breed].filter(Boolean);
    return details.join(" / ") || "Furbaby";
  };

  const getFeaturedName = (pet = {}) => {
    const directName = String(pet.name || pet.animalName || pet.adoptedName || "").trim();
    if (directName) return directName;

    const label = String(pet.displayLabel || pet.shelterLabel || pet.identifyingDescription || "").trim();
    const [primaryLabel] = label.split(/\s+(?:-|•|\|)\s+/);
    const cleanedLabel = primaryLabel
      .replace(/\b(?:male|female|cat|dog)\b.*$/i, "")
      .replace(/\b\d+(?:\s*(?:year|years|month|months|yr|yrs|mo|mos))?.*$/i, "")
      .trim();

    return cleanedLabel || primaryLabel || `Animal ${pet.id || ""}`.trim() || "This furbaby";
  };

  const getPetDateValue = (pet = {}) => {
    const value = pet.createdAt || pet.updatedAt || pet.intakeDate || "";
    if (value?._seconds) return value._seconds * 1000;
    if (typeof value === "number") return value;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const getFeaturedFacts = (pet = {}) => {
    const details = [pet.sex, pet.ageEstimate, pet.species].filter(Boolean);
    return details.length ? details : [petTypeLabel(pet)];
  };

  const fallbackPetImage = (pet = {}) => {
    const species = String(pet.species || "").toLowerCase();
    if (species.includes("cat")) return "../../src/assets/images/optimized/home/highlight-new-furbabies-cat-360.webp";
    return "../../src/assets/images/optimized/home/hero-shelter-dog-kennel-768.webp";
  };

  const openPetProfile = (petId) => {
    if (petId) {
      sessionStorage.setItem("animua_selected_pet_id", petId);
      sessionStorage.setItem("animua_selected_pet_action", "view");
    }

    window.location.href = "find-furbabies.html";
  };

  const renderPets = (pets) => {
    if (!pets.length) {
      grid.innerHTML =
        '<p class="featured-furbabies-state">No featured furbabies are available right now. Please check again soon.</p>';
      return;
    }

    const cards = pets.slice(0, 3).map((pet, index) => {
      const name = getFeaturedName(pet);
      const typeIcon = String(pet.species || "").toLowerCase().includes("dog") ? "fa-dog" : "fa-cat";
      const facts = getFeaturedFacts(pet)
        .map((fact) => `<span>${escapeHtml(fact)}</span>`)
        .join("");
      return `
        <button type="button" class="featured-furbaby-card ${index === 0 ? "is-featured" : ""}" data-pet-id="${escapeHtml(pet.id || "")}" aria-label="View profile for ${escapeHtml(name)}">
          <img src="${escapeHtml(pet.photoURL || fallbackPetImage(pet))}" alt="${escapeHtml(name)} available for adoption" width="720" height="540" loading="lazy" decoding="async">
          <span class="featured-furbaby-card-copy">
            <strong>${escapeHtml(name)}</strong>
            <em><i class="fa-solid ${typeIcon}" aria-hidden="true"></i>${facts}</em>
            ${index === 0 ? "<small>Calm, curious, and ready for a gentle home.</small>" : ""}
          </span>
          <span class="featured-furbaby-arrow" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></span>
        </button>
      `;
    }).join("");

    grid.innerHTML = `
      <article class="featured-furbabies-showcase">
        <div class="featured-furbabies-copy">
          <span class="section-label">Featured Furbabies</span>
          <h2>Waiting<br>for a Home</h2>
          <p>These animals are safe in our care and ready to find a family who will love them as much as they'll love you.</p>

          <div class="featured-furbabies-actions">
            <a class="featured-furbabies-view-all" href="find-furbabies.html">View All Furbabies <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
          </div>
        </div>

        <div class="featured-furbabies-card-wrap">
          ${cards}
        </div>

        <div class="featured-furbabies-care-row" aria-label="Adoption care highlights">
          <div><i class="fa-solid fa-shield-heart" aria-hidden="true"></i><strong>Safe & Healthy</strong><span>All animals are vaccinated, dewormed, and well cared for.</span></div>
          <div><i class="fa-regular fa-heart" aria-hidden="true"></i><strong>Shelter Care</strong><span>They are given love, proper nutrition, and daily care.</span></div>
          <div><i class="fa-solid fa-house" aria-hidden="true"></i><strong>Ready for Adoption</strong><span>Each one is waiting for a responsible and loving family.</span></div>
          <div><i class="fa-solid fa-people-group" aria-hidden="true"></i><strong>Make a Difference</strong><span>Adopt and help us save more animals in need.</span></div>
        </div>
      </article>
    `;

    grid.querySelectorAll(".featured-furbaby-card img").forEach((image, index) => {
      const pet = pets[index];
      image.addEventListener("error", () => {
        image.src = fallbackPetImage(pet);
      }, { once: true });
    });

    grid.querySelectorAll(".featured-furbaby-card").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        openPetProfile(button.dataset.petId);
      });
    });
  };

  fetch(`${API_BASE_URL}/public/pets`, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("Failed to load featured pets");
      return response.json();
    })
    .then((data) => {
      const rawPets = Array.isArray(data) ? data : data?.pets || [];
      const pets = rawPets
        .filter((pet) => {
          const status = String(pet.status || "").toLowerCase();
          return pet.id && (!status || status === "ready" || status.includes("adoption"));
        })
        .sort((a, b) => getPetDateValue(b) - getPetDateValue(a))
        .slice(0, 3);

      renderPets(pets);
    })
    .catch((error) => {
      console.error("Featured furbabies load error:", error);
      renderPets([]);
    });
}

function setupAboutPhotoLightbox() {
  const galleryButtons = document.querySelectorAll(".about-shelter-card");
  const lightbox = document.getElementById("aboutPhotoLightbox");
  const panel = document.querySelector(".about-photo-lightbox-panel");
  const closeBtn = document.getElementById("aboutPhotoLightboxClose");
  const image = document.getElementById("aboutPhotoLightboxImage");
  const title = document.getElementById("aboutPhotoLightboxTitle");

  if (!galleryButtons.length || !lightbox || !panel || !image || !title) return;

  let lastFocusedTile = null;

  const closeLightbox = () => {
    lightbox.classList.add("hidden");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (lastFocusedTile) lastFocusedTile.focus();
  };

  galleryButtons.forEach((button) => {
    button.setAttribute("aria-haspopup", "dialog");

    button.addEventListener("click", () => {
      const tileImage = button.querySelector("img");
      const tileLabel = button.querySelector("span");
      if (!tileImage) return;

      lastFocusedTile = button;
      image.src = tileImage.currentSrc || tileImage.src;
      image.alt = tileImage.alt || "";
      title.textContent = tileLabel?.textContent || tileImage.alt || "Shelter photo";

      lightbox.classList.remove("hidden");
      lightbox.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
      panel.focus();
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", closeLightbox);
  }

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (lightbox.classList.contains("hidden")) return;

    if (event.key === "Escape") {
      closeLightbox();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = lightbox.querySelectorAll(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

window.toggleAuthView = function () {
  if (authModal && authModal.classList.contains("auth-switching")) return;

  const loginVisible = loginSection && !loginSection.classList.contains("hidden");
  const currentSection = loginVisible ? loginSection : registerSection;
  const nextSection = loginVisible ? registerSection : loginSection;
  resetAuthPanelScroll();

  if (authModal) {
    authModal.classList.remove("slide-to-register", "slide-to-login");
    authModal.classList.add(loginVisible ? "slide-to-register" : "slide-to-login");
    authModal.classList.add("auth-switching");
    window.setTimeout(() => {
      authModal.classList.remove("auth-switching", "slide-to-register", "slide-to-login");
    }, 480);
  }

  if (currentSection && nextSection) {
    nextSection.classList.add("hidden");
    nextSection.classList.remove("auth-view-exit", "auth-view-enter");
    currentSection.classList.remove("auth-view-exit", "auth-view-enter");
    currentSection.classList.add("auth-view-exit");

    window.setTimeout(() => {
      currentSection.classList.add("hidden");
      currentSection.classList.remove("auth-view-exit");
      nextSection.classList.remove("hidden");
      nextSection.classList.add("auth-view-enter");
      resetAuthPanelScroll();
    }, 120);

    window.setTimeout(() => {
      nextSection.classList.remove("auth-view-enter");
      resetAuthPanelScroll();
    }, 260);
  }

  if (loginVisible) {
    clearFormErrors();
    if (authModal) authModal.classList.add("register-mode");
    if (authSideTag) authSideTag.textContent = "New Here?";
    if (authModalTitle) authModalTitle.textContent = "Join Animua.";
    if (authSideText) {
      authSideText.textContent =
        "Create your account and start connecting rescued animals with safer homes.";
    }
    if (authSideAction) authSideAction.textContent = "Sign in";
  } else {
    clearFormErrors();
    if (authModal) authModal.classList.remove("register-mode");
    if (authSideTag) authSideTag.textContent = "Welcome Back";
    if (authModalTitle) authModalTitle.textContent = "Welcome back.";
    if (authSideText) {
      authSideText.textContent =
        "Continue managing matches, applications, and rescued animals through Animua.";
    }
    if (authSideAction) authSideAction.textContent = "Create account";
  }
};

if (menuToggle && navbar) {
  menuToggle.addEventListener("click", () => {
    document.getElementById("userDropdown")?.classList.add("hidden");
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
  if (document.body.classList.contains("submissions-page")) {
    header.classList.add("scrolled");
  }

  window.addEventListener("scroll", () => {
    if (document.body.classList.contains("submissions-page")) {
      header.classList.add("scrolled");
      return;
    }

    if (window.scrollY > 20) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }
  });
}

if (heroLearnMore) {
  heroLearnMore.addEventListener("click", (event) => {
    const target = document.querySelector(heroLearnMore.getAttribute("href"));

    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

if (notificationBtn) {
  notificationBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleNotificationsPopup();
  });
}

if (notificationBtn && notificationPopup) {
  document.addEventListener("click", (event) => {
    if (
      !notificationPopup.contains(event.target) &&
      !notificationBtn.contains(event.target)
    ) {
      notificationPopup.classList.remove("show");
    }
  });
}

function getNotificationIcon(category = "", type = "") {
  if (category === "contact") return "fa-regular fa-envelope";
  if (category === "application") return "fa-solid fa-file-circle-check";
  if (category === "surrender") return "fa-solid fa-hand-holding-heart";
  if (category === "event" || type.includes("event")) return "fa-solid fa-bullhorn";
  return "fa-solid fa-bell";
}

function formatNotificationTime(value = "") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function updateNotificationBadge(unreadCount = 0) {
  if (!notificationDot || !notificationBtn) return;

  const safeCount = Math.max(0, Number(unreadCount || 0));
  notificationDot.hidden = safeCount <= 0;
  notificationDot.textContent = safeCount > 99 ? "99+" : safeCount ? String(safeCount) : "";
  notificationBtn.setAttribute(
    "aria-label",
    safeCount > 0 ? `Notifications, ${safeCount} unread` : "Notifications"
  );
}

function renderNotificationsPopup(items = [], unreadCount = 0) {
  if (!notificationPopup) return;

  notificationPopup.innerHTML = `
    <div class="notification-popup-head">
      <div class="notification-popup-title">
        <h4>Notifications</h4>
        <p>${unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "All caught up"}</p>
      </div>
      <button type="button" class="notification-settings-mini" id="notificationSettingsMini">
        <i class="fa-solid fa-gear" aria-hidden="true"></i>
        <span>Settings</span>
      </button>
    </div>
    <div class="notification-list notification-inbox-list">
      ${items.length
        ? items.map((item) => `
            <a class="notification-item ${item.read === true ? "" : "is-unread"}" href="${item.link || "#"}">
              <span class="notification-item-icon"><i class="${getNotificationIcon(item.category, item.type || "")}" aria-hidden="true"></i></span>
              <span class="notification-item-copy">
                <strong>${escapeHtmlText(item.title || "ANIMUA update")}</strong>
                <small>${escapeHtmlText(item.message || "")}</small>
                <time>${escapeHtmlText(formatNotificationTime(item.createdAt || item.eventDate))}</time>
              </span>
            </a>
          `).join("")
        : '<p class="notification-empty">No notifications yet.</p>'}
    </div>
  `;

  notificationPopup.querySelector("#notificationSettingsMini")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    notificationPopup.classList.remove("show");
    showNotificationSettingsDialog();
  });

  updateNotificationBadge(unreadCount);
}

function renderNotificationsLoading() {
  if (!notificationPopup) return;
  notificationPopup.innerHTML = `
    <div class="notification-popup-head">
      <div class="notification-popup-title">
        <h4>Notifications</h4>
        <p>Checking updates</p>
      </div>
    </div>
    <div class="notification-list notification-inbox-list">
      <p class="notification-empty">Loading notifications...</p>
    </div>
  `;
}

async function fetchNotifications({ markRead = false } = {}) {
  if (!hasUserSession()) throw new Error("Please log in to view notifications.");

  const response = await fetch(`${API_BASE_URL}/notifications`, {
    credentials: "include"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || "Unable to load notifications.");
    error.status = response.status;
    throw error;
  }

  renderNotificationsPopup(data.notifications || [], Number(data.unreadCount || 0));

  if (markRead && Number(data.unreadCount || 0) > 0) {
    fetch(`${API_BASE_URL}/notifications/read`, {
      method: "PATCH",
      credentials: "include"
    }).then(() => {
      updateNotificationBadge(0);
      notificationPopup?.querySelectorAll(".notification-item.is-unread")
        .forEach((item) => item.classList.remove("is-unread"));
    }).catch((error) => console.warn("[notifications read]", error.message));
  }

  return data;
}

async function toggleNotificationsPopup() {
  if (!notificationPopup) return;

  if (!hasUserSession()) {
    sessionStorage.setItem("animua_open_auth_modal", "true");
    showLoginView();
    openAuthModal();
    return;
  }

  const willOpen = !notificationPopup.classList.contains("show");
  document.getElementById("userDropdown")?.classList.add("hidden");
  notificationPopup.classList.toggle("show", willOpen);
  if (!willOpen) return;

  renderNotificationsLoading();
  try {
    await fetchNotifications({ markRead: true });
  } catch (error) {
    if (isSessionExpiredError(error)) {
      promptLoginAfterSessionExpired();
      return;
    }

    notificationPopup.innerHTML = `
      <div class="notification-popup-head">
        <div class="notification-popup-title">
          <h4>Notifications</h4>
          <p>Could not load updates</p>
        </div>
      </div>
      <div class="notification-list notification-inbox-list">
        <p class="notification-empty">${escapeHtmlText(error.message || "Unable to load notifications.")}</p>
      </div>
    `;
  }
}

function refreshNotificationDot() {
  if (!hasUserSession()) {
    updateNotificationBadge(0);
    return;
  }
  fetchNotifications({ markRead: false }).catch((error) => {
    if (isSessionExpiredError(error)) {
      promptLoginAfterSessionExpired();
      return;
    }

    updateNotificationBadge(0);
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

quizIntroTriggers.forEach((trigger) => {
  trigger.addEventListener("click", openQuizIntroModal);
});

quizIntroCloseButtons.forEach((button) => {
  button.addEventListener("click", closeQuizIntroModal);
});

quizPageTriggers.forEach((trigger) => {
  trigger.addEventListener("click", openQuizPageModal);
});

quizPageCloseButtons.forEach((button) => {
  button.addEventListener("click", closeQuizPageModal);
});

if (quizIntroModal) {
  quizIntroModal.addEventListener("click", (event) => {
    if (event.target === quizIntroModal) {
      closeQuizIntroModal();
    }
  });
}

if (quizPageModal) {
  quizPageModal.addEventListener("click", (event) => {
    if (event.target === quizPageModal) {
      closeQuizPageModal();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  if (quizPageModal && !quizPageModal.classList.contains("hidden")) {
    closeQuizPageModal();
    return;
  }

  if (quizIntroModal && !quizIntroModal.classList.contains("hidden")) {
    closeQuizIntroModal();
  }
});

if (loginForm) {
  loginForm.addEventListener("submit", handleLogin);
}

document.querySelectorAll(".auth-muted-link").forEach((link) => {
  if (!/forgot password/i.test(link.textContent || "") || link.dataset.forgotPasswordBound) return;

  link.dataset.forgotPasswordBound = "true";
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showForgotPasswordDialog();
  });
});

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
function setupUserDropdown() {
  const userMenuBtn = document.getElementById("userMenuBtn");
  const userDropdown = document.getElementById("userDropdown");
  const viewProfileBtn = document.getElementById("viewProfileBtn");
  const myApplicationsBtn = document.getElementById("myApplicationsBtn");
  const compatibilityResultsBtn = document.getElementById("compatibilityResultsBtn");

  if (!userMenuBtn || !userDropdown) return;

  userMenuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    notificationPopup?.classList.remove("show");
    navbar?.classList.remove("show");
    body.classList.remove("menu-open");
    userDropdown.classList.toggle("hidden");
  });

  viewProfileBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    userDropdown.classList.add("hidden");
    openProfileModal(viewProfileBtn);
  });

  myApplicationsBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    userDropdown.classList.add("hidden");
    window.location.href = "my-submissions.html";
  });

  compatibilityResultsBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    userDropdown.classList.add("hidden");
    window.location.href = "compatibilityResults.html";
  });

  userDropdown.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", () => {
    userDropdown.classList.add("hidden");
  });
}

async function openProfileModal(trigger = null) {
  ensureAccountProfileModal();
  if (!profileModal) return;

  if (!hasUserSession()) {
    sessionStorage.setItem("animua_open_auth_modal", "true");
    showLoginView();
    openAuthModal();
    return;
  }

  lastProfileTrigger = trigger;
  lockCompactProfileModalSize();
  profileModal.classList.remove("hidden");
  profileModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setProfileEditing(false);
  setProfilePendingChanges(false);
  setProfileSaveState("idle");
  setProfileStatus("Loading profile...");

  try {
    const account = await fetchCurrentAccount();
    renderProfileModal(account);
    setProfileStatus("");
  } catch (error) {
    if (isSessionExpiredError(error)) {
      promptLoginAfterSessionExpired();
      return;
    }

    const fallbackAccount = mergeAccountFallbacks(currentProfileAccount || {});
    if (fallbackAccount.fullName || fallbackAccount.email) {
      currentProfileAccount = fallbackAccount;
      renderProfileModal(fallbackAccount);
      setProfileStatus("Some profile details could not refresh, but your account identity is shown.");
      return;
    }

    setProfileStatus(error.message || "Unable to load your profile.");
  }
}

function closeProfileModal() {
  if (!profileModal) return;

  profileModal.classList.add("hidden");
  profileModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  setProfileStatus("");
  setProfileEditing(false);
  setProfilePendingChanges(false);
  setProfileSaveState("idle");
  lastProfileTrigger?.focus?.({ preventScroll: true });
}

async function fetchCurrentAccount() {
  const response = await fetch(`${API_BASE_URL}/auth/account`, {
    credentials: "include",
    cache: "no-store",
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to load account details.");
  }

  currentProfileAccount = mergeAccountFallbacks(data.account || {});
  setUserSession(currentProfileAccount);
  pendingProfilePhotoDataUrl = currentProfileAccount.profilePhotoDataUrl || "";
  return currentProfileAccount;
}

function getStoredProfileFallbacks() {
  const session = getUserSession() || {};
  return {
    fullName: session.fullName || "",
    email: session.email || "",
    profilePhotoDataUrl: session.profilePhotoDataUrl || "",
  };
}

function mergeAccountFallbacks(account = {}) {
  const fallback = getStoredProfileFallbacks();
  return {
    ...account,
    fullName: account.fullName || fallback.fullName,
    email: account.email || fallback.email,
    profilePhotoDataUrl: account.profilePhotoDataUrl || fallback.profilePhotoDataUrl,
  };
}

function renderProfileModal(account = {}) {
  const mergedAccount = mergeAccountFallbacks(account);
  const fullName = mergedAccount.fullName || "User";
  const email = mergedAccount.email || "";
  const firstName = getFirstName(fullName);
  const createdAt = mergedAccount.createdAt ? new Date(mergedAccount.createdAt) : null;
  const memberSince = createdAt && !Number.isNaN(createdAt.getTime())
    ? createdAt.getFullYear()
    : new Date().getFullYear();

  setText("profileSummaryName", firstName);
  setText("profileMemberSince", String(memberSince));
  setValue("profileFullName", fullName);
  setValue("profileEmail", email);
  setValue("profilePhone", mergedAccount.phone || "");
  setNotificationSummary(mergedAccount);
  renderProfileAvatar(fullName, mergedAccount.profilePhotoDataUrl || "");
}

function renderProfileAvatar(fullName, photoDataUrl = "") {
  const avatar = document.getElementById("profileAvatarPreview");
  if (!avatar) return;

  if (photoDataUrl) {
    avatar.innerHTML = `<img src="${photoDataUrl}" alt="">`;
  } else {
    avatar.textContent = getInitial(fullName);
  }
}

function setProfileEditing(isEditing) {
  profileForm?.classList.toggle("is-editing", isEditing);
  profileForm?.classList.remove("is-saving");
  if (isEditing) setProfileSaveState("idle");

  const fullNameField = document.getElementById("profileFullName");
  const emailField = document.getElementById("profileEmail");
  const phoneField = document.getElementById("profilePhone");
  if (fullNameField) fullNameField.readOnly = true;
  if (emailField) emailField.readOnly = true;
  if (phoneField) phoneField.readOnly = !isEditing;

  if (profileSaveBtn) profileSaveBtn.disabled = !isEditing && !hasPendingProfileChanges;
  if (profileEditBtn) {
    const label = profileEditBtn.querySelector("span") || profileEditBtn;
    label.textContent = isEditing ? "Editing..." : "Edit Profile";
  }
}

function setProfilePendingChanges(hasChanges) {
  hasPendingProfileChanges = Boolean(hasChanges);
  if (profileSaveBtn) {
    profileSaveBtn.disabled =
      !hasPendingProfileChanges && !profileForm?.classList.contains("is-editing");
  }
}

function setProfileSaveState(state = "idle") {
  if (!profileSaveBtn) return;

  const icon = profileSaveBtn.querySelector("i");
  const label = profileSaveBtn.querySelector("span") || profileSaveBtn;
  profileForm?.classList.toggle("is-saving", state === "saving");
  profileForm?.classList.toggle("is-saved", state === "saved");

  if (state === "saving") {
    profileSaveBtn.disabled = true;
    profileSaveBtn.setAttribute("aria-busy", "true");
    if (icon) icon.className = "fa-solid fa-spinner";
    label.textContent = "Saving...";
    return;
  }

  profileSaveBtn.removeAttribute("aria-busy");
  if (icon) {
    icon.className = state === "saved"
      ? "fa-solid fa-check"
      : "fa-regular fa-floppy-disk";
  }
  label.textContent = state === "saved" ? "Changes Saved" : "Save Changes";
}

function setProfileStatus(message, isSuccess = false) {
  const status = document.getElementById("profileStatusMessage");
  if (!status) return;

  status.textContent = message;
  status.classList.toggle("is-success", isSuccess);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value;
}

function getValue(id) {
  return document.getElementById(id)?.value.trim() || "";
}

function normalizeNotificationSettings(settings = {}) {
  return {
    applicationUpdates: settings.applicationUpdates !== false,
    surrenderRequestUpdates: settings.surrenderRequestUpdates !== false,
    announcementsEvents: settings.announcementsEvents !== false,
  };
}

function getNotificationPreferenceSummary(settings = {}) {
  const normalized = normalizeNotificationSettings(settings);
  const enabledCount = Object.values(normalized).filter(Boolean).length;

  if (enabledCount === 3) return "Email and push notifications";
  if (enabledCount === 0) return "No notifications";
  if (enabledCount === 1) return "1 notification category enabled";
  return `${enabledCount} notification categories enabled`;
}

function setNotificationSummary(account = currentProfileAccount || {}) {
  setText(
    "profileNotificationSummary",
    account.notificationPreference ||
      getNotificationPreferenceSummary(account.notificationSettings)
  );
}

async function ensureCurrentAccount() {
  if (currentProfileAccount?.email) return currentProfileAccount;
  return fetchCurrentAccount();
}

async function showNotificationSettingsDialog({ returnToProfile = false } = {}) {
  if (!hasUserSession()) {
    sessionStorage.setItem("animua_open_auth_modal", "true");
    showLoginView();
    openAuthModal();
    return;
  }

  if (returnToProfile) closeProfileModal();

  let account = currentProfileAccount || {};
  try {
    account = await ensureCurrentAccount();
  } catch (error) {
    if (isSessionExpiredError(error)) {
      promptLoginAfterSessionExpired();
      return;
    }

    Swal.fire({
      icon: "error",
      title: "Unable to Load Notifications",
      text: error.message || "Please try again.",
      customClass: {
        popup: "animua-popup",
        confirmButton: "animua-confirm"
      },
      buttonsStyling: false
    });
    return;
  }

  const settings = normalizeNotificationSettings(account.notificationSettings);

  await Swal.fire({
    html: `
      <div class="notification-settings-modal">
        <div class="notification-settings-head">
          <div class="notification-settings-title-icon" aria-hidden="true">
            <i class="fa-solid fa-bell"></i>
          </div>
          <div class="notification-settings-title-copy">
            <h2>Notifications</h2>
            <p>Manage which ANIMUA updates you receive.</p>
          </div>
        </div>

        <div class="notification-settings-reminder">
          <span aria-hidden="true"><i class="fa-solid fa-bell"></i></span>
          <p><strong>Reminder:</strong> You can turn notifications on or off anytime.</p>
        </div>

        <div class="notification-settings-card">
          ${renderNotificationToggleRow({
            key: "applicationUpdates",
            icon: "fa-solid fa-file-circle-check",
            title: "Application Updates",
            description: "Adoption status, shelter review, approval, or rejection.",
            checked: settings.applicationUpdates
          })}
          ${renderNotificationToggleRow({
            key: "surrenderRequestUpdates",
            icon: "fa-solid fa-hand-holding-heart",
            title: "Surrender Request Updates",
            description: "Surrender approval, rejection, appointment, or request status changes.",
            checked: settings.surrenderRequestUpdates
          })}
          ${renderNotificationToggleRow({
            key: "announcementsEvents",
            icon: "fa-solid fa-bullhorn",
            title: "Event Notifications",
            description: "Upcoming ANIMUA events, announcements, alerts, and important notices.",
            checked: settings.announcementsEvents
          })}
        </div>
        <p class="notification-settings-status" aria-live="polite"></p>
      </div>
    `,
    showCancelButton: true,
    showCloseButton: true,
    confirmButtonText: '<i class="fa-regular fa-floppy-disk"></i><span>Save Changes</span>',
    cancelButtonText: "Cancel",
    reverseButtons: true,
    showLoaderOnConfirm: true,
    allowOutsideClick: () => !Swal.isLoading(),
    allowEscapeKey: () => !Swal.isLoading(),
    customClass: {
      popup: "animua-popup notification-settings-popup",
      htmlContainer: "notification-settings-html",
      actions: "notification-settings-actions",
      confirmButton: "notification-settings-confirm",
      cancelButton: "notification-settings-cancel",
      closeButton: "notification-settings-close"
    },
    buttonsStyling: false,
    didOpen: () => bindNotificationSettingsControls({ returnToProfile }),
    preConfirm: handleNotificationSettingsConfirm
  });
}

function renderNotificationToggleRow({ key, icon, title, description, checked }) {
  return `
    <label class="notification-settings-row">
      <span class="notification-settings-icon"><i class="${icon}" aria-hidden="true"></i></span>
      <span class="notification-settings-copy">
        <strong>${title}</strong>
        <small>${description}</small>
      </span>
      <span class="notification-settings-switch">
        <input type="checkbox" data-notification-setting="${key}" ${checked ? "checked" : ""}>
        <span class="notification-settings-slider" aria-hidden="true"></span>
        <em>${checked ? "ON" : "OFF"}</em>
      </span>
    </label>
  `;
}

function returnToProfileFromSwal() {
  Swal.close();
  window.setTimeout(() => openProfileModal(profileNotificationsBtn || profilePasswordBtn), 0);
}

function bindNotificationSettingsControls({ returnToProfile = false } = {}) {
  document.querySelectorAll("[data-notification-setting]").forEach((input) => {
    input.addEventListener("change", () => {
      const label = input.closest(".notification-settings-switch")?.querySelector("em");
      if (label) label.textContent = input.checked ? "ON" : "OFF";
      setNotificationSettingsSavedState(false);
    });
  });
}

function setNotificationSettingsSavedState(isSaved) {
  const confirmButton = Swal.getConfirmButton();
  const status = document.querySelector(".notification-settings-status");

  if (confirmButton) {
    confirmButton.classList.toggle("is-saved", isSaved);
    confirmButton.innerHTML = isSaved
      ? '<i class="fa-solid fa-check"></i><span>Changes Saved</span>'
      : '<i class="fa-regular fa-floppy-disk"></i><span>Save Changes</span>';
  }

  if (status) {
    status.textContent = isSaved ? "Notification settings saved." : "";
    status.classList.toggle("is-success", isSaved);
  }
}

async function handleNotificationSettingsConfirm() {
  const confirmButton = Swal.getConfirmButton();
  if (confirmButton) confirmButton.innerHTML = '<i class="fa-solid fa-spinner"></i><span>Saving...</span>';

  const settings = {};
  document.querySelectorAll("[data-notification-setting]").forEach((input) => {
    settings[input.dataset.notificationSetting] = input.checked;
  });

  try {
    await saveNotificationSettings(settings);
    Swal.hideLoading();
    setNotificationSettingsSavedState(true);
    return false;
  } catch (error) {
    if (confirmButton) {
      confirmButton.innerHTML = '<i class="fa-regular fa-floppy-disk"></i><span>Save Changes</span>';
    }
    Swal.showValidationMessage(error.message || "Unable to save notification settings.");
    return false;
  }
}

async function saveNotificationSettings(settings) {
  const account = await ensureCurrentAccount();
  const notificationSettings = normalizeNotificationSettings(settings);
  const notificationPreference = getNotificationPreferenceSummary(notificationSettings);

  const response = await fetch(`${API_BASE_URL}/auth/account/profile`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fullName: account.fullName || getUserSession()?.fullName || "User",
      phone: account.phone || "",
      profilePhotoDataUrl: account.profilePhotoDataUrl || "",
      notificationSettings,
      notificationPreference
    })
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Unable to save notification settings.");
  }

  currentProfileAccount = data.account || {
    ...account,
    notificationSettings,
    notificationPreference
  };
  setNotificationSummary(currentProfileAccount);
  refreshNotificationDot();
  return currentProfileAccount;
}

async function handleProfileSave(event) {
  event.preventDefault();

  if (!profileForm?.classList.contains("is-editing") && !hasPendingProfileChanges) {
    setProfileEditing(true);
    return;
  }

  const identity = mergeAccountFallbacks(currentProfileAccount || {});
  const fullName = identity.fullName || getValue("profileFullName") || "User";

  setProfileStatus("Saving changes...");
  setProfileSaveState("saving");

  try {
    const payload = {
      fullName,
      phone: getValue("profilePhone"),
      notificationSettings: normalizeNotificationSettings(
        currentProfileAccount?.notificationSettings
      ),
      notificationPreference:
        currentProfileAccount?.notificationPreference ||
        getNotificationPreferenceSummary(currentProfileAccount?.notificationSettings),
      profilePhotoDataUrl: pendingProfilePhotoDataUrl || "",
    };

    const response = await fetch(`${API_BASE_URL}/auth/account/profile`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to save profile changes.");
    }

    const savedAccount = data.account || { ...currentProfileAccount, ...payload };
    currentProfileAccount = mergeAccountFallbacks({ ...savedAccount, ...payload });
    pendingProfilePhotoDataUrl = currentProfileAccount.profilePhotoDataUrl || "";

    try {
      currentProfileAccount = await fetchCurrentAccount();
    } catch (refreshError) {
      console.warn("[Profile refresh after save failed]", refreshError.message);
    }

    setUserSession(currentProfileAccount);
    updateHeaderProfile(
      currentProfileAccount.fullName || fullName,
      currentProfileAccount.profilePhotoDataUrl || ""
    );
    updateAuthUI();
    renderProfileModal(currentProfileAccount);
    setProfileEditing(false);
    setProfilePendingChanges(false);
    setProfileSaveState("saved");
    setProfileStatus("Changes saved successfully.", true);
  } catch (error) {
    profileForm?.classList.remove("is-saving");
    setProfileSaveState("idle");
    setProfileStatus(error.message || "Unable to save profile changes.");
    if (profileSaveBtn) profileSaveBtn.disabled = false;
  }
}

function updateHeaderProfile(fullName, photoDataUrl = "") {
  const firstName = getFirstName(fullName);
  const loggedUserName = document.getElementById("loggedUserName");
  const dropdownUserName = document.getElementById("dropdownUserName");
  const userAvatarMini = document.querySelector(".user-avatar-mini");
  const dropdownAvatar = document.querySelector(".user-dropdown-avatar");

  if (loggedUserName) loggedUserName.textContent = firstName;
  if (dropdownUserName) dropdownUserName.textContent = firstName;
  renderUserAvatar(userAvatarMini, fullName, photoDataUrl);
  renderUserAvatar(dropdownAvatar, fullName, photoDataUrl);
}

async function handleProfilePhotoChange(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
    setProfileStatus("Choose a PNG, JPG, or WebP image.");
    return;
  }

  try {
    pendingProfilePhotoDataUrl = await compressProfilePhoto(file);
    const fullName = getValue("profileFullName") || currentProfileAccount?.fullName || "User";
    setProfilePendingChanges(true);
    setProfileSaveState("idle");
    renderProfileAvatar(fullName, pendingProfilePhotoDataUrl);
    updateHeaderProfile(fullName, pendingProfilePhotoDataUrl);
    setProfileStatus("Photo preview updated. Click Save Changes to keep it.", true);
  } catch (error) {
    setProfileStatus(error.message || "Unable to read that image.");
  }
}

function compressProfilePhoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(
          1,
          PROFILE_PHOTO_MAX_SIDE / Math.max(image.width, image.height)
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        let quality = 0.78;
        let dataUrl = canvas.toDataURL("image/jpeg", quality);

        while (dataUrl.length > PROFILE_PHOTO_MAX_BYTES && quality > 0.42) {
          quality -= 0.08;
          dataUrl = canvas.toDataURL("image/jpeg", quality);
        }

        if (dataUrl.length <= PROFILE_PHOTO_MAX_BYTES) {
          resolve(dataUrl);
          return;
        }

        const smallCanvas = document.createElement("canvas");
        const smallScale = Math.min(1, 300 / Math.max(canvas.width, canvas.height));
        smallCanvas.width = Math.max(1, Math.round(canvas.width * smallScale));
        smallCanvas.height = Math.max(1, Math.round(canvas.height * smallScale));
        const smallContext = smallCanvas.getContext("2d");
        smallContext.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
        dataUrl = smallCanvas.toDataURL("image/jpeg", 0.62);

        if (dataUrl.length <= PROFILE_PHOTO_MAX_BYTES) {
          resolve(dataUrl);
          return;
        }

        reject(new Error("Please choose a smaller profile photo."));
      };
      image.onerror = () => reject(new Error("Unable to load that image."));
      image.src = reader.result;
    };

    reader.onerror = () => reject(new Error("Unable to read that image."));
    reader.readAsDataURL(file);
  });
}

async function chooseProfilePreference({ title, inputValue, options, onSave }) {
  const result = await Swal.fire({
    title,
    input: "select",
    inputOptions: options,
    inputValue,
    showCancelButton: true,
    confirmButtonText: "Apply",
    cancelButtonText: "Cancel",
    customClass: {
      popup: "animua-popup",
      confirmButton: "animua-confirm",
      cancelButton: "animua-cancel"
    },
    buttonsStyling: false
  });

  if (!result.isConfirmed) return;
  onSave(result.value);
  setProfileEditing(true);
  setProfileStatus("Preference changed. Click Save Changes to update your profile.", true);
}

async function promptPasswordUpdate() {
  await showChangePasswordDialog();
}

function escapeHtmlText(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[character]));
}

function maskProfileEmail(email = "") {
  const [name = "", domain = ""] = email.split("@");
  if (!domain) return email;

  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"*".repeat(Math.max(name.length - visible.length, 3))}@${domain}`;
}

async function readApiJson(response, fallbackMessage = "Request failed.") {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text().catch(() => "");
  const message = /^\s*</.test(text)
    ? "The password reset service is not available on this server yet. Please make sure the backend is running and updated."
    : text.trim() || fallbackMessage;

  throw new Error(message);
}

async function showChangePasswordDialog({ returnToProfile = false } = {}) {
  pendingPasswordChange = null;
  stopPasswordOtpCooldown();

  return Swal.fire({
    html: `
      <div class="change-password-modal">
        <div class="change-password-head">
          <button type="button" class="change-password-back" aria-label="Back">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <div class="change-password-title-row">
            <div class="change-password-icon" aria-hidden="true">
              <i class="fa-solid fa-lock"></i>
            </div>
            <div>
              <h2>Change Password</h2>
              <p>Update your password to keep your account secure.</p>
            </div>
          </div>
        </div>

        <div class="change-password-reminder">
          <span aria-hidden="true"><i class="fa-solid fa-shield"></i></span>
          <p><strong>Reminder:</strong> You need to verify your account with a one-time password (OTP) before you can change your password.</p>
        </div>

        <label class="change-password-field" for="oldPassword">
          <span class="change-password-field-icon" aria-hidden="true"><i class="fa-solid fa-lock"></i></span>
          <div class="change-password-field-body">
            <span>Current Password</span>
            <div class="change-password-input-wrap">
              <input id="oldPassword" type="password" placeholder="Enter your current password" autocomplete="current-password">
              <button type="button" class="change-password-eye" data-password-target="oldPassword" aria-label="Show current password">
                <i class="fa-regular fa-eye"></i>
              </button>
            </div>
          </div>
        </label>

        <label class="change-password-field" for="newPassword">
          <span class="change-password-field-icon" aria-hidden="true"><i class="fa-solid fa-lock"></i></span>
          <div class="change-password-field-body">
            <span>New Password</span>
            <div class="change-password-input-wrap">
              <input id="newPassword" type="password" placeholder="Enter your new password" autocomplete="new-password">
              <button type="button" class="change-password-eye" data-password-target="newPassword" aria-label="Show new password">
                <i class="fa-regular fa-eye"></i>
              </button>
            </div>
            <small>At least 8 characters with a number and special character.</small>
          </div>
        </label>

        <label class="change-password-field" for="confirmNewPassword">
          <span class="change-password-field-icon" aria-hidden="true"><i class="fa-solid fa-lock"></i></span>
          <div class="change-password-field-body">
            <span>Confirm New Password</span>
            <div class="change-password-input-wrap">
              <input id="confirmNewPassword" type="password" placeholder="Re-enter your new password" autocomplete="new-password">
              <button type="button" class="change-password-eye" data-password-target="confirmNewPassword" aria-label="Show confirmed password">
                <i class="fa-regular fa-eye"></i>
              </button>
            </div>
            <small>Passwords must match.</small>
          </div>
        </label>
      </div>
    `,
    showCancelButton: true,
    showCloseButton: true,
    confirmButtonText: "Send OTP",
    cancelButtonText: "Cancel",
    reverseButtons: true,
    showLoaderOnConfirm: true,
    allowOutsideClick: () => !Swal.isLoading(),
    allowEscapeKey: () => !Swal.isLoading(),
    customClass: {
      popup: "animua-popup change-password-popup",
      htmlContainer: "change-password-html",
      actions: "change-password-actions",
      confirmButton: "change-password-confirm",
      cancelButton: "change-password-cancel",
      closeButton: "change-password-close"
    },
    buttonsStyling: false,
    didOpen: () => {
      const popup = Swal.getPopup();
      if (popup) popup.dataset.returnToProfile = String(returnToProfile);
      bindChangePasswordControls({ returnToProfile });
    },
    willClose: stopPasswordOtpCooldown,
    preConfirm: handleChangePasswordConfirm
  });
}

async function showForgotPasswordDialog() {
  pendingForgotPassword = null;
  stopPasswordOtpCooldown();

  const loginEmail = document.getElementById("login-email")?.value.trim().toLowerCase() || "";
  const safeLoginEmail = escapeHtmlText(loginEmail);

  return Swal.fire({
    html: `
      <div class="change-password-modal">
        <div class="change-password-head">
          <button type="button" class="change-password-back" aria-label="Back">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <div class="change-password-title-row">
            <div class="change-password-icon" aria-hidden="true">
              <i class="fa-solid fa-key"></i>
            </div>
            <div>
              <h2>Forgot Password</h2>
              <p>Enter your account email and we will send a one-time password.</p>
            </div>
          </div>
        </div>

        <div class="change-password-reminder">
          <span aria-hidden="true"><i class="fa-solid fa-shield"></i></span>
          <p><strong>Reminder:</strong> Use the OTP sent to your email before creating a new password.</p>
        </div>

        <label class="change-password-field" for="forgotPasswordEmail">
          <span class="change-password-field-icon" aria-hidden="true"><i class="fa-solid fa-envelope"></i></span>
          <div class="change-password-field-body">
            <span>Email Address</span>
            <div class="change-password-input-wrap">
              <input id="forgotPasswordEmail" type="email" placeholder="Enter your account email" autocomplete="email" value="${safeLoginEmail}">
            </div>
          </div>
        </label>
      </div>
    `,
    showCancelButton: true,
    showCloseButton: false,
    confirmButtonText: "Send OTP",
    cancelButtonText: "Cancel",
    reverseButtons: true,
    showLoaderOnConfirm: true,
    allowOutsideClick: () => !Swal.isLoading(),
    allowEscapeKey: () => !Swal.isLoading(),
    customClass: {
      popup: "animua-popup change-password-popup forgot-password-popup",
      htmlContainer: "change-password-html",
      actions: "change-password-actions",
      confirmButton: "change-password-confirm",
      cancelButton: "change-password-cancel",
      closeButton: "change-password-close"
    },
    buttonsStyling: false,
    didOpen: () => {
      document.getElementById("forgotPasswordEmail")?.focus();
      document.querySelector(".change-password-back")?.addEventListener("click", () => Swal.close());
    },
    willClose: stopPasswordOtpCooldown,
    preConfirm: handleForgotPasswordSendOtp
  });
}

async function handleForgotPasswordSendOtp() {
  const email = document.getElementById("forgotPasswordEmail")?.value.trim().toLowerCase() || "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    Swal.showValidationMessage("Please enter a valid email address.");
    return false;
  }

  const popup = Swal.getPopup();
  popup?.classList.add("change-password-popup--loading");
  const confirmButton = Swal.getConfirmButton();
  if (confirmButton) confirmButton.textContent = "Sending OTP...";

  try {
    await requestForgotPasswordOtp(email);
    pendingForgotPassword = { email };
    showForgotPasswordOtpStep();
  } catch (error) {
    popup?.classList.remove("change-password-popup--loading");
    if (confirmButton) confirmButton.textContent = "Send OTP";
    Swal.showValidationMessage(error.message || "Failed to send password reset OTP.");
  }

  return false;
}

function showForgotPasswordOtpStep() {
  const safeMaskedEmail = escapeHtmlText(maskProfileEmail(pendingForgotPassword?.email || ""));

  Swal.close();

  return Swal.fire({
    html: `
      <div class="change-password-modal password-otp-modal">
        <button type="button" class="change-password-back password-change-otp-back" aria-label="Back">
          <i class="fa-solid fa-arrow-left"></i>
        </button>
        <div class="email-verification-screen password-change-otp-screen">
          <h2>Reset Password</h2>
          <p class="email-verification-copy">Enter the 6-digit code we sent to your email<br><strong>${safeMaskedEmail || "your email"}</strong></p>
          <input type="text" id="password-change-otp-code" class="email-verification-hidden-input" inputmode="numeric" maxlength="6" autocomplete="one-time-code" aria-label="Six-digit email OTP">
          <div class="email-verification-code-grid" id="password-change-otp-grid" aria-hidden="true">
            ${Array.from({ length: 6 }, (_, index) => `<span class="email-verification-code-box" data-otp-index="${index}"></span>`).join("")}
          </div>
          <small class="auth-error email-verification-message" id="password-change-otp-message"></small>
          <div class="email-verification-resend">
            <span class="email-verification-resend-help">Didn't receive the code?</span>
            <button type="button" class="auth-secondary-action" id="resend-password-change-otp-btn">Resend Code</button>
          </div>
          <div class="password-otp-actions">
            <button type="button" class="password-otp-cancel">Cancel</button>
            <button type="button" class="auth-submit-btn" id="confirm-password-change-otp-btn">
              <i class="fa-solid fa-shield" aria-hidden="true"></i>
              <span>Verify OTP</span>
            </button>
          </div>
          <div class="password-otp-note">
            <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
            <span>You must verify your OTP before creating a new password.</span>
          </div>
        </div>
      </div>
    `,
    showCloseButton: false,
    showConfirmButton: false,
    showCancelButton: false,
    allowOutsideClick: true,
    allowEscapeKey: true,
    customClass: {
      popup: "animua-popup change-password-popup forgot-password-popup change-password-popup--otp",
      htmlContainer: "change-password-html",
      actions: "change-password-actions",
      confirmButton: "change-password-confirm",
      cancelButton: "change-password-cancel"
    },
    buttonsStyling: false,
    didOpen: () => {
      const popup = Swal.getPopup();
      if (popup) popup.dataset.forgotPasswordOtpStep = "true";

      removePasswordOtpSwalActions();
      stylePasswordOtpActionButtons();
      setupPasswordOtpInput();
      startPasswordOtpCooldown();
      document.getElementById("confirm-password-change-otp-btn")?.addEventListener("click", handleForgotPasswordOtpConfirm);
      document.getElementById("resend-password-change-otp-btn")?.addEventListener("click", handleForgotPasswordOtpResend);
      document.querySelector(".password-otp-cancel")?.addEventListener("click", () => Swal.close());
      document.querySelector(".password-change-otp-back")?.addEventListener("click", () => {
        Swal.close();
        window.setTimeout(showForgotPasswordDialog, 0);
      });
    },
    willClose: stopPasswordOtpCooldown
  });
}

function handleForgotPasswordOtpConfirm() {
  const message = document.getElementById("password-change-otp-message");
  const otp = document.getElementById("password-change-otp-code")?.value.trim() || "";

  message?.classList.remove("is-success");

  if (!pendingForgotPassword?.email) {
    if (message) message.textContent = "Please enter your email again.";
    return;
  }

  if (!/^\d{6}$/.test(otp)) {
    if (message) message.textContent = "Please enter the six-digit email OTP.";
    return;
  }

  pendingForgotPassword.otp = otp;
  stopPasswordOtpCooldown();
  showForgotPasswordNewPasswordStep();
}

async function handleForgotPasswordOtpResend() {
  const message = document.getElementById("password-change-otp-message");
  const button = document.getElementById("resend-password-change-otp-btn");

  message?.classList.remove("is-success");

  if (!pendingForgotPassword?.email) {
    if (message) message.textContent = "Please enter your email again.";
    return;
  }

  if (passwordOtpResendRemaining > 0) return;

  button.disabled = true;

  try {
    await requestForgotPasswordOtp(pendingForgotPassword.email);
    if (message) {
      message.textContent = "We sent a new email OTP. Please check your inbox.";
      message.classList.add("is-success");
    }
    startPasswordOtpCooldown();
  } catch (error) {
    if (message) message.textContent = error.message || "Unable to resend email OTP.";
    if (error.status === 429) {
      startPasswordOtpCooldown();
    } else {
      updatePasswordOtpResendButton();
    }
  }
}

function showForgotPasswordNewPasswordStep() {
  const popup = Swal.getPopup();
  const safeMaskedEmail = escapeHtmlText(maskProfileEmail(pendingForgotPassword?.email || ""));

  setPasswordOtpSwalActionsHidden(false);

  if (popup) {
    popup.dataset.forgotPasswordNewPasswordStep = "true";
    popup.classList.remove("change-password-popup--otp", "change-password-popup--loading");
  }

  Swal.update({
    html: `
      <div class="change-password-modal">
        <div class="change-password-head">
          <button type="button" class="change-password-back" aria-label="Back">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <div class="change-password-title-row">
            <div class="change-password-icon" aria-hidden="true">
              <i class="fa-solid fa-lock"></i>
            </div>
            <div>
              <h2>New Password</h2>
              <p>Create a new password for <strong>${safeMaskedEmail || "your account"}</strong>.</p>
            </div>
          </div>
        </div>

        <label class="change-password-field" for="forgotNewPassword">
          <span class="change-password-field-icon" aria-hidden="true"><i class="fa-solid fa-lock"></i></span>
          <div class="change-password-field-body">
            <span>New Password</span>
            <div class="change-password-input-wrap">
              <input id="forgotNewPassword" type="password" placeholder="Enter your new password" autocomplete="new-password">
              <button type="button" class="change-password-eye" data-password-target="forgotNewPassword" aria-label="Show new password">
                <i class="fa-regular fa-eye"></i>
              </button>
            </div>
            <small>At least 8 characters with uppercase, lowercase, number, and special character.</small>
          </div>
        </label>

        <label class="change-password-field" for="forgotConfirmNewPassword">
          <span class="change-password-field-icon" aria-hidden="true"><i class="fa-solid fa-lock"></i></span>
          <div class="change-password-field-body">
            <span>Confirm New Password</span>
            <div class="change-password-input-wrap">
              <input id="forgotConfirmNewPassword" type="password" placeholder="Re-enter your new password" autocomplete="new-password">
              <button type="button" class="change-password-eye" data-password-target="forgotConfirmNewPassword" aria-label="Show confirmed password">
                <i class="fa-regular fa-eye"></i>
              </button>
            </div>
            <small>Passwords must match.</small>
          </div>
        </label>
      </div>
    `,
    showCancelButton: true,
    showConfirmButton: true,
    confirmButtonText: "Reset Password",
    cancelButtonText: "Cancel",
    preConfirm: handleForgotPasswordResetConfirm
  });

  bindForgotPasswordNewPasswordControls();
}

function bindForgotPasswordNewPasswordControls() {
  document.querySelector(".change-password-back")?.addEventListener("click", () => showForgotPasswordOtpStep());
  document.querySelectorAll(".change-password-eye").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.passwordTarget);
      if (!input) return;

      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      button.setAttribute("aria-label", `${isHidden ? "Hide" : "Show"} password`);
      button.innerHTML = `<i class="fa-regular ${isHidden ? "fa-eye-slash" : "fa-eye"}"></i>`;
    });
  });
}

async function handleForgotPasswordResetConfirm() {
  if (!pendingForgotPassword?.email || !pendingForgotPassword?.otp) {
    Swal.showValidationMessage("Please verify your email OTP again.");
    return false;
  }

  const passwords = validateForgotPasswordForm();
  if (!passwords) return false;

  const popup = Swal.getPopup();
  popup?.classList.add("change-password-popup--loading");
  const confirmButton = Swal.getConfirmButton();
  if (confirmButton) confirmButton.textContent = "Resetting...";

  try {
    await confirmForgotPasswordOtp(
      pendingForgotPassword.email,
      pendingForgotPassword.otp,
      passwords.newPassword
    );
    pendingForgotPassword = null;
    showForgotPasswordSuccess();
  } catch (error) {
    popup?.classList.remove("change-password-popup--loading");
    if (confirmButton) confirmButton.textContent = "Reset Password";
    Swal.showValidationMessage(error.message || "Failed to reset password.");
  }

  return false;
}

async function handleChangePasswordConfirm() {
  const popup = Swal.getPopup();

  if (popup?.dataset.passwordUpdated === "true") {
    return true;
  }

  const passwords = validateChangePasswordForm();
  if (!passwords) return false;

  popup?.classList.add("change-password-popup--loading");
  const confirmButton = Swal.getConfirmButton();
  if (confirmButton) confirmButton.textContent = "Sending OTP...";

  try {
    await requestPasswordChangeOtp(passwords.oldPassword, passwords.newPassword);
    pendingPasswordChange = {
      ...passwords,
      returnToProfile: popup?.dataset.returnToProfile === "true"
    };
    showPasswordOtpStep();
  } catch (error) {
    popup?.classList.remove("change-password-popup--loading");
    if (confirmButton) confirmButton.textContent = "Send OTP";
    Swal.showValidationMessage(error.message || "Failed to send password OTP.");
  }

  return false;
}

function showPasswordOtpStep() {
  const popup = Swal.getPopup();
  const email = currentProfileAccount?.email || getUserSession()?.email || "";
  const safeMaskedEmail = escapeHtmlText(maskProfileEmail(email));

  Swal.hideLoading();

  if (popup) {
    popup.dataset.passwordOtpStep = "true";
    popup.classList.add("change-password-popup--otp");
    popup.classList.remove("change-password-popup--loading");
  }

  Swal.update({
    html: `
      <div class="change-password-modal password-otp-modal">
        <button type="button" class="change-password-back password-change-otp-back" aria-label="Back">
          <i class="fa-solid fa-arrow-left"></i>
        </button>
        <div class="email-verification-screen password-change-otp-screen">
          <h2>Verify Your Account</h2>
          <p class="email-verification-copy">Enter the 6-digit code we sent to your email<br><strong>${safeMaskedEmail || "your email"}</strong></p>
          <input type="text" id="password-change-otp-code" class="email-verification-hidden-input" inputmode="numeric" maxlength="6" autocomplete="one-time-code" aria-label="Six-digit email OTP">
          <div class="email-verification-code-grid" id="password-change-otp-grid" aria-hidden="true">
            ${Array.from({ length: 6 }, (_, index) => `<span class="email-verification-code-box" data-otp-index="${index}"></span>`).join("")}
          </div>
          <small class="auth-error email-verification-message" id="password-change-otp-message"></small>
          <div class="email-verification-resend">
            <span class="email-verification-resend-help">Didn't receive the code?</span>
            <button type="button" class="auth-secondary-action" id="resend-password-change-otp-btn">Resend Code</button>
          </div>
          <div class="password-otp-actions">
            <button type="button" class="password-otp-cancel">Cancel</button>
            <button type="button" class="auth-submit-btn" id="confirm-password-change-otp-btn">
              <i class="fa-solid fa-shield" aria-hidden="true"></i>
              <span>Verify OTP</span>
            </button>
          </div>
          <div class="password-otp-note">
            <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
            <span>You must verify your account with OTP before changing your password.</span>
          </div>
        </div>
      </div>
    `,
    confirmButtonText: "Verify OTP",
    showConfirmButton: false,
    showCancelButton: false
  });

  setPasswordOtpSwalActionsHidden(true);
  setupPasswordOtpInput();
  startPasswordOtpCooldown();
  document.getElementById("confirm-password-change-otp-btn")?.addEventListener("click", handlePasswordOtpConfirm);
  document.getElementById("resend-password-change-otp-btn")?.addEventListener("click", handlePasswordOtpResend);
  document.querySelector(".password-otp-cancel")?.addEventListener("click", () => Swal.close());
  document.querySelector(".password-change-otp-back")?.addEventListener("click", () => {
    const returnToProfile = Boolean(pendingPasswordChange?.returnToProfile);
    Swal.close();
    window.setTimeout(() => showChangePasswordDialog({ returnToProfile }), 0);
  });
}

function setupPasswordOtpInput() {
  const input = document.getElementById("password-change-otp-code");
  const boxes = Array.from(document.querySelectorAll(".password-change-otp-screen .email-verification-code-box"));
  if (!input || !boxes.length) return;

  const syncBoxes = () => {
    const digits = input.value.replace(/\D/g, "").slice(0, 6);
    if (input.value !== digits) input.value = digits;

    boxes.forEach((box, index) => {
      box.textContent = digits[index] || "";
      box.classList.toggle("filled", index < digits.length);
      box.classList.toggle("active", index === digits.length && digits.length < boxes.length);
    });

    if (digits.length === boxes.length) {
      boxes[boxes.length - 1].classList.add("active");
    }
  };

  boxes.forEach((box) => {
    box.addEventListener("click", () => input.focus());
  });

  input.addEventListener("input", syncBoxes);
  input.addEventListener("paste", () => window.setTimeout(syncBoxes, 0));
  input.addEventListener("focus", syncBoxes);
  input.addEventListener("blur", () => boxes.forEach((box) => box.classList.remove("active")));

  input.focus();
  syncBoxes();
}

function setPasswordOtpSwalActionsHidden(hidden) {
  const displayValue = hidden ? "none" : "";
  const applyDisplay = () => {
    const actions = Swal.getActions();
    const confirmButton = Swal.getConfirmButton();
    const cancelButton = Swal.getCancelButton();

    if (actions) actions.style.display = displayValue;
    if (confirmButton) confirmButton.style.display = displayValue;
    if (cancelButton) cancelButton.style.display = displayValue;
  };

  applyDisplay();
  window.requestAnimationFrame(applyDisplay);
}

function removePasswordOtpSwalActions() {
  const removeActions = () => {
    const popup = Swal.getPopup();
    popup?.querySelectorAll(".swal2-actions").forEach((actions) => actions.remove());
  };

  removeActions();
  window.requestAnimationFrame(removeActions);
  window.setTimeout(removeActions, 50);
}

function stylePasswordOtpActionButtons() {
  document.querySelectorAll(".password-change-otp-screen .password-otp-cancel, .password-change-otp-screen #confirm-password-change-otp-btn")
    .forEach((button) => {
      button.style.borderRadius = "8px";
    });
}

async function handlePasswordOtpConfirm() {
  const message = document.getElementById("password-change-otp-message");
  const button = document.getElementById("confirm-password-change-otp-btn");
  const otp = document.getElementById("password-change-otp-code")?.value.trim() || "";

  message?.classList.remove("is-success");

  if (!pendingPasswordChange) {
    if (message) message.textContent = "Please enter your password details again.";
    return;
  }

  if (!/^\d{6}$/.test(otp)) {
    if (message) message.textContent = "Please enter the six-digit email OTP.";
    return;
  }

  setPasswordOtpButtonLoading(button, true, "Verifying...");

  try {
    await confirmPasswordChangeOtp(
      pendingPasswordChange.oldPassword,
      pendingPasswordChange.newPassword,
      otp
    );
    pendingPasswordChange = null;
    stopPasswordOtpCooldown();
    showChangePasswordSuccess();
  } catch (error) {
    if (message) message.textContent = error.message || "Incorrect email OTP. Please try again.";
  } finally {
    setPasswordOtpButtonLoading(button, false);
  }
}

function setPasswordOtpButtonLoading(button, isLoading, loadingText = "Please wait...") {
  if (!button) return;

  if (isLoading) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.innerHTML = `<span>${loadingText}</span>`;
    return;
  }

  button.disabled = false;
  button.removeAttribute("aria-busy");
  if (button.dataset.originalHtml) {
    button.innerHTML = button.dataset.originalHtml;
    delete button.dataset.originalHtml;
  }
}

async function handlePasswordOtpResend() {
  const message = document.getElementById("password-change-otp-message");
  const button = document.getElementById("resend-password-change-otp-btn");

  message?.classList.remove("is-success");

  if (!pendingPasswordChange) {
    if (message) message.textContent = "Please enter your password details again.";
    return;
  }

  if (passwordOtpResendRemaining > 0) return;

  button.disabled = true;

  try {
    await requestPasswordChangeOtp(
      pendingPasswordChange.oldPassword,
      pendingPasswordChange.newPassword
    );
    if (message) {
      message.textContent = "We sent a new email OTP. Please check your inbox.";
      message.classList.add("is-success");
    }
    startPasswordOtpCooldown();
  } catch (error) {
    if (message) message.textContent = error.message || "Unable to resend email OTP.";
    if (error.status === 429) {
      startPasswordOtpCooldown();
    } else {
      updatePasswordOtpResendButton();
    }
  }
}

function startPasswordOtpCooldown() {
  stopPasswordOtpCooldown();
  passwordOtpResendRemaining = PASSWORD_OTP_RESEND_SECONDS;
  updatePasswordOtpResendButton();
  passwordOtpResendTimer = window.setInterval(() => {
    passwordOtpResendRemaining -= 1;
    updatePasswordOtpResendButton();

    if (passwordOtpResendRemaining <= 0) {
      stopPasswordOtpCooldown();
      updatePasswordOtpResendButton();
    }
  }, 1000);
}

function stopPasswordOtpCooldown() {
  if (passwordOtpResendTimer) {
    window.clearInterval(passwordOtpResendTimer);
  }

  passwordOtpResendTimer = null;
  passwordOtpResendRemaining = 0;
}

function updatePasswordOtpResendButton() {
  const button = document.getElementById("resend-password-change-otp-btn");
  const countdown = document.getElementById("password-change-otp-countdown");
  if (!button) return;

  if (passwordOtpResendRemaining > 0) {
    button.disabled = true;
    button.textContent = `Resend OTP (${passwordOtpResendRemaining})`;
    if (countdown) countdown.textContent = "Resend in";
    return;
  }

  button.disabled = false;
  button.textContent = "Resend OTP";
  if (countdown) countdown.textContent = "";
}

function formatPasswordOtpResendTime(seconds = 0) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function showChangePasswordSuccess() {
  const popup = Swal.getPopup();
  Swal.hideLoading();
  setPasswordOtpSwalActionsHidden(false);

  if (popup) {
    popup.dataset.passwordUpdated = "true";
    popup.classList.remove("change-password-popup--loading");
    popup.classList.add("change-password-popup--success");
  }

  Swal.update({
    html: `
      <div class="change-password-modal change-password-success">
        <div class="change-password-icon change-password-success-icon" aria-hidden="true">
          <i class="fa-solid fa-check"></i>
        </div>
        <span class="change-password-accent" aria-hidden="true"></span>
        <h2>Password Updated</h2>
        <p>Your password has been changed.</p>
      </div>
    `,
    showCancelButton: false,
    showConfirmButton: true,
    confirmButtonText: "OK"
  });
}

function showForgotPasswordSuccess() {
  const popup = Swal.getPopup();
  Swal.hideLoading();
  setPasswordOtpSwalActionsHidden(false);

  if (popup) {
    popup.dataset.passwordUpdated = "true";
    popup.classList.remove("change-password-popup--loading");
    popup.classList.add("change-password-popup--success");
  }

  Swal.update({
    html: `
      <div class="change-password-modal change-password-success">
        <div class="change-password-icon change-password-success-icon" aria-hidden="true">
          <i class="fa-solid fa-check"></i>
        </div>
        <span class="change-password-accent" aria-hidden="true"></span>
        <h2>Password Reset</h2>
        <p>Your password has been changed. You can log in with your new password.</p>
      </div>
    `,
    showCancelButton: false,
    showConfirmButton: true,
    confirmButtonText: "OK"
  });
}

function bindChangePasswordControls({ returnToProfile = false } = {}) {
  document.querySelector(".change-password-back")?.addEventListener("click", () => {
    if (returnToProfile) {
      returnToProfileFromSwal();
      return;
    }

    Swal.close();
  });

  document.querySelectorAll(".change-password-eye").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.passwordTarget);
      if (!input) return;

      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      button.setAttribute("aria-label", `${isHidden ? "Hide" : "Show"} password`);
      button.innerHTML = `<i class="fa-regular ${isHidden ? "fa-eye-slash" : "fa-eye"}"></i>`;
    });
  });
}

function validateChangePasswordForm() {
  const oldPassword = document.getElementById("oldPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmNewPassword = document.getElementById("confirmNewPassword").value;

  if (!oldPassword || !newPassword || !confirmNewPassword) {
    Swal.showValidationMessage("Please fill in all password fields.");
    return false;
  }

  if (oldPassword === newPassword) {
    Swal.showValidationMessage("New password must be different from your current password.");
    return false;
  }

  if (newPassword.length < 8) {
    Swal.showValidationMessage("New password must be at least 8 characters.");
    return false;
  }

  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(newPassword)) {
    Swal.showValidationMessage("New password must include uppercase, lowercase, number, and special character.");
    return false;
  }

  if (newPassword !== confirmNewPassword) {
    Swal.showValidationMessage("New password confirmation does not match.");
    return false;
  }

  return { oldPassword, newPassword };
}

function validateForgotPasswordForm() {
  const newPassword = document.getElementById("forgotNewPassword")?.value || "";
  const confirmNewPassword = document.getElementById("forgotConfirmNewPassword")?.value || "";

  if (!newPassword || !confirmNewPassword) {
    Swal.showValidationMessage("Please fill in all password fields.");
    return false;
  }

  if (newPassword.length < 8) {
    Swal.showValidationMessage("New password must be at least 8 characters.");
    return false;
  }

  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(newPassword)) {
    Swal.showValidationMessage("New password must include uppercase, lowercase, number, and special character.");
    return false;
  }

  if (newPassword !== confirmNewPassword) {
    Swal.showValidationMessage("New password confirmation does not match.");
    return false;
  }

  return { newPassword };
}

function setupProfileModal() {
  ensureAccountProfileModal();

  profileCloseButtons.forEach((button) => {
    button.addEventListener("click", closeProfileModal);
  });

  profileEditBtn?.addEventListener("click", () => {
    setProfileEditing(true);
    setProfileStatus("Edit your details, then click Save Changes.");
  });

  profileForm?.addEventListener("submit", handleProfileSave);
  document.getElementById("profilePhone")?.addEventListener("input", () => {
    if (!profileForm?.classList.contains("is-editing")) return;
    setProfilePendingChanges(true);
    setProfileSaveState("idle");
    setProfileStatus("");
  });
  profileChangePhotoBtn?.addEventListener("click", () => {
    profilePhotoInput?.click();
  });
  profileAvatarPhotoBtn?.addEventListener("click", () => {
    profilePhotoInput?.click();
  });
  profilePhotoInput?.addEventListener("change", handleProfilePhotoChange);

  profilePasswordBtn?.addEventListener("click", () => {
    closeProfileModal();
    showChangePasswordDialog({ returnToProfile: true });
  });

  profileNotificationsBtn?.addEventListener("click", () => {
    showNotificationSettingsDialog({ returnToProfile: true });
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      profileModal &&
      !profileModal.classList.contains("hidden")
    ) {
      closeProfileModal();
    }
  });

  setProfileEditing(false);
}

function setupProcessLucideIcons() {
  const iconPaths = {
    search: `
      <circle cx="11" cy="11" r="8"></circle>
      <path d="m21 21-4.3-4.3"></path>
    `,
    "paw-print": `
      <circle cx="11" cy="4" r="2"></circle>
      <circle cx="18" cy="8" r="2"></circle>
      <circle cx="20" cy="16" r="2"></circle>
      <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.05 3.5 3.5 0 0 0-2.32-2.1A3.5 3.5 0 0 1 2 14.03V14a4 4 0 0 1 4-4Z"></path>
    `,
    "clipboard-check": `
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
      <path d="m9 14 2 2 4-4"></path>
    `,
    "file-pen-line": `
      <path d="m18 5-2.414-2.414A2 2 0 0 0 14.172 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2"></path>
      <path d="M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"></path>
      <path d="M8 18h1"></path>
    `,
    "shield-check": `
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z"></path>
      <path d="m9 12 2 2 4-4"></path>
    `
  };

  document.querySelectorAll(".how-animua-process [data-lucide]").forEach((icon) => {
    const iconName = icon.dataset.lucide;
    const paths = iconPaths[iconName];
    if (!paths) return;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("data-lucide", iconName);
    svg.className.baseVal = icon.className;
    svg.innerHTML = paths;
    icon.replaceWith(svg);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  clearUserSession();
  try {
    await ensureUserSession();
  } catch (error) {
    console.warn("Unable to restore the public session:", error.message);
  }
  setupProfileModal();
  setupProcessLucideIcons();
  setupAccountActions();
  setupPasswordToggles();
  setupDateInputs();
  setupPasswordStrengthMeter();
  setupUserDropdown();
  setupHomeStories();
  setupFeaturedFurbabies();
  setupAboutPhotoLightbox();
  setupRevealAnimations();
  updateAuthUI();
  refreshNotificationDot();
  showWelcomeToastIfNeeded();

  if (loginSection && registerSection) {
    showLoginView();
  }

  if (window.location.pathname.includes("login.html") && authModal && !hasUserSession()) {
    openAuthModal();
  }

  if (window.location.hash === "#login" && authModal && !hasUserSession()) {
    showLoginView();
    openAuthModal();
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  } else if (window.location.hash === "#login") {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  const shouldOpenQuizIntro =
    new URLSearchParams(window.location.search).get("quizIntro") === "open" ||
    window.location.hash === "#quiz-match-info";

  if (shouldOpenQuizIntro && quizIntroModal) {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    openQuizIntroModal();
    clearQuizIntroUrlState();
  }

  const shouldOpenAuthModal = sessionStorage.getItem("animua_open_auth_modal") === "true";
  if (shouldOpenAuthModal && !hasUserSession()) {
    showLoginView();
    openAuthModal();
    sessionStorage.removeItem("animua_open_auth_modal");
  } else if (shouldOpenAuthModal) {
    sessionStorage.removeItem("animua_open_auth_modal");
  }

});

function setupAccountActions() {
  const changeUsernameBtn = document.getElementById("changeUsernameBtn");
  const changePasswordBtn = document.getElementById("changePasswordBtn");

  if (changeUsernameBtn && !changeUsernameBtn.dataset.bound) {
    changeUsernameBtn.dataset.bound = "true";

    changeUsernameBtn.addEventListener("click", async () => {
      const currentName = getUserSession()?.fullName || "";

      const result = await Swal.fire({
        title: "Change Username",
        input: "text",
        inputValue: currentName,
        inputPlaceholder: "Enter new username",
        showCancelButton: true,
        confirmButtonText: "Update",
        cancelButtonText: "Cancel",
        customClass: {
          popup: "animua-popup",
          confirmButton: "animua-confirm",
          cancelButton: "animua-cancel"
        },
        buttonsStyling: false,
        preConfirm: (value) => {
          if (!value || value.trim().length < 2) {
            Swal.showValidationMessage("Username must be at least 2 characters.");
            return false;
          }
          return value.trim();
        }
      });

      if (!result.isConfirmed) return;

      await updateUsername(result.value);
    });
  }

  if (changePasswordBtn && !changePasswordBtn.dataset.bound) {
    changePasswordBtn.dataset.bound = "true";

    changePasswordBtn.addEventListener("click", async () => {
      await showChangePasswordDialog();
    });
  }
}

async function updateUsername(newName) {
  const response = await fetch(`${API_BASE_URL}/auth/update-username`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fullName: newName })
  });

  const data = await response.json();

  if (!response.ok) {
    Swal.fire({
      icon: "error",
      title: "Update Failed",
      text: data.message || "Failed to update username.",
      customClass: {
        popup: "animua-popup",
        confirmButton: "animua-confirm"
      },
      buttonsStyling: false
    });
    return;
  }

  const updatedName = data.fullName || newName;
  setUserSession({ ...(getUserSession() || {}), fullName: updatedName });

  const loggedUserName = document.getElementById("loggedUserName");
  const dropdownUserName = document.getElementById("dropdownUserName");

  if (loggedUserName) loggedUserName.textContent = getFirstName(data.fullName || newName);
  if (dropdownUserName) dropdownUserName.textContent = getFirstName(data.fullName || newName);

  const userAvatarMini = document.querySelector(".user-avatar-mini");
  if (userAvatarMini) userAvatarMini.textContent = getInitial(data.fullName || newName);

  renderUserAvatar(
    document.querySelector(".user-dropdown-avatar"),
    data.fullName || newName,
    getUserSession()?.profilePhotoDataUrl || ""
  );

  Swal.fire({
    icon: "success",
    title: "Username Updated",
    text: "Your username has been updated.",
    customClass: {
      popup: "animua-popup",
      confirmButton: "animua-confirm"
    },
    buttonsStyling: false
  });
}

async function changePasswordRequest(oldPassword, newPassword) {
  if (!hasUserSession()) {
    throw new Error("Please log in before changing your password.");
  }

  const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ oldPassword, newPassword })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to update password.");
  }

  return data;
}

async function requestPasswordChangeOtp(oldPassword, newPassword) {
  if (!hasUserSession()) {
    throw new Error("Please log in before changing your password.");
  }

  const response = await fetch(`${API_BASE_URL}/auth/request-password-change-otp`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ oldPassword, newPassword })
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || "Unable to send password OTP.");
    error.status = response.status;
    throw error;
  }

  return data;
}

async function confirmPasswordChangeOtp(oldPassword, newPassword, otp) {
  if (!hasUserSession()) {
    throw new Error("Please log in before changing your password.");
  }

  const response = await fetch(`${API_BASE_URL}/auth/confirm-password-change-otp`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ oldPassword, newPassword, otp })
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || "Failed to update password.");
    error.status = response.status;
    throw error;
  }

  return data;
}

async function requestForgotPasswordOtp(email) {
  const response = await fetch(`${API_BASE_URL}/auth/request-forgot-password-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email })
  });

  const data = await readApiJson(response, "Unable to send password reset OTP.");

  if (!response.ok) {
    const error = new Error(data.message || "Unable to send password reset OTP.");
    error.status = response.status;
    throw error;
  }

  return data;
}

async function confirmForgotPasswordOtp(email, otp, newPassword) {
  const response = await fetch(`${API_BASE_URL}/auth/confirm-forgot-password-otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, otp, newPassword })
  });

  const data = await readApiJson(response, "Failed to reset password.");

  if (!response.ok) {
    const error = new Error(data.message || "Failed to reset password.");
    error.status = response.status;
    throw error;
  }

  return data;
}

async function updatePassword(oldPassword, newPassword) {
  try {
    await changePasswordRequest(oldPassword, newPassword);

    Swal.fire({
      icon: "success",
      title: "Password Updated",
      text: "Your password has been changed.",
      customClass: {
        popup: "animua-popup",
        confirmButton: "animua-confirm"
      },
      buttonsStyling: false
    });
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Update Failed",
      text: error.message || "Failed to update password.",
      customClass: {
        popup: "animua-popup",
        confirmButton: "animua-confirm"
      },
      buttonsStyling: false
    });
  }
}

function initChatbotWidget() {
  if (document.getElementById("animuaChatbot")) return;

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <section class="animua-chatbot" id="animuaChatbot" aria-live="polite">
        <button type="button" class="animua-chatbot-toggle" id="chatbotToggle" aria-label="Open ANIMUA chat assistant" aria-expanded="false" title="Need help finding a match?" data-tooltip="Need help finding a match?">
          <i class="fa-solid fa-comments"></i>
          <span class="chatbot-launcher-text">Need help finding a match?</span>
        </button>
        <span class="animua-chatbot-nudge" aria-hidden="true">Need help choosing a furbaby?</span>

        <div class="chatbot-panel hidden" id="chatbotPanel" role="dialog" aria-modal="false" aria-labelledby="chatbotTitle">
          <div class="chatbot-head">
            <div class="chatbot-brand-badge" aria-hidden="true">
              <span><i class="fa-solid fa-paw"></i></span>
            </div>
            <div class="chatbot-head-copy">
              <div class="chatbot-title-line" id="chatbotTitle">
                <strong>ANIMUA</strong>
                <span>Assistant</span>
              </div>
              <p id="chatbotSubtitle">Your companion for adoption and shelter services.</p>
            </div>
            <div class="chatbot-language-menu">
              <button type="button" class="chatbot-language-select" id="chatbotLanguageToggle" aria-label="Choose chatbot language" aria-expanded="false">
                <i class="fa-solid fa-globe" aria-hidden="true"></i>
                <span id="chatbotLanguageLabel">English</span>
                <i class="fa-solid fa-caret-down" aria-hidden="true"></i>
              </button>
              <div class="chatbot-language-options hidden" id="chatbotLanguageOptions" role="menu">
                <button type="button" data-chatbot-language-option="english" class="is-active" role="menuitem">English</button>
                <button type="button" data-chatbot-language-option="tagalog" role="menuitem">Tagalog</button>
              </div>
            </div>
            <button type="button" class="chatbot-close" id="chatbotClose" aria-label="Close chat assistant">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="chatbot-messages" id="chatbotMessages">
            <div class="chatbot-message-row bot">
              <div class="chatbot-bot-avatar" aria-hidden="true">
                <i class="fa-solid fa-dog"></i>
              </div>
              <div class="chatbot-message bot">
                <p id="chatbotGreeting">Hello! I can help with adoption, surrender requests, matching, events, and account support.</p>
              </div>
            </div>
            <div class="chatbot-message user chatbot-suggestions-row">
                <button type="button" class="chatbot-suggestions-toggle" id="chatbotSuggestionsToggle">
                  Generate questions
                </button>
            </div>
          </div>

          <div class="chatbot-quick-actions" id="chatbotQuickActions" aria-label="Chatbot quick topics">
            <button type="button" data-chatbot-prompt="Find a Pet">🐾 Find a Pet</button>
            <button type="button" data-chatbot-prompt="Adoption Guide">❤️ Adoption Guide</button>
            <button type="button" data-chatbot-prompt="Compatibility Quiz">🧩 Compatibility Quiz</button>
            <button type="button" data-chatbot-prompt="Surrender Request">📤 Surrender Request</button>
            <button type="button" data-chatbot-prompt="Upcoming Events">📅 Upcoming Events</button>
            <button type="button" data-chatbot-prompt="Account Help">👤 Account Help</button>
          </div>

          <form class="chatbot-form" id="chatbotForm">
            <label class="chatbot-search-field" for="chatbotInput">
              <input type="text" id="chatbotInput" placeholder="Ask about adoption or services..." autocomplete="off" maxlength="700" aria-label="Message ANIMUA Assistant">
              <button type="submit" class="chatbot-input-send" id="chatbotSend" aria-label="Send message">
                <i class="fa-solid fa-paper-plane"></i>
              </button>
            </label>
          </form>
        </div>
      </section>
    `
  );

  const toggle = document.getElementById("chatbotToggle");
  const widget = document.getElementById("animuaChatbot");
  const panel = document.getElementById("chatbotPanel");
  const close = document.getElementById("chatbotClose");
  const form = document.getElementById("chatbotForm");
  const input = document.getElementById("chatbotInput");
  const messages = document.getElementById("chatbotMessages");
  const sendButton = document.getElementById("chatbotSend");
  const languageToggle = document.getElementById("chatbotLanguageToggle");
  const languageOptions = document.getElementById("chatbotLanguageOptions");
  const languageLabel = document.getElementById("chatbotLanguageLabel");
  const greeting = document.getElementById("chatbotGreeting");
  const subtitle = document.getElementById("chatbotSubtitle");
  const quickActions = document.getElementById("chatbotQuickActions");
  const suggestionsToggle = document.getElementById("chatbotSuggestionsToggle");
  const history = [];
  let selectedLanguage = "english";

  renderChatbotQuickActions(quickActions, selectedLanguage);
  if (form && quickActions) {
    messages?.appendChild(quickActions);
    quickActions.classList.add("is-hidden");
  }
  updateChatbotInputPlaceholder(input, selectedLanguage);

  const openChat = () => {
    panel?.classList.remove("hidden");
    widget?.classList.add("is-open");
    toggle?.setAttribute("aria-expanded", "true");
    window.setTimeout(() => input?.focus(), 80);
  };

  const closeChat = () => {
    panel?.classList.add("hidden");
    widget?.classList.remove("is-open");
    toggle?.setAttribute("aria-expanded", "false");
    toggle?.focus();
  };

  toggle?.addEventListener("click", () => {
    if (panel?.classList.contains("hidden")) {
      openChat();
    } else {
      closeChat();
    }
  });

  close?.addEventListener("click", closeChat);
  languageToggle?.addEventListener("click", () => {
    const isOpen = !languageOptions?.classList.contains("hidden");
    languageOptions?.classList.toggle("hidden", isOpen);
    languageToggle.setAttribute("aria-expanded", String(!isOpen));
  });

  languageOptions?.addEventListener("click", (event) => {
    const option = event.target.closest("[data-chatbot-language-option]");
    if (!option) return;

    selectedLanguage = option.dataset.chatbotLanguageOption || "english";
    if (languageLabel) languageLabel.textContent = selectedLanguage === "tagalog" ? "Tagalog" : "English";
    updateChatbotGreeting(greeting, selectedLanguage);
    updateChatbotSubtitle(subtitle, selectedLanguage);
    updateChatbotInputPlaceholder(input, selectedLanguage);
    updateChatbotSuggestionsToggle(suggestionsToggle, selectedLanguage);
    renderChatbotQuickActions(quickActions, selectedLanguage);
    languageOptions.querySelectorAll("[data-chatbot-language-option]").forEach((button) => {
      button.classList.toggle("is-active", button === option);
    });
    languageOptions.classList.add("hidden");
    languageToggle?.setAttribute("aria-expanded", "false");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panel && !panel.classList.contains("hidden")) {
      if (languageOptions && !languageOptions.classList.contains("hidden")) {
        languageOptions.classList.add("hidden");
        languageToggle?.setAttribute("aria-expanded", "false");
      } else {
        closeChat();
      }
    }
  });

  document.addEventListener("click", (event) => {
    if (!languageOptions || languageOptions.classList.contains("hidden")) return;
    if (event.target.closest(".chatbot-language-menu")) return;
    languageOptions.classList.add("hidden");
    languageToggle?.setAttribute("aria-expanded", "false");
  });

  quickActions?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-chatbot-prompt]");
    if (!button || !input || !form) return;

    input.value = button.dataset.chatbotPrompt || button.textContent.trim();
    quickActions.classList.add("is-hidden");
    input.focus();
    form.requestSubmit();
  });

  suggestionsToggle?.addEventListener("click", () => {
    quickActions?.classList.remove("is-hidden");
    suggestionsToggle.hidden = true;
    if (messages) messages.scrollTop = messages.scrollHeight;
  });

  form?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-chatbot-prompt]");
    if (!button || button.closest("#chatbotQuickActions") || !input || !form) return;

    input.value = button.dataset.chatbotPrompt || button.textContent.trim();
    input.focus();
    form.requestSubmit();
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input?.value.trim() || "";
    if (!message) return;

    if (suggestionsToggle) {
      suggestionsToggle.hidden = true;
    }
    quickActions?.classList.add("is-hidden");
    appendChatMessage(messages, "user", message);
    history.push({ role: "user", content: message });
    input.value = "";
    setChatbotLoading(sendButton, true);
    const typing = appendChatMessage(messages, "bot", "Typing...");
    typing?.classList.add("is-typing");
    const typingStartedAt = Date.now();
    const waitForTypingPause = () => new Promise((resolve) => {
      const elapsed = Date.now() - typingStartedAt;
      window.setTimeout(resolve, Math.max(0, CHATBOT_MIN_TYPING_MS - elapsed));
    });

    try {
      const response = await fetch(`${API_BASE_URL}/chatbot/message`, {
        method: "POST",
        credentials: "include",
        headers: getChatbotRequestHeaders(),
        body: JSON.stringify({
          message,
          language: selectedLanguage,
          history: history.slice(-8)
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Unable to reach ANIMUA Assistant.");
      }

      await waitForTypingPause();
      typing?.remove();
      const reply = data.reply || "I could not answer that yet. Please try asking another way.";
      appendChatMessage(messages, "bot", reply);
      history.push({ role: "assistant", content: reply });
    } catch (error) {
      await waitForTypingPause();
      typing?.remove();
      const fallbackMessage = error instanceof TypeError && error.message === "Failed to fetch"
        ? "ANIMUA Assistant cannot connect to the server right now. Please make sure the backend is running, then try again."
        : error.message || "Chat is unavailable right now. Please try again later.";
      appendChatMessage(messages, "bot", fallbackMessage);
    } finally {
      setChatbotLoading(sendButton, false);
      trimChatHistory(history);
      input?.focus();
    }
  });
}

function getChatbotRequestHeaders() {
  return { "Content-Type": "application/json" };
}

function appendChatMessage(container, type, text) {
  if (!container) return null;

  const item = document.createElement("div");
  item.className = `chatbot-message ${type}`;

  const paragraph = document.createElement("p");
  paragraph.textContent = type === "bot" ? cleanChatbotReplyText(text) : text;
  item.appendChild(paragraph);

  if (type === "bot") {
    const row = document.createElement("div");
    row.className = "chatbot-message-row bot";

    const avatar = document.createElement("div");
    avatar.className = "chatbot-bot-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.innerHTML = '<i class="fa-solid fa-dog"></i>';

    row.append(avatar, item);
    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
    return row;
  } else {
    container.appendChild(item);
  }

  container.scrollTop = container.scrollHeight;
  return item;
}

function cleanChatbotReplyText(value = "") {
  return String(value)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function renderChatbotQuickActions(container, language = "english") {
  if (!container) return;

  const actions = language === "tagalog"
    ? [
        { prompt: "Paano ako mag-aadopt ng pet?", icon: "fa-heart", label: "Adoption" },
        { prompt: "Ipakita ang furbabies na ready for adoption", icon: "fa-paw", label: "Find Furbabies" },
        { prompt: "Paano gumagana ang compatibility matching?", icon: "fa-puzzle-piece", label: "Match Quiz" },
        { prompt: "Paano ako magsusumite ng surrender request?", icon: "fa-hand-holding-heart", label: "Surrender" },
        { prompt: "May upcoming events ba?", icon: "fa-calendar", label: "Upcoming Events", regular: true },
        { prompt: "Tulungan ako sa account o email OTP", icon: "fa-circle-question", label: "Account Help" }
      ]
    : [
        { prompt: "How can I adopt a pet?", icon: "fa-heart", label: "Adoption" },
        { prompt: "Show animals ready for adoption", icon: "fa-paw", label: "Find Furbabies" },
        { prompt: "How does compatibility matching work?", icon: "fa-puzzle-piece", label: "Match Quiz" },
        { prompt: "How do I submit a surrender request?", icon: "fa-hand-holding-heart", label: "Surrender" },
        { prompt: "What upcoming events are available?", icon: "fa-calendar", label: "Upcoming Events", regular: true },
        { prompt: "Help me with my account or email OTP", icon: "fa-circle-question", label: "Account Help" }
      ];

  container.innerHTML = "";

  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.chatbotPrompt = action.prompt;

    const icon = document.createElement("i");
    icon.className = `${action.regular ? "fa-regular" : "fa-solid"} ${action.icon}`;

    const label = document.createElement("span");
    label.textContent = action.label;

    button.append(icon, label);
    container.appendChild(button);
  });
}

function updateChatbotGreeting(greeting, language) {
  if (!greeting) return;

  greeting.textContent = language === "tagalog"
    ? "Magandang araw! Makakatulong ako sa adoption, surrender requests, matching, events, at account support."
    : "Hello! I can help with adoption, surrender requests, matching, events, and account support.";
}

function updateChatbotSubtitle(subtitle, language) {
  if (!subtitle) return;
  subtitle.textContent = language === "tagalog"
    ? "Kasama mo sa adoption at shelter services."
    : "Your companion for adoption and shelter services.";
}

function updateChatbotInputPlaceholder(input, language) {
  if (!input) return;

  input.placeholder = language === "tagalog"
    ? "Magtanong tungkol sa adoption o services..."
    : "Ask about adoption or services...";
  input.setAttribute(
    "aria-label",
    language === "tagalog" ? "Mensahe sa ANIMUA Assistant" : "Message ANIMUA Assistant"
  );
}

function updateChatbotSuggestionsToggle(button, language) {
  if (!button) return;
  button.textContent = language === "tagalog" ? "Gumawa ng mga tanong" : "Generate questions";
}

function setChatbotLoading(button, isLoading) {
  if (!button) return;
  button.disabled = isLoading;
  button.innerHTML = isLoading
    ? '<i class="fa-solid fa-spinner fa-spin"></i>'
    : '<i class="fa-solid fa-paper-plane"></i>';
}

function trimChatHistory(history) {
  while (history.length > 8) history.shift();
}
