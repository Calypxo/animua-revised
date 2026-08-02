import Swal from "sweetalert2";
import { API_BASE_URL } from "../../utils/api.js";

const HIGHLIGHT_NEWS_ALERT_IMAGE = new URL(
  "../../assets/images/highlight-news-alert-palit-an.png",
  import.meta.url
).href;
const NEWS_CCA_CAT_RESCUE_IMAGE = new URL(
  "../../assets/images/news-cca-cat-rescue.png",
  import.meta.url
).href;
const NEWS_BALIBAGO_DOG_RESCUE_IMAGE = new URL(
  "../../assets/images/news-balibago-dog-rescue.jpg",
  import.meta.url
).href;
const HIGHLIGHT_UPCOMING_EVENT_IMAGE = new URL(
  "../../assets/images/highlight-upcoming-event.jpg",
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

const HOMEPAGE_HIGHLIGHT_POSTS = [
  {
    id: "highlight-news-nepo-stray-cats",
    type: "News & Article",
    title: "Pag-rescue sa stray cats, nagpapatuloy sa Angeles City",
    caption:
      "Ipinagpatuloy ng Angeles City Veterinary Office ang stray cat rescue operation sa Nepo Mart bilang bahagi ng kanilang programa para sa animal welfare.",
    details: [
      "Ipinagpatuloy ng Angeles City Veterinary Office ang stray cat rescue operation sa Nepo Mart.",
      "Ligtas na dinala ang mga nahuling stray cat sa Angeles City Pound para sa observation at veterinary procedures.",
      "Hinihikayat ang mga Angeleno na maging responsableng pet owners at makibahagi sa animal welfare initiatives.",
    ],
    image: HIGHLIGHT_NEWS_ALERT_IMAGE,
    location: "Nepo Mart, Angeles City",
    publishedAt: "2026-07-21",
    source: "CLTV36 News",
  },
  {
    id: "highlight-news-cca-cat-rescue",
    type: "News & Article",
    title: "Stray cat rescue at CCA",
    caption:
      "Nagsagawa ng stray cat rescue operation ang Angeles City Veterinary Office sa City College of Angeles upang mapangalagaan ang mga ligaw na pusa.",
    details: [
      "Nagsagawa ng stray cat rescue operation ang Angeles City Veterinary Office sa City College of Angeles.",
      "Ligtas na nahuli at dinala sa Angeles City Pound ang mga stray cat upang mabigyan ng pagkalinga at serbisyong beterinaryo.",
      "Hinimok din ang mga Angeleno na isulong ang responsible pet ownership at i-report ang hayop na nangangailangan ng tulong.",
    ],
    image: NEWS_CCA_CAT_RESCUE_IMAGE,
    location: "City College of Angeles",
    publishedAt: "2026-07-20",
    source: "CLTV36 News",
  },
  {
    id: "highlight-news-balibago-dog-rescue",
    type: "News & Article",
    title: "Aso na-rescue sa Balibago",
    caption:
      "Sa gitna ng search and rescue operations sa gumuhong ginagawang gusali sa Balibago, isang aso ang nailigtas at inilipat sa ligtas na pangangalaga.",
    details: [
      "Ayon sa ulat sa construction site, ang aso ay biglang nakita na papalabas mula sa rubble habang nagsasagawa ng operasyon.",
      "Agad itong inasikaso at inilipat sa ligtas na pangangalaga ng mga rescuers.",
      "Isasailalim ang aso sa masusing check-up ng City Veterinary Office ng Angeles City.",
    ],
    image: NEWS_BALIBAGO_DOG_RESCUE_IMAGE,
    location: "Balibago, Angeles City",
    publishedAt: "2025-05-14",
    source: "Angeles City Information Office",
  },
  {
    id: "highlight-success-zach",
    type: "Success Stories",
    title: "Zach starts a new life",
    caption: "Rescued dog Zach is now starting a new life with his loving fur-parent.",
    details: [
      "Rescued dog Zach is now starting a new life with his loving fur-parent.",
      "Zach was adopted by Hamara Dela Cruz of Brgy. Ninoy Aquino.",
      "His adoption supports the Angeles City Government's Adopt, Don't Shop initiative.",
    ],
    image: SUCCESS_ZACH_ADOPTION_IMAGE,
    location: "Brgy. Ninoy Aquino",
    publishedAt: "2026-07-18",
    source: "Angeles City Dog Pound and Animal Shelter",
  },
  {
    id: "highlight-success-lolong",
    type: "Success Stories",
    title: "Lolong welcomed home",
    caption: "Rescued cat Lolong is now starting a new life with a loving fur-parent.",
    details: [
      "Rescued cat Lolong is now starting a new life with a loving fur-parent.",
      "Lolong was welcomed by Analyn Rivera of Brgy. Anunas.",
      "The Angeles City Dog Pound and Animal Shelter continues to help rescued pets find forever homes.",
    ],
    image: SUCCESS_LOLONG_ADOPTION_IMAGE,
    location: "Brgy. Anunas",
    publishedAt: "2026-07-17",
    source: "Angeles City Dog Pound and Animal Shelter",
  },
  {
    id: "highlight-success-whity",
    type: "Success Stories",
    title: "Whity finds a family",
    caption: "Rescued cat Whity is now starting a new life with a loving fur-parent.",
    details: [
      "Rescued cat Whity is now starting a new life with a loving fur-parent.",
      "Whity was adopted by Noel Agustin of Barangay Margot.",
      "This adoption is part of the city's continuing effort to promote responsible pet ownership.",
    ],
    image: SUCCESS_WHITY_ADOPTION_IMAGE,
    location: "Barangay Margot",
    publishedAt: "2026-07-16",
    source: "Angeles City Dog Pound and Animal Shelter",
  },
  {
    id: "highlight-success-marcia",
    type: "Success Stories",
    title: "Marcia finds care",
    caption: "Rescued cat Marcia is now starting a new life with a loving fur-parent.",
    details: [
      "Rescued cat Marcia is now starting a new life with a loving fur-parent.",
      "Marcia was welcomed by Analyn Rivera of Brgy. Anunas.",
      "The shelter gives rescued animals not just temporary care, but a chance at a forever home.",
    ],
    image: SUCCESS_MARCIA_ADOPTION_IMAGE,
    location: "Brgy. Anunas",
    publishedAt: "2026-07-15",
    source: "Angeles City Dog Pound and Animal Shelter",
  },
  {
    id: "demo-upcoming-event",
    type: "Upcoming Events",
    title: "Veterinary Services Brought Closer to Angelenos",
    caption:
      "The City of Angeles continues its free anti-rabies vaccination program to protect pets and help prevent the spread of rabies in local communities.",
    details: [
      "Free anti-rabies vaccination services will be brought closer to local communities.",
      "Pet owners are encouraged to prepare their pets and follow the guidance of the City Veterinary Office team.",
      "This program supports healthier pets and safer neighborhoods across Angeles City.",
    ],
    image: HIGHLIGHT_UPCOMING_EVENT_IMAGE,
    eventDate: "2026-08-16",
    eventTime: "9:00 AM - 3:00 PM",
    location: "Savannah Phase 1, Savannah Phase 2, and Green Plain Phase 3",
    publishedAt: "2026-08-02",
    source: "Angeles City Veterinary Office",
  },
];

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

document.querySelector("[data-login-link]")?.classList.toggle("hidden", localStorage.getItem("is_logged_in") === "true");

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[character]));
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
    showAllButton.hidden = state.announcements.length <= 5;
    showAllButton.querySelector("span").textContent = state.visibleCount >= filtered.length
      ? "View all announcements"
      : "View all announcements";
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

function showAnnouncementDetail(item) {
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

  Swal.fire({
    html: `
      <article class="announcement-detail">
        <span class="announcement-detail-handle" aria-hidden="true"></span>
        <div class="announcement-detail-kicker">${typeBadgeHtml(type, detailLabel)}</div>
        <h2>${escapeHtml(title)}</h2>
        <div class="announcement-detail-meta">
          <span><i class="fa-regular fa-calendar" aria-hidden="true"></i>${escapeHtml(getPostDate(item))}</span>
          <span>${escapeHtml(postedTime)}</span>
          <span><i class="fa-solid fa-building-columns" aria-hidden="true"></i>${escapeHtml(source)}</span>
        </div>
        <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}">
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
    showCloseButton: true,
    didOpen: (popup) => {
      popup.querySelector("[data-announcement-detail-close]")?.addEventListener("click", () => Swal.close());
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
      closeButton: "announcement-detail-close",
    },
    buttonsStyling: false,
  });
}

function typeBadgeHtml(type, label = "") {
  const config = TYPES[type];
  return `<span class="announcement-type type-${config.slug}"><i class="${config.icon}" aria-hidden="true"></i>${escapeHtml(label || config.label)}</span>`;
}

function mergeAnnouncements(items = []) {
  const backendItems = Array.isArray(items) ? items : [];
  const existingKeys = new Set(
    backendItems.map((item) => `${normalizeType(item.type)}::${String(item.title || "").toLowerCase().trim()}`)
  );
  const highlights = HOMEPAGE_HIGHLIGHT_POSTS.filter((item) => {
    const key = `${normalizeType(item.type)}::${String(item.title || "").toLowerCase().trim()}`;
    return !existingKeys.has(key);
  });

  return [...highlights, ...backendItems];
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

async function loadAnnouncements() {
  setStatus("Loading the latest updates...", "fa-solid fa-spinner fa-spin");
  try {
    const response = await fetch(`${API_BASE_URL}/announcements/public`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Announcements could not be loaded.");
    state.announcements = mergeAnnouncements(data.announcements);
    setStatus();
    renderEvents();
    const requestedAnnouncement = findAnnouncementByQuery();
    render();
    focusRequestedAnnouncement(requestedAnnouncement);
  } catch (error) {
    state.announcements = mergeAnnouncements();
    setStatus("Showing saved community highlights while live announcements are unavailable.", "fa-solid fa-circle-info");
    renderEvents();
    const requestedAnnouncement = findAnnouncementByQuery();
    render();
    focusRequestedAnnouncement(requestedAnnouncement);
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
  state.type = "";
  state.search = "";
  state.action = "all";
  state.visibleCount = Math.max(state.announcements.length, 5);
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

loadAnnouncements();
