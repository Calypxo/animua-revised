import Swal from "sweetalert2";
import { collection, getDocs } from "firebase/firestore";
import { handleLogin } from "../../auth/login.js";
import { handleRegistration } from "../../auth/register.js";
import { API_BASE_URL } from "../../utils/api.js";
import { db } from "../../utils/firebase.js";

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
const authSideAction = document.getElementById("authSideAction");

const revealElements = document.querySelectorAll(".reveal");
const heroLearnMore = document.querySelector(".hero-learn-more");

function clearFormErrors() {
  const errorIds = [
    "login-email-error",
    "login-password-error",
    "reg-name-error",
    "reg-phone-error",
    "reg-email-error",
    "reg-password-error",
    "reg-confirm-password-error"
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
  if (authModal) authModal.classList.remove("register-mode");

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
  return name.trim().split(/\s+/)[0] || "User";
}

function getInitial(name = "User") {
  return getFirstName(name).charAt(0).toUpperCase() || "U";
}

function updateAuthUI() {
  const dropdownUserName = document.getElementById("dropdownUserName");
  const loginNavBtn = document.getElementById("loginNavBtn");
  const userLoggedInBox = document.getElementById("userLoggedInBox");
  const loggedUserName = document.getElementById("loggedUserName");
  const userAvatarMini = document.querySelector(".user-avatar-mini");
  const logoutBtn = document.getElementById("logoutBtn");

  const isLoggedIn = localStorage.getItem("is_logged_in") === "true";
  const userName = localStorage.getItem("user_name") || "User";
  const displayName = getFirstName(userName);

  if (isLoggedIn) {
    if (loginNavBtn) loginNavBtn.classList.add("hidden");
    if (userLoggedInBox) userLoggedInBox.classList.remove("hidden");
    if (loggedUserName) loggedUserName.textContent = displayName;
    if (dropdownUserName) dropdownUserName.textContent = userName;
    if (userAvatarMini) userAvatarMini.textContent = getInitial(userName);
  } else {
    if (loginNavBtn) loginNavBtn.classList.remove("hidden");
    if (userLoggedInBox) userLoggedInBox.classList.add("hidden");
    if (userAvatarMini) {
      userAvatarMini.innerHTML = '<i class="fa-solid fa-user"></i>';
    }
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

function setupHomeStories() {
  const storyButtons = document.querySelectorAll(".home-highlight-story");
  const storyModal = document.getElementById("storyModal");
  const storyModalCard = storyModal?.querySelector(".story-modal-card");
  const storyModalClose = document.getElementById("storyModalClose");
  const storyModalImage = document.getElementById("storyModalImage");
  const storyModalTag = document.getElementById("storyModalTag");
  const storyModalTitle = document.getElementById("storyModalTitle");
  const storyModalText = document.getElementById("storyModalText");
  const storyModalContent = document.getElementById("storyModalContent");
  const storyModalActions = document.getElementById("storyModalActions");
  const upcomingEventSection = document.getElementById("upcomingEventSection");
  const upcomingEventMedia = document.getElementById("upcomingEventMedia");
  const upcomingEventImage = document.getElementById("upcomingEventImage");
  const upcomingEventTitle = document.getElementById("upcomingEventTitle");
  const upcomingEventDate = document.getElementById("upcomingEventDate");
  const upcomingEventTime = document.getElementById("upcomingEventTime");
  const upcomingEventLocation = document.getElementById("upcomingEventLocation");
  const upcomingEventDescription = document.getElementById("upcomingEventDescription");
  const upcomingEventAction = document.getElementById("upcomingEventAction");

  if (!storyButtons.length || !storyModal || !storyModalCard) return;

  let lastFocusedHighlight = null;
  let animalsLoaded = false;
  let newestPets = [];
  let eventsLoaded = false;
  let upcomingEvents = [];

  const highlightContent = {
    "new-furbabies": {
      tag: "Available Animals",
      title: "Meet Our Newest Furbabies",
      image: "../../src/assets/images/service-browse-animal.jpg",
      intro:
        "Discover the newest animals currently available for adoption at the Angeles City Veterinary Office. View their profiles to learn about their age, temperament, health information, and care needs.",
      primary: { label: "View All Furbabies", href: "find-furbabies.html" }
    },
    "adoption-guide": {
      tag: "Adoption Guide",
      title: "Your Adoption Journey",
      image: "../../src/assets/images/about-cat-cages.jpeg",
      intro:
        "Adopting an animal is a long-term commitment. ANIMUA helps applicants understand the process and submit the information needed by the shelter for evaluation.",
      primary: { label: "Browse Furbabies", href: "find-furbabies.html" },
      secondary: { label: "Take Match Quiz", href: "/pages/public/quizLanding.html" }
    },
    matching: {
      tag: "Compatibility",
      title: "Find a More Compatible Match",
      image: "../../src/assets/images/service-match-shelter.jpg",
      intro:
        "ANIMUA compares your preferences and living situation with the characteristics and care requirements of animals available for adoption.",
      primary: { label: "Take the Match Quiz", href: "/pages/public/quizLanding.html" },
      secondary: { label: "Browse All Furbabies", href: "find-furbabies.html" }
    },
    events: {
      tag: "Events",
      title: "Shelter and Community Events",
      image: "../../src/assets/images/about-free-vaccination.jpg",
      intro:
        "Stay informed about activities organized or announced by the Angeles City Veterinary Office, including adoption campaigns, vaccination drives, and animal welfare initiatives."
    },
    "surrender-guide": {
      tag: "Surrender Guide",
      title: "Before Submitting a Surrender Request",
      image: "../../src/assets/images/service-surrender-form.jpg",
      intro:
        "Surrendering an animal should be considered carefully. ANIMUA allows eligible pet owners to submit a request for shelter review, but submitting a request does not guarantee that the animal will immediately be accepted.",
      primary: { label: "Start Surrender Request", href: "surrender.html" },
      secondary: { label: "Contact the Shelter", href: "contact.html" }
    }
  };

  const escapeHtml = (value = "") =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

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
    if (value?._seconds) return value._seconds * 1000;
    if (typeof value === "number") return value;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const normalizePets = (data) => {
    const rawPets = Array.isArray(data) ? data : data?.pets || [];
    return rawPets
      .filter((pet) => {
        const status = String(pet.status || "").toLowerCase();
        return !status || status === "ready" || status.includes("adoption");
      })
      .sort((a, b) => getPetDateValue(b) - getPetDateValue(a))
      .slice(0, 3);
  };

  const loadNewestPets = async () => {
    if (animalsLoaded) return newestPets;
    animalsLoaded = true;

    try {
      const response = await fetch(`${API_BASE_URL}/public/pets`);
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
        return dateValue && dateValue >= now.getTime();
      })
      .sort((a, b) => getEventDateValue(a) - getEventDateValue(b))
      .slice(0, 4);
  };

  const getDemoUpcomingEvent = () => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    date.setHours(9, 0, 0, 0);

    return {
      id: "demo-upcoming-event",
      title: "Veterinary Services Brought Closer to Angeleños",
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
    if (eventsLoaded) return upcomingEvents;
    eventsLoaded = true;

    const endpoints = ["/public/events", "/events"];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        if (!response.ok) continue;

        upcomingEvents = normalizeEvents(await response.json());
        return upcomingEvents;
      } catch (error) {
        console.warn(`Homepage events load skipped for ${endpoint}:`, error);
      }
    }

    try {
      const snapshot = await getDocs(collection(db, "events"));
      upcomingEvents = normalizeEvents(
        snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }))
      );
      return upcomingEvents;
    } catch (error) {
      console.warn("Homepage Firestore events load skipped:", error);
    }

    // Demo fallback for homepage design review while no published event exists yet.
    upcomingEvents = [getDemoUpcomingEvent()];
    return upcomingEvents;
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
    const event = events[0];

    if (!event) {
      upcomingEventSection.classList.add("hidden");
      return;
    }

    const image = getEventImage(event);
    const title = event.title || event.name || "Shelter Event";
    const description = getEventDescription(event);

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
      upcomingEventAction.addEventListener("click", openEventsModal);
    }

    upcomingEventSection.classList.remove("hidden");
  };

  const renderAction = (action, style = "primary") => {
    if (!action) return "";
    return `<a class="story-modal-action story-modal-action-${style}" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>`;
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

    storyModalContent.innerHTML = `
      <div class="story-pet-list">
        ${pets
          .map(
            (pet) => `
              <button type="button" class="story-pet-card" data-pet-id="${escapeHtml(pet.id || "")}">
                <img src="${escapeHtml(pet.photoURL || pet.image || fallbackPetImage(pet))}" alt="${escapeHtml(pet.name || "Adoptable furbaby")}">
                <span class="story-pet-info">
                  <strong>${escapeHtml(pet.name || "Unnamed Furbaby")}</strong>
                  <small>${escapeHtml(petTypeLabel(pet))}</small>
                  <span>${escapeHtml(pet.ageEstimate || pet.age || "Unknown age")} · ${escapeHtml(pet.sex || "Unknown sex")}</span>
                  <em>${escapeHtml(pet.status || "Ready")}</em>
                </span>
              </button>
            `
          )
          .join("")}
      </div>
    `;

    storyModalContent.querySelectorAll(".story-pet-card").forEach((card) => {
      card.addEventListener("click", () => {
        const petId = card.dataset.petId;
        if (petId) {
          localStorage.setItem("animua_selected_pet_id", petId);
          localStorage.setItem("animua_selected_pet_action", "view");
        }
        window.location.href = "find-furbabies.html";
      });
    });
  };

  const renderEvents = async () => {
    storyModalContent.innerHTML = '<p class="story-loading">Loading upcoming events...</p>';
    const events = await loadUpcomingEvents();

    if (!events.length) {
      storyModalContent.innerHTML =
        '<p class="story-empty-state">There are no upcoming events at the moment. Please check again for future announcements.</p>';
      return;
    }

    storyModalContent.innerHTML = `
      <div class="story-event-list">
        ${events
          .map((event) => {
            const date = event.date || event.eventDate || event.startDate || event.startsAt || "";
            const time = event.time || event.eventTime || event.startTime || "";
            const location = event.location || event.venue || "";
            const description = event.description || event.summary || "";
            const image = event.image || event.imageUrl || event.imageURL || event.photoURL || "";
            const detailHref = event.url || event.href || event.link || "";

            return `
              <article class="story-event-card">
                ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(event.title || "Community event")}">` : ""}
                <div>
                  <h3>${escapeHtml(event.title || event.name || "Shelter Event")}</h3>
                  <p class="story-event-meta">${escapeHtml([date, time, location].filter(Boolean).join(" · "))}</p>
                  ${description ? `<p>${escapeHtml(description)}</p>` : ""}
                  ${detailHref ? `<a href="${escapeHtml(detailHref)}">View event details</a>` : ""}
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    `;
  };

  const renderStaticContent = (key) => {
    if (key === "adoption-guide") {
      storyModalContent.innerHTML = `
        ${renderSteps([
          {
            title: "Step 1 - Explore Available Animals",
            text: "Browse verified animal profiles and review their basic information, behavior, health condition, and care needs."
          },
          {
            title: "Step 2 - Check Your Compatibility",
            text: "Take the compatibility quiz to discover animals that may be suitable for your lifestyle, home environment, experience, and preferences."
          },
          {
            title: "Step 3 - Submit an Adoption Application",
            text: "Choose an animal and complete the required adoption application. Make sure all submitted information is accurate."
          },
          {
            title: "Step 4 - Shelter Evaluation",
            text: "The Angeles City Veterinary Office will review the application. Submission does not automatically guarantee approval."
          },
          {
            title: "Step 5 - Adoption and Follow-Up",
            text: "Approved applicants will receive instructions from the shelter regarding the next steps and post-adoption monitoring."
          }
        ])}
        <p class="story-note"><strong>Important note:</strong> Applicants must meet the evaluation requirements of the Angeles City Veterinary Office. The shelter may approve or reject an application based on the animal's welfare and the applicant's ability to provide responsible long-term care.</p>
      `;
      return;
    }

    if (key === "matching") {
      storyModalContent.innerHTML = `
        ${renderSteps([
          {
            title: "1. Tell Us About Your Lifestyle",
            text: "The quiz asks about factors such as your living environment, daily routine, activity level, pet experience, preferred animal characteristics, and ability to provide care."
          },
          {
            title: "2. ANIMUA Compares Your Answers",
            text: "Your responses are compared with animal information such as temperament, age, size, behavior, activity level, and care requirements."
          },
          {
            title: "3. Review Your Recommended Matches",
            text: "The system generates ranked recommendations and compatibility results to help you make a more informed decision."
          }
        ])}
        <p class="story-note">A compatibility result is a recommendation, not an automatic adoption approval. Final adoption decisions are still reviewed by the Angeles City Veterinary Office.</p>
      `;
      return;
    }

    if (key === "surrender-guide") {
      storyModalContent.innerHTML = `
        <div class="story-section-list">
          <section>
            <h3>Eligibility</h3>
            <p>Animal surrender requests are limited to bona fide residents of Angeles City. Users must provide accurate owner, animal, and location information.</p>
          </section>
          <section>
            <h3>Information You Will Need</h3>
            ${renderBulletList([
              "Owner and contact information",
              "Proof or confirmation of Angeles City residency, based on the existing form",
              "Animal details",
              "Health and vaccination information, when available",
              "Behavior and care information",
              "Reason for surrender",
              "Supporting photos or documents required by the existing surrender form"
            ])}
          </section>
          <section>
            <h3>Review Process</h3>
            ${renderBulletList([
              "Complete and submit the surrender request.",
              "Shelter staff review the information and reason for surrender.",
              "The request may be approved, rejected, or returned for additional information.",
              "Approved requests may proceed to intake based on shelter evaluation, capacity, urgency, and available resources."
            ])}
          </section>
        </div>
        <p class="story-note"><strong>Important notice:</strong> Do not leave or abandon an animal at the shelter without confirmation. Continue providing food, water, shelter, and necessary care while the request is being reviewed.</p>
      `;
    }
  };

  const closeStoryModal = () => {
    storyModal.classList.add("hidden");
    storyModal.setAttribute("aria-hidden", "true");
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
      storyButtons.forEach((item) => {
        item.classList.toggle("is-selected", item === button);
        item.setAttribute("aria-pressed", item === button ? "true" : "false");
      });

      if (storyModalImage) {
        storyModalImage.src = config.image || "";
        storyModalImage.alt = config.title || "";
      }
      if (storyModalTag) storyModalTag.textContent = config.tag || "";
      if (storyModalTitle) storyModalTitle.textContent = config.title || "";
      if (storyModalText) storyModalText.textContent = config.intro || "";
      if (storyModalContent) storyModalContent.innerHTML = "";
      if (storyModalActions) renderActions(config);

      storyModal.classList.remove("hidden");
      storyModal.setAttribute("aria-hidden", "false");
      document.body.classList.add("modal-open");
      storyModalCard.focus();

      if (key === "new-furbabies") {
        await renderNewFurbabies();
      } else if (key === "events") {
        await renderEvents();
      } else {
        renderStaticContent(key);
      }
    });
  });

  if (storyModalClose) {
    storyModalClose.addEventListener("click", closeStoryModal);
  }

  renderUpcomingEventSection();

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

  const getPetDateValue = (pet = {}) => {
    const value = pet.createdAt || pet.updatedAt || pet.intakeDate || "";
    if (value?._seconds) return value._seconds * 1000;
    if (typeof value === "number") return value;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const getTemperamentLabel = (pet = {}) => {
    const traits = pet.behavioralAssessment || {};

    if (traits.specialNeeds >= 4) return "Needs attentive care";
    if (traits.friendlinessToHumans >= 4 || traits.affectionLevel >= 4) return "People-friendly";
    if (traits.energyLevel >= 4 || traits.playfulness >= 4) return "Active";
    if (traits.independenceLevel >= 4) return "Independent";
    if (traits.adaptability >= 4) return "Adaptable";

    return pet.initialCondition ? "Under shelter care" : "Ready to meet";
  };

  const fallbackPetImage = (pet = {}) => {
    const species = String(pet.species || "").toLowerCase();
    if (species.includes("cat")) return "../../src/assets/images/cat.jpg";
    return "../../src/assets/images/dog.jpg";
  };

  const openPetProfile = (petId) => {
    if (petId) {
      localStorage.setItem("animua_selected_pet_id", petId);
      localStorage.setItem("animua_selected_pet_action", "view");
    }

    window.location.href = "find-furbabies.html";
  };

  const renderPets = (pets) => {
    if (!pets.length) {
      grid.innerHTML =
        '<p class="featured-furbabies-state">No featured furbabies are available right now. Please check again soon.</p>';
      return;
    }

    grid.innerHTML = pets
      .map(
        (pet) => `
          <article
            class="featured-furbaby-card"
            tabindex="0"
            role="button"
            aria-expanded="false"
            aria-label="Show details for ${escapeHtml(pet.name || "this furbaby")}"
          >
            <img src="${escapeHtml(pet.photoURL || fallbackPetImage(pet))}" alt="${escapeHtml(pet.name || "Adoptable furbaby")}">
            <div class="featured-furbaby-overlay">
              <h3>${escapeHtml(pet.name || "Unnamed Furbaby")}</h3>
              <button type="button" class="featured-furbaby-profile" data-pet-id="${escapeHtml(pet.id || "")}">
                View Profile
              </button>
            </div>
            <div class="featured-furbaby-details" aria-hidden="true">
              <p>${escapeHtml(petTypeLabel(pet))}</p>
              <span>${escapeHtml(pet.status || "Ready")}</span>
              <dl class="featured-furbaby-facts">
                <div>
                  <dt>Age</dt>
                  <dd>${escapeHtml(pet.ageEstimate || "Unknown")}</dd>
                </div>
                <div>
                  <dt>Sex</dt>
                  <dd>${escapeHtml(pet.sex || "Unknown")}</dd>
                </div>
                <div>
                  <dt>Temperament</dt>
                  <dd>${escapeHtml(getTemperamentLabel(pet))}</dd>
                </div>
              </dl>
            </div>
          </article>
        `
      )
      .join("");

    grid.querySelectorAll(".featured-furbaby-card").forEach((card) => {
      const cardImage = card.querySelector("img");
      const details = card.querySelector(".featured-furbaby-details");
      if (cardImage) {
        cardImage.addEventListener("error", () => {
          cardImage.classList.add("is-missing");
          cardImage.removeAttribute("src");
        });
      }

      const toggleCard = () => {
        const isExpanded = card.classList.toggle("is-expanded");
        card.setAttribute("aria-expanded", String(isExpanded));
        if (details) details.setAttribute("aria-hidden", String(!isExpanded));
      };

      card.addEventListener("click", (event) => {
        if (event.target.closest(".featured-furbaby-profile")) return;
        toggleCard();
      });

      card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        if (event.target.closest(".featured-furbaby-profile")) return;
        event.preventDefault();
        toggleCard();
      });
    });

    grid.querySelectorAll(".featured-furbaby-profile").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        openPetProfile(button.dataset.petId);
      });
    });
  };

  fetch(`${API_BASE_URL}/public/pets`)
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
        .slice(0, 4);

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
    }, 120);

    window.setTimeout(() => {
      nextSection.classList.remove("auth-view-enter");
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

if (heroLearnMore) {
  heroLearnMore.addEventListener("click", (event) => {
    const target = document.querySelector(heroLearnMore.getAttribute("href"));

    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
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
function setupUserDropdown() {
  const userMenuBtn = document.getElementById("userMenuBtn");
  const userDropdown = document.getElementById("userDropdown");

  if (!userMenuBtn || !userDropdown) return;

  userMenuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    userDropdown.classList.toggle("hidden");
  });

  userDropdown.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", () => {
    userDropdown.classList.add("hidden");
  });
}

document.addEventListener("DOMContentLoaded", () => {
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

function setupAccountActions() {
  const changeUsernameBtn = document.getElementById("changeUsernameBtn");
  const changePasswordBtn = document.getElementById("changePasswordBtn");

  if (changeUsernameBtn && !changeUsernameBtn.dataset.bound) {
    changeUsernameBtn.dataset.bound = "true";

    changeUsernameBtn.addEventListener("click", async () => {
      const currentName = localStorage.getItem("user_name") || "";

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
      const result = await Swal.fire({
        title: "Change Password",
        html: `
          <input id="oldPassword" type="password" class="swal2-input" placeholder="Current password">
          <input id="newPassword" type="password" class="swal2-input" placeholder="New password">
        `,
        showCancelButton: true,
        confirmButtonText: "Update Password",
        cancelButtonText: "Cancel",
        customClass: {
          popup: "animua-popup",
          confirmButton: "animua-confirm",
          cancelButton: "animua-cancel"
        },
        buttonsStyling: false,
        preConfirm: () => {
          const oldPassword = document.getElementById("oldPassword").value;
          const newPassword = document.getElementById("newPassword").value;

          if (!oldPassword || !newPassword) {
            Swal.showValidationMessage("Please fill in both password fields.");
            return false;
          }

          if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(newPassword)) {
            Swal.showValidationMessage("New password must include uppercase, lowercase, number, and special character.");
            return false;
          }

          return { oldPassword, newPassword };
        }
      });

      if (!result.isConfirmed) return;

      await updatePassword(result.value.oldPassword, result.value.newPassword);
    });
  }
}

async function updateUsername(newName) {
  const token = localStorage.getItem("animua_token");

  const response = await fetch(`${API_BASE_URL}/auth/update-username`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ fullName: newName })
  });

  const data = await response.json();

  if (!response.ok) {
    Swal.fire("Error", data.message || "Failed to update username.", "error");
    return;
  }

  localStorage.setItem("user_name", data.fullName || newName);

  const loggedUserName = document.getElementById("loggedUserName");
  const dropdownUserName = document.getElementById("dropdownUserName");

  if (loggedUserName) loggedUserName.textContent = getFirstName(data.fullName || newName);
  if (dropdownUserName) dropdownUserName.textContent = data.fullName || newName;

  const userAvatarMini = document.querySelector(".user-avatar-mini");
  if (userAvatarMini) userAvatarMini.textContent = getInitial(data.fullName || newName);

  Swal.fire("Updated", "Your username has been updated.", "success");
}

async function updatePassword(oldPassword, newPassword) {
  const token = localStorage.getItem("animua_token");

  const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ oldPassword, newPassword })
  });

  const data = await response.json();

  if (!response.ok) {
    Swal.fire("Error", data.message || "Failed to update password.", "error");
    return;
  }

  Swal.fire("Updated", "Your password has been changed.", "success");
}

