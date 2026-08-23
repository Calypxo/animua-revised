import { getUserSession } from "../../utils/storage.js";

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

function profileMarkup() {
  return `
    <section class="profile-modal-overlay hidden" id="profileModal" aria-hidden="true" aria-labelledby="profileModalTitle">
      <button type="button" class="profile-modal-backdrop" data-profile-close aria-label="Close profile"></button>
      <article class="profile-modal-card profile-modal-card--compact" role="dialog" aria-modal="true" tabindex="-1" style="width: min(640px, calc(100vw - 64px)); max-width: 640px;">
        <button type="button" class="profile-modal-close" data-profile-close aria-label="Close profile">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
        <div class="profile-modal-shell">
          <div class="profile-modal-title">
            <span class="profile-title-icon" aria-hidden="true"><i class="fa-regular fa-user"></i></span>
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
              <button type="button" class="profile-outline-btn">
                <i class="fa-solid fa-camera" aria-hidden="true"></i>
                <span>Change Photo</span>
              </button>
            </div>
          </section>
          <form class="profile-form" id="profileForm">
            <section class="profile-info-card">
              <div class="profile-section-head">
                <h3><i class="fa-solid fa-circle-user" aria-hidden="true"></i> Personal Information</h3>
                <button type="button" class="profile-outline-btn profile-edit-inline">
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
          </form>
        </div>
      </article>
    </section>
  `;
}

function ensureProfileModal() {
  let modal = document.querySelector("#profileModal.profile-modal-overlay");
  if (!modal) {
    document.body.insertAdjacentHTML("beforeend", profileMarkup());
    modal = document.querySelector("#profileModal.profile-modal-overlay");
  }
  return modal;
}

export function closeProfileModal() {
  const modal = document.querySelector("#profileModal.profile-modal-overlay");
  modal?.classList.add("hidden");
  modal?.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

export function openProfileModal() {
  const modal = ensureProfileModal();
  if (!modal) return;

  const session = getUserSession();
  const fullName = session?.fullName || "Account";
  const email = session?.email || "";
  const photo = session?.profilePhotoDataUrl || "";

  document.getElementById("profileSummaryName")?.replaceChildren(document.createTextNode(firstName(fullName)));
  const fullNameField = document.getElementById("profileFullName");
  const emailField = document.getElementById("profileEmail");
  if (fullNameField) fullNameField.value = fullName;
  if (emailField) emailField.value = email;
  renderAvatar(document.getElementById("profileAvatarPreview"), fullName, photo);

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  modal.querySelectorAll("[data-profile-close]").forEach((button) => {
    button.addEventListener("click", closeProfileModal, { once: true });
  });
}
