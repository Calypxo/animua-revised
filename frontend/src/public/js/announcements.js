import { API_BASE_URL } from "../../utils/api.js";
import { ensureUserSession, hasUserSession } from "../../utils/storage.js";

const NEWS_CCA_CAT_RESCUE_IMAGE = new URL(
  "../../assets/images/optimized/announcements/news-cca-cat-rescue-720.jpg",
  import.meta.url
).href;
const HIGHLIGHT_UPCOMING_EVENT_IMAGE = new URL(
  "../../assets/images/optimized/home/highlight-upcoming-event-720.webp",
  import.meta.url
).href;
const SUCCESS_ZACH_ADOPTION_IMAGE = new URL(
  "../../assets/images/optimized/announcements/success-zach-adoption-720.jpg",
  import.meta.url
).href;

const FALLBACK_IMAGES = {
  "News & Article": NEWS_CCA_CAT_RESCUE_IMAGE,
  "Success Stories": SUCCESS_ZACH_ADOPTION_IMAGE,
  "Upcoming Events": HIGHLIGHT_UPCOMING_EVENT_IMAGE,
};

const TYPES = {
  "News & Article": { icon: "fa-regular fa-newspaper", slug: "news", label: "News & Article" },
  "Success Stories": { icon: "fa-solid fa-heart", slug: "success", label: "Rescue Story" },
  "Upcoming Events": { icon: "fa-regular fa-calendar-check", slug: "event", label: "Event" },
};

const state = {
  announcements: [],
  search: "",
  type: "",
  action: "",
  visibleCount: 5,
  targetedId: "",
};

const feed = document.getElementById("announcementFeed");
const featured = document.getElementById("featuredAnnouncement");
const status = document.getElementById("announcementStatus");
const eventList = document.getElementById("upcomingEventList");
const searchInput = document.getElementById("announcementSearch");
const typeSelect = document.getElementById("announcementType");
const typeSelectWrap = document.querySelector(".announcement-topic-select");
const typeToggle = document.getElementById("announcementTypeToggle");
const typeLabel = document.getElementById("announcementTypeLabel");
const typeMenu = document.getElementById("announcementTypeMenu");
const showAllButton = document.getElementById("showAllAnnouncements");
const pastAnnouncementsButton = document.getElementById("pastAnnouncementsBtn");
let swalModulePromise;

ensureUserSession()
  .then(() => {
    document.querySelector("[data-login-link]")?.classList.toggle("hidden", hasUserSession());
  })
  .catch((error) => console.warn("Unable to restore announcement session:", error.message));

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[character]));
}

async function getSwal() {
  swalModulePromise ||= import("sweetalert2").then((module) => module.default);
  return swalModulePromise;
}

function normalizeType(value) {
  const type = String(value || "").toLowerCase().trim();
  if (type.includes("event")) return "Upcoming Events";
  if (type.includes("success") || type.includes("rescue")) return "Success Stories";
  return "News & Article";
}

function toDate(value) {
  if (!value) return null;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const seconds = value._seconds ?? value.seconds;
  return Number.isFinite(Number(seconds)) ? new Date(Number(seconds) * 1000) : null;
}

function publishedDate(value) {
  const date = toDate(value);
  return date
    ? date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })
    : "Recently";
}

function eventDateParts(value) {
  if (!value) return { month: "Soon", day: "" };
  const parts = String(value).split("-").map(Number);
  const date = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(value);
  if (Number.isNaN(date.getTime())) return { month: "Soon", day: "" };
  return {
    month: date.toLocaleDateString("en-PH", { month: "short" }).toUpperCase(),
    day: date.toLocaleDateString("en-PH", { day: "2-digit" }),
    full: date.toLocaleDateString("en-PH", { weekday: "short", year: "numeric", month: "long", day: "numeric" }),
  };
}

function eventDate(value) {
  return eventDateParts(value).full || String(value || "Soon");
}

function getPostDate(item) {
  return publishedDate(item.createdAt || item.publishedAt || item.updatedAt);
}

function getImage(item, type) {
  return item.imageUrl || item.imageURL || item.image || item.photoURL || item.coverImage || FALLBACK_IMAGES[type];
}

function getCaption(item) {
  return item.caption || item.description || item.summary || "Official ANIMUA community update from the Angeles City Veterinary Office.";
}

function getStoryId(item = {}) {
  return String(item.id || item._id || item.slug || item.title || "").trim();
}

function getStoryDetails(item = {}) {
  const paragraphSources = [
    item.caption,
    item.description,
    item.summary,
    item.body,
    item.content,
    ...(Array.isArray(item.details) ? item.details : []),
    ...(Array.isArray(item.storyParagraphs) ? item.storyParagraphs : []),
  ];

  const seen = new Set();
  return paragraphSources
    .flatMap((value) => String(value || "").split(/\n{1,}/))
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .filter((paragraph) => {
      const key = paragraph.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function setStatus(message = "", icon = "") {
  if (!status) return;
  status.hidden = !message;
  status.replaceChildren();
  if (!message) return;

  if (icon) {
    const iconNode = document.createElement("i");
    iconNode.className = icon;
    iconNode.setAttribute("aria-hidden", "true");
    status.appendChild(iconNode);
  }

  const text = document.createElement("span");
  text.textContent = message;
  status.appendChild(text);
}

function icon(className) {
  const node = document.createElement("i");
  node.className = className;
  node.setAttribute("aria-hidden", "true");
  return node;
}

function typeBadge(type) {
  const normalized = normalizeType(type);
  const config = TYPES[normalized];
  const badge = document.createElement("span");
  badge.className = `announcement-type type-${config.slug}`;
  badge.append(icon(config.icon), document.createTextNode(config.label));
  return badge;
}

function metaItem(iconClass, text) {
  const item = document.createElement("span");
  item.append(icon(iconClass), document.createTextNode(text));
  return item;
}

function getTypeLabel(value = "") {
  if (!value) return "All topics";
  return TYPES[normalizeType(value)]?.label || value;
}

function syncTypeDropdown(value = "") {
  if (typeSelect) typeSelect.value = value;
  if (typeLabel) typeLabel.textContent = getTypeLabel(value);
  typeMenu?.querySelectorAll("[data-topic-value]").forEach((button) => {
    button.setAttribute("aria-selected", String((button.dataset.topicValue || "") === value));
  });
}

function closeTypeDropdown() {
  typeSelectWrap?.classList.remove("is-open");
  typeToggle?.setAttribute("aria-expanded", "false");
}

function openTypeDropdown() {
  typeSelectWrap?.classList.add("is-open");
  typeToggle?.setAttribute("aria-expanded", "true");
}

function createMedia(item, type) {
  const media = document.createElement("div");
  media.className = `announcement-card-media media-${TYPES[type].slug}`;

  const image = document.createElement("img");
  image.src = getImage(item, type);
  image.alt = item.title ? `${item.title} cover` : `${type} cover`;
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("error", () => {
    image.remove();
    media.classList.add("is-placeholder");
    media.append(icon(TYPES[type].icon));
  });
  media.appendChild(image);

  return media;
}

function createPost(item, { isFeatured = false } = {}) {
  const type = normalizeType(item.type);
  const storyId = getStoryId(item);
  const article = document.createElement("article");
  article.className = `public-announcement-card${isFeatured ? " is-featured" : ""}`;
  if (storyId) {
    article.dataset.announcementId = storyId;
    article.classList.toggle("is-targeted", storyId === state.targetedId);
  }
  article.appendChild(createMedia(item, type));

  const body = document.createElement("div");
  body.className = "announcement-card-body";

  const heading = document.createElement("div");
  heading.className = "announcement-card-heading";
  heading.appendChild(typeBadge(type));

  const title = document.createElement(isFeatured ? "h2" : "h3");
  title.textContent = item.title || "ANIMUA community update";

  const copy = document.createElement("p");
  copy.textContent = getCaption(item);

  body.append(heading, title, copy);

  if (type === "Upcoming Events" && (item.eventDate || item.eventTime || item.location)) {
    const details = document.createElement("div");
    details.className = "announcement-event-meta";
    if (item.eventDate) details.appendChild(metaItem("fa-regular fa-calendar", eventDate(item.eventDate)));
    if (item.eventTime) details.appendChild(metaItem("fa-regular fa-clock", item.eventTime));
    if (item.location) details.appendChild(metaItem("fa-solid fa-location-dot", item.location));
    body.appendChild(details);
  }

  const footer = document.createElement("div");
  footer.className = "public-post-footer";
  footer.append(
    metaItem("fa-regular fa-calendar", getPostDate(item)),
    metaItem("fa-regular fa-bookmark", type),
    metaItem("fa-solid fa-location-dot", item.location || "Angeles City")
  );

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "post-open-button";
  openButton.setAttribute("aria-label", `Read ${item.title || "announcement"}`);
  openButton.append(icon("fa-solid fa-arrow-right"));
  openButton.addEventListener("click", () => showAnnouncementDetail(item));

  body.appendChild(footer);
  article.append(body, openButton);
  article.addEventListener("dblclick", () => showAnnouncementDetail(item));
  return article;
}

function emptyState() {
  const empty = document.createElement("div");
  empty.className = "announcement-empty";
  const heading = document.createElement("h3");
  heading.textContent = state.search || state.type ? "No matching community posts" : "No public posts yet";
  const copy = document.createElement("p");
  copy.textContent = state.search || state.type
    ? "Try another search or return to all community content."
    : "Published stories and updates from ANIMUA will appear here.";
  empty.append(icon("fa-regular fa-newspaper"), heading, copy);
  return empty;
}

function getFilteredPosts() {
  const term = state.search.toLowerCase();
  return state.announcements.filter((item) => {
    const type = normalizeType(item.type);
    const content = `${item.title || ""} ${getCaption(item)} ${item.location || ""}`.toLowerCase();
    const matchesFilters = (!state.type || type === state.type) && (!term || content.includes(term));
    if (!matchesFilters) return false;

    if (state.action === "past") {
      if (type !== "Upcoming Events") return true;
      const date = toDate(item.eventDate);
      return date ? date < new Date() : true;
    }

    return true;
  });
}

function renderEvents() {
  if (!eventList) return;
  eventList.replaceChildren();
  const events = state.announcements
    .filter((item) => normalizeType(item.type) === "Upcoming Events")
    .slice(0, 3);

  if (!events.length) {
    const message = document.createElement("p");
    message.className = "no-upcoming-events";
    message.textContent = "New community events will be posted here soon.";
    eventList.appendChild(message);
    return;
  }

  events.forEach((item) => {
    const row = document.createElement("article");
    row.className = "upcoming-event-row";

    const dateInfo = eventDateParts(item.eventDate);
    const date = document.createElement("time");
    date.dateTime = item.eventDate || "";
    date.innerHTML = `<span>${escapeHtml(dateInfo.month)}</span>${escapeHtml(dateInfo.day || "Soon")}`;

    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.title || "ANIMUA event";
    const meta = document.createElement("small");
    meta.innerHTML = `
      ${item.eventTime ? `<span><i class="fa-regular fa-clock" aria-hidden="true"></i>${escapeHtml(item.eventTime)}</span>` : ""}
      <span><i class="fa-solid fa-location-dot" aria-hidden="true"></i>${escapeHtml(item.location || "Angeles City")}</span>
    `;
    copy.append(title, meta);
    row.append(date, copy);
    row.addEventListener("click", () => showAnnouncementDetail(item));
    eventList.appendChild(row);
  });
}

function render() {
  if (!feed || !featured) return;
  const filtered = getFilteredPosts();
  const visiblePosts = filtered.slice(0, state.visibleCount);

  document.querySelectorAll("[data-public-type]").forEach((button) => {
    button.classList.toggle("is-active", Boolean(state.type) && button.dataset.publicType === state.type);
    button.setAttribute("aria-pressed", String(Boolean(state.type) && button.dataset.publicType === state.type));
  });
  document.querySelectorAll("[data-topic-search]").forEach((button) => {
    button.classList.toggle("is-active", Boolean(state.search) && button.dataset.topicSearch === state.search.toLowerCase());
    button.setAttribute("aria-pressed", String(Boolean(state.search) && button.dataset.topicSearch === state.search.toLowerCase()));
  });
  pastAnnouncementsButton?.classList.toggle("is-active", state.action === "past");
  pastAnnouncementsButton?.setAttribute("aria-pressed", String(state.action === "past"));
  showAllButton?.classList.toggle("is-active", state.action === "all");
  showAllButton?.setAttribute("aria-pressed", String(state.action === "all"));

  featured.replaceChildren();
  feed.replaceChildren();

  if (!filtered.length) {
    featured.appendChild(emptyState());
    if (showAllButton) showAllButton.hidden = true;
    return;
  }

  featured.appendChild(createPost(visiblePosts[0], { isFeatured: true }));
  const fragment = document.createDocumentFragment();
  visiblePosts.slice(1).forEach((item) => fragment.appendChild(createPost(item)));
  feed.appendChild(fragment);

  if (showAllButton) {
    showAllButton.hidden = filtered.length <= 5;
    showAllButton.querySelector("span").textContent = state.visibleCount >= filtered.length
      ? "Show fewer announcements"
      : `View all ${filtered.length} announcements`;
  }
}

function applyTypeFilter(type = "") {
  state.type = type;
  state.search = "";
  state.action = type ? "type" : "";
  state.visibleCount = 5;
  if (searchInput) searchInput.value = "";
  syncTypeDropdown(type);
  document.getElementById("announcementsHeading")?.scrollIntoView({ behavior: "smooth", block: "start" });
  render();
}

function applySearchFilter(term = "") {
  state.search = term.trim();
  state.type = "";
  state.action = state.search ? "search" : "";
  state.visibleCount = 5;
  if (searchInput) searchInput.value = state.search;
  syncTypeDropdown("");
  document.getElementById("announcementsHeading")?.scrollIntoView({ behavior: "smooth", block: "start" });
  render();
}

async function showAnnouncementDetail(item) {
  const Swal = await getSwal();
  const type = normalizeType(item.type);
  const details = getStoryDetails(item);
  const title = item.title || "ANIMUA community update";
  const image = getImage(item, type);
  const source = item.source || "ANIMUA City Government";
  const readMinutes = Math.max(1, Math.ceil(details.join(" ").split(/\s+/).filter(Boolean).length / 180));
  const shareText = `${title} - ${getCaption(item)}`;
  const postedTime = item.eventTime || "Official update";
  const priority = type === "Upcoming Events" ? "Event" : type === "Success Stories" ? "Story" : "Medium";
  const detailLabel = type === "News & Article" ? "News & Alerts" : TYPES[type].label;
  const titleClass = title.length > 58 ? " is-long-title" : "";
  const fallbackImage = FALLBACK_IMAGES[type] || NEWS_CCA_CAT_RESCUE_IMAGE;

  Swal.fire({
    html: `
      <article class="announcement-detail${titleClass}">
        <button type="button" class="announcement-detail-close" data-announcement-detail-close aria-label="Close announcement details">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
        <span class="announcement-detail-handle" aria-hidden="true"></span>
        <div class="announcement-detail-kicker">${typeBadgeHtml(type, detailLabel)}</div>
        <h2>${escapeHtml(title)}</h2>
        <div class="announcement-detail-meta">
          <span><i class="fa-regular fa-calendar" aria-hidden="true"></i>${escapeHtml(getPostDate(item))}</span>
          <span>${escapeHtml(postedTime)}</span>
          <span><i class="fa-solid fa-building-columns" aria-hidden="true"></i>${escapeHtml(source)}</span>
        </div>
        <button type="button" class="announcement-detail-photo-button" data-announcement-photo-src="${escapeHtml(image)}" data-announcement-photo-title="${escapeHtml(title)}" aria-label="View full photo for ${escapeHtml(title)}">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" data-fallback-src="${escapeHtml(fallbackImage)}">
          <span><i class="fa-solid fa-expand" aria-hidden="true"></i></span>
        </button>
        <div class="announcement-detail-copy">
        ${details.length
          ? details.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")
          : `<p>${escapeHtml(getCaption(item))}</p>`}
        </div>
        <div class="announcement-detail-info">
          <span>
            <i class="fa-solid fa-location-dot" aria-hidden="true"></i>
            <strong>Affected Areas</strong>
            <small>${escapeHtml(item.location || "Angeles City")}</small>
          </span>
          <span>
            <i class="fa-solid fa-tag" aria-hidden="true"></i>
            <strong>Priority</strong>
            <small>${escapeHtml(priority)}</small>
          </span>
          <span>
            <i class="fa-regular fa-clock" aria-hidden="true"></i>
            <strong>Read Time</strong>
            <small>${readMinutes} min</small>
          </span>
        </div>
        <div class="announcement-detail-note">
          <i class="fa-solid fa-shield-heart" aria-hidden="true"></i>
          <span><strong>Stay Safe, ANIMUA.</strong> Monitor official channels and follow safety protocols. Your safety is our top priority.</span>
        </div>
        <div class="announcement-detail-actions">
          <button type="button" class="announcement-detail-back" data-announcement-detail-close>
            <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
            <span>Back to Announcements</span>
          </button>
          <button type="button" class="announcement-detail-share" data-announcement-detail-share data-share-title="${escapeHtml(title)}" data-share-text="${escapeHtml(shareText)}">
            <i class="fa-solid fa-share-nodes" aria-hidden="true"></i>
            <span>Share Update</span>
          </button>
        </div>
      </article>
    `,
    showConfirmButton: false,
    showCloseButton: false,
    didOpen: (popup) => {
      popup.querySelectorAll("[data-announcement-detail-close]").forEach((button) => {
        button.addEventListener("click", () => Swal.close());
      });
      popup.querySelectorAll(".announcement-detail-photo-button img").forEach((photo) => {
        photo.addEventListener("error", () => {
          const fallbackSrc = photo.dataset.fallbackSrc;
          if (fallbackSrc && photo.src !== fallbackSrc) {
            photo.src = fallbackSrc;
            const photoButton = photo.closest("[data-announcement-photo-src]");
            if (photoButton) photoButton.dataset.announcementPhotoSrc = fallbackSrc;
          }
        });
      });
      popup.querySelector("[data-announcement-photo-src]")?.addEventListener("click", (event) => {
        const button = event.currentTarget;
        const photoSrc = button.dataset.announcementPhotoSrc || image;
        const photoTitle = button.dataset.announcementPhotoTitle || title;

        Swal.fire({
          html: `
            <figure class="announcement-photo-viewer">
              <img src="${escapeHtml(photoSrc)}" alt="${escapeHtml(photoTitle)}">
              <button type="button" class="announcement-photo-inline-close" data-announcement-photo-close aria-label="Close full photo">
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </figure>
          `,
          showConfirmButton: false,
          showCloseButton: false,
          customClass: {
            popup: "announcement-photo-popup",
          },
          buttonsStyling: false,
          didOpen: (photoPopup) => {
            photoPopup.querySelector("[data-announcement-photo-close]")?.addEventListener("click", () => Swal.close());
          },
        });
      });
      popup.querySelector("[data-announcement-detail-share]")?.addEventListener("click", async (event) => {
        const button = event.currentTarget;
        const payload = {
          title: button.dataset.shareTitle || title,
          text: button.dataset.shareText || shareText,
          url: window.location.href,
        };
        try {
          if (navigator.share) {
            await navigator.share(payload);
          } else if (navigator.clipboard) {
            await navigator.clipboard.writeText(`${payload.title}\n${payload.url}`);
          }
        } catch (error) {
          console.warn("[Announcement share failed]", error);
        }
      });
    },
    customClass: {
      popup: "animua-popup announcement-detail-popup",
    },
    buttonsStyling: false,
  });
}

function typeBadgeHtml(type, label = "") {
  const config = TYPES[type];
  return `<span class="announcement-type type-${config.slug}"><i class="${config.icon}" aria-hidden="true"></i>${escapeHtml(label || config.label)}</span>`;
}

function mergeAnnouncements(items = []) {
  // The management API is the single source of truth for this page. Static
  // homepage highlights used to be prepended here, which pushed newly created
  // management posts below the initial five-card limit.
  return Array.isArray(items) ? items : [];
}

function findAnnouncementByQuery() {
  const params = new URLSearchParams(window.location.search);
  const requestedStory = params.get("story") || params.get("id") || "";
  const requestedType = params.get("type") || "";

  if (requestedType) {
    state.type = normalizeType(requestedType);
    syncTypeDropdown(state.type);
  }

  if (!requestedStory) return null;

  const normalizedStory = requestedStory.toLowerCase();
  const match = state.announcements.find((item) => {
    const candidates = [getStoryId(item), item.slug, item.title]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase());
    return candidates.includes(normalizedStory);
  }) || null;

  return match;
}

function focusRequestedAnnouncement(item) {
  if (!item) return;
  const storyId = getStoryId(item);
  state.targetedId = storyId;
  state.search = "";
  state.type = normalizeType(item.type);
  state.visibleCount = Math.max(state.announcements.length, 5);
  if (searchInput) searchInput.value = "";
  syncTypeDropdown(state.type);
  render();

  window.setTimeout(() => {
    const target = document.querySelector(`[data-announcement-id="${CSS.escape(storyId)}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (target) showAnnouncementDetail(item);
  }, 120);
}

async function loadAnnouncements(silent = false) {
  if (!silent) {
    setStatus("Loading the latest updates...", "fa-solid fa-spinner fa-spin");
  }
  try {
    const response = await fetch(`${API_BASE_URL}/announcements/public`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Announcements could not be loaded.");
    state.announcements = mergeAnnouncements(data.announcements);
    setStatus();
    renderEvents();
    const requestedAnnouncement = silent ? null : findAnnouncementByQuery();
    render();
    focusRequestedAnnouncement(requestedAnnouncement);
  } catch (error) {
    if (silent) return;
    state.announcements = [];
    setStatus("Live announcements are temporarily unavailable. Please try again shortly.", "fa-solid fa-circle-exclamation");
    renderEvents();
    featured?.replaceChildren();
    feed?.replaceChildren();
  }
}

searchInput?.addEventListener("input", (event) => {
  state.search = event.target.value.trim();
  state.visibleCount = 5;
  render();
});

typeSelect?.addEventListener("change", (event) => {
  applyTypeFilter(event.target.value);
});

typeToggle?.addEventListener("click", () => {
  if (typeSelectWrap?.classList.contains("is-open")) {
    closeTypeDropdown();
  } else {
    openTypeDropdown();
  }
});

typeMenu?.addEventListener("click", (event) => {
  const option = event.target.closest("[data-topic-value]");
  if (!option) return;
  applyTypeFilter(option.dataset.topicValue || "");
  closeTypeDropdown();
  typeToggle?.focus();
});

document.addEventListener("click", (event) => {
  if (!typeSelectWrap?.contains(event.target)) closeTypeDropdown();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeTypeDropdown();
});

document.querySelectorAll("[data-public-type]").forEach((button) => {
  button.addEventListener("click", () => {
    const selected = button.dataset.publicType || "";
    applyTypeFilter(state.type === selected ? "" : selected);
  });
});

document.querySelectorAll("[data-topic-search]").forEach((button) => {
  button.addEventListener("click", () => {
    const selected = button.dataset.topicSearch || "";
    applySearchFilter(state.search.toLowerCase() === selected ? "" : selected);
  });
});

showAllButton?.addEventListener("click", () => {
  const showingAll = state.action === "all" && state.visibleCount >= state.announcements.length;
  state.type = "";
  state.search = "";
  state.action = showingAll ? "" : "all";
  state.visibleCount = showingAll ? 5 : Math.max(state.announcements.length, 5);
  if (searchInput) searchInput.value = "";
  syncTypeDropdown("");
  document.getElementById("announcementsHeading")?.scrollIntoView({ behavior: "smooth", block: "start" });
  render();
});

document.getElementById("viewAllEventsBtn")?.addEventListener("click", () => {
  applyTypeFilter("Upcoming Events");
});

document.getElementById("pastAnnouncementsBtn")?.addEventListener("click", () => {
  state.type = "";
  state.search = "";
  state.action = "past";
  state.visibleCount = Math.max(state.announcements.length, 5);
  if (searchInput) searchInput.value = "";
  syncTypeDropdown("");
  document.getElementById("announcementsHeading")?.scrollIntoView({ behavior: "smooth", block: "start" });
  render();
});

let announcementsLoadStarted = false;

function startAnnouncementsLoad() {
  if (announcementsLoadStarted) return;
  announcementsLoadStarted = true;
  loadAnnouncements();
}

function scheduleInitialAnnouncementsLoad() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("story") || params.has("id") || params.has("type")) {
    startAnnouncementsLoad();
    return;
  }

  const section = document.querySelector(".announcements-section");
  if ("IntersectionObserver" in window && section) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        startAnnouncementsLoad();
      }
    }, { rootMargin: "260px 0px" });
    observer.observe(section);
  }

  ["pointerdown", "keydown", "touchstart"].forEach((eventName) => {
    window.addEventListener(eventName, startAnnouncementsLoad, { once: true, passive: true });
  });

  window.setTimeout(startAnnouncementsLoad, 8500);
}

scheduleInitialAnnouncementsLoad();

// Refresh when a visitor returns to this tab after management publishes or
// updates a post in another tab.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) loadAnnouncements(true);
});
