import { API_BASE_URL } from "../../utils/api.js";

const TYPES = {
  "News & Article": { icon: "fa-regular fa-newspaper", slug: "news" },
  "Success Stories": { icon: "fa-solid fa-heart", slug: "success" },
  "Upcoming Events": { icon: "fa-regular fa-calendar-check", slug: "event" },
};

const today = new Date();
const state = {
  announcements: [],
  search: "",
  type: "",
  calendarMonth: new Date(today.getFullYear(), today.getMonth(), 1),
  selectedEventDate: "",
  calendarInitialized: false,
};
const feed = document.getElementById("announcementFeed");
const featured = document.getElementById("featuredAnnouncement");
const status = document.getElementById("announcementStatus");
const eventList = document.getElementById("upcomingEventList");
const calendarGrid = document.getElementById("publicCalendarGrid");
const calendarMonth = document.getElementById("publicCalendarMonth");

document.querySelector("[data-login-link]")?.classList.toggle("hidden", localStorage.getItem("is_logged_in") === "true");

function normalizeType(value) {
  const type = String(value || "").toLowerCase().trim();
  if (type.includes("event")) return "Upcoming Events";
  if (type.includes("success")) return "Success Stories";
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
    : "Recently published";
}

function parseEventDate(value) {
  if (!value) return "";
  const parts = String(value).split("-").map(Number);
  const date = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function eventDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function eventDate(value, compact = false) {
  const date = value instanceof Date ? value : parseEventDate(value);
  if (!date) return value ? String(value) : "";
  return date.toLocaleDateString("en-PH", compact
    ? { month: "short", day: "numeric" }
    : { weekday: "short", year: "numeric", month: "long", day: "numeric" });
}

function calendarEvents() {
  return state.announcements
    .filter((item) => normalizeType(item.type) === "Upcoming Events")
    .map((item) => ({ ...item, calendarDate: parseEventDate(item.eventDate) }))
    .filter((item) => item.calendarDate)
    .sort((left, right) => left.calendarDate - right.calendarDate);
}

function initializeCalendar(events) {
  if (state.calendarInitialized) return;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nextEvent = events.find((item) => item.calendarDate >= todayStart) || events[0];

  if (nextEvent) {
    state.calendarMonth = new Date(
      nextEvent.calendarDate.getFullYear(),
      nextEvent.calendarDate.getMonth(),
      1
    );
    state.selectedEventDate = eventDateKey(nextEvent.calendarDate);
  } else {
    state.selectedEventDate = eventDateKey(todayStart);
  }
  state.calendarInitialized = true;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setStatus(message = "", icon = "") {
  if (!status) return;
  status.hidden = !message;
  status.replaceChildren();
  if (!message) return;

  if (icon) {
    const iconNode = document.createElement("i");
    iconNode.className = icon;
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
  badge.append(icon(config.icon), document.createTextNode(normalized));
  return badge;
}

function metaItem(iconClass, text) {
  const item = document.createElement("span");
  item.append(icon(iconClass), document.createTextNode(text));
  return item;
}

function createMedia(item, type) {
  const media = document.createElement("div");
  media.className = `announcement-card-media media-${TYPES[type].slug}`;

  if (item.imageUrl) {
    const image = document.createElement("img");
    image.src = item.imageUrl;
    image.alt = item.title ? `${item.title} cover` : `${type} cover`;
    image.loading = "lazy";
    image.addEventListener("error", () => {
      image.remove();
      media.classList.add("is-placeholder");
      media.append(icon(TYPES[type].icon));
    });
    media.appendChild(image);
  } else {
    media.classList.add("is-placeholder");
    media.append(icon(TYPES[type].icon));
  }

  return media;
}

function createPost(item, { isFeatured = false } = {}) {
  const type = normalizeType(item.type);
  const article = document.createElement("article");
  article.className = `public-announcement-card${isFeatured ? " is-featured" : ""}`;
  article.appendChild(createMedia(item, type));

  const body = document.createElement("div");
  body.className = "announcement-card-body";

  const author = document.createElement("div");
  author.className = "public-post-author";
  const avatar = document.createElement("span");
  avatar.className = "public-post-avatar";
  avatar.append(icon("fa-solid fa-heart-pulse"));
  const authorCopy = document.createElement("span");
  const authorName = document.createElement("strong");
  authorName.textContent = "ANIMUA Angeles City";
  const authorMeta = document.createElement("small");
  authorMeta.textContent = `${publishedDate(item.createdAt)} · Public`;
  authorCopy.append(authorName, authorMeta);
  author.append(avatar, authorCopy);

  const heading = document.createElement("div");
  heading.className = "announcement-card-heading";
  heading.appendChild(typeBadge(type));

  const title = document.createElement(isFeatured ? "h2" : "h3");
  title.textContent = item.title || "ANIMUA community update";
  const copy = document.createElement("p");
  copy.textContent = item.caption || "";
  body.append(author, heading, title, copy);

  if (type === "Upcoming Events" && (item.eventDate || item.location)) {
    const details = document.createElement("div");
    details.className = "announcement-event-meta";
    if (item.eventDate) details.appendChild(metaItem("fa-regular fa-calendar", eventDate(item.eventDate)));
    if (item.location) details.appendChild(metaItem("fa-solid fa-location-dot", item.location));
    body.appendChild(details);
  }

  const footer = document.createElement("div");
  footer.className = "public-post-footer";
  footer.append(
    metaItem("fa-regular fa-bookmark", "Official community post"),
    metaItem("fa-solid fa-arrow-up-right-from-square", isFeatured ? "Featured update" : "ANIMUA feed")
  );
  body.appendChild(footer);
  article.appendChild(body);
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

function renderEvents() {
  if (!eventList || !calendarGrid || !calendarMonth) return;
  eventList.replaceChildren();
  const events = calendarEvents();
  initializeCalendar(events);

  const month = state.calendarMonth;
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const monthEvents = events.filter(
    (item) =>
      item.calendarDate.getFullYear() === year &&
      item.calendarDate.getMonth() === monthIndex
  );
  const byDate = new Map();
  monthEvents.forEach((item) => {
    const key = eventDateKey(item.calendarDate);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(item);
  });

  calendarMonth.textContent = month.toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
  });
  calendarGrid.setAttribute("aria-label", `${calendarMonth.textContent} important event calendar`);
  calendarGrid.replaceChildren();

  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((weekday) => {
    const label = document.createElement("span");
    label.textContent = weekday;
    label.setAttribute("aria-hidden", "true");
    calendarGrid.appendChild(label);
  });

  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const todayKey = eventDateKey(new Date());

  for (let index = 0; index < 42; index += 1) {
    const dayNumber = index - firstWeekday + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      const empty = document.createElement("em");
      empty.setAttribute("aria-hidden", "true");
      calendarGrid.appendChild(empty);
      continue;
    }

    const date = new Date(year, monthIndex, dayNumber);
    const key = eventDateKey(date);
    const dayEvents = byDate.get(key) || [];
    const day = document.createElement("button");
    day.type = "button";
    day.dataset.calendarDate = key;
    day.textContent = dayNumber;
    day.classList.toggle("is-event", dayEvents.length > 0);
    day.classList.toggle("is-activity", key === state.selectedEventDate);
    day.classList.toggle("is-today", key === todayKey);
    day.setAttribute("aria-pressed", String(key === state.selectedEventDate));
    day.setAttribute(
      "aria-label",
      `${eventDate(date)}${dayEvents.length ? `, ${dayEvents.length} important event${dayEvents.length === 1 ? "" : "s"}` : ""}`
    );
    calendarGrid.appendChild(day);
  }

  const selectedEvents = state.selectedEventDate
    ? byDate.get(state.selectedEventDate) || []
    : monthEvents;

  if (!selectedEvents.length) {
    const message = document.createElement("p");
    message.className = "no-upcoming-events";
    message.textContent = monthEvents.length
      ? "Select a highlighted date to see its important events."
      : "No important events are scheduled for this month.";
    eventList.appendChild(message);
    return;
  }

  selectedEvents.slice(0, 4).forEach((item) => {
    const row = document.createElement("article");
    row.className = "upcoming-event-row";
    const date = document.createElement("time");
    date.textContent = item.eventDate ? eventDate(item.eventDate, true) : "Soon";
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = item.title || "ANIMUA event";
    const location = document.createElement("small");
    location.textContent = item.location || "Angeles City";
    copy.append(title, location);
    row.append(date, copy);
    eventList.appendChild(row);
  });
}

function moveCalendar(offset) {
  state.calendarMonth = new Date(
    state.calendarMonth.getFullYear(),
    state.calendarMonth.getMonth() + offset,
    1
  );
  const firstEvent = calendarEvents().find(
    (item) =>
      item.calendarDate.getFullYear() === state.calendarMonth.getFullYear() &&
      item.calendarDate.getMonth() === state.calendarMonth.getMonth()
  );
  state.selectedEventDate = firstEvent ? eventDateKey(firstEvent.calendarDate) : "";
  renderEvents();
}

function updateStats() {
  setText("publicPostCount", state.announcements.length);
  setText("publicStoryCount", state.announcements.filter((item) => normalizeType(item.type) === "Success Stories").length);
  setText("publicEventCount", state.announcements.filter((item) => normalizeType(item.type) === "Upcoming Events").length);
}

function render() {
  if (!feed || !featured) return;
  const term = state.search.toLowerCase();
  const filtered = state.announcements.filter((item) => {
    const content = `${item.title || ""} ${item.caption || ""} ${item.location || ""}`.toLowerCase();
    return (!state.type || normalizeType(item.type) === state.type) && (!term || content.includes(term));
  });

  document.querySelectorAll("[data-public-type]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.publicType === state.type);
  });
  setText("feedResultLabel", state.type || (state.search ? `Results for “${state.search}”` : "All community content"));

  featured.replaceChildren();
  feed.replaceChildren();

  if (!filtered.length) {
    featured.appendChild(emptyState());
    return;
  }

  featured.appendChild(createPost(filtered[0], { isFeatured: true }));
  const fragment = document.createDocumentFragment();
  filtered.slice(1).forEach((item) => fragment.appendChild(createPost(item)));
  feed.appendChild(fragment);
}

async function loadAnnouncements() {
  setStatus("Loading the latest updates...", "fa-solid fa-spinner fa-spin");
  try {
    const response = await fetch(`${API_BASE_URL}/announcements/public`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Announcements could not be loaded.");
    state.announcements = Array.isArray(data.announcements) ? data.announcements : [];
    setStatus();
    updateStats();
    renderEvents();
    render();
  } catch (error) {
    feed?.replaceChildren();
    featured?.replaceChildren();
    setStatus(error.message || "Announcements could not be loaded. Please try again later.", "fa-solid fa-circle-exclamation");
  }
}

document.getElementById("announcementSearch")?.addEventListener("input", (event) => {
  state.search = event.target.value.trim();
  render();
});

document.getElementById("announcementType")?.addEventListener("change", (event) => {
  state.type = event.target.value;
  render();
});

document.querySelectorAll("[data-public-type]").forEach((button) => {
  button.addEventListener("click", () => {
    const selected = button.dataset.publicType || "";
    state.type = state.type === selected ? "" : selected;
    document.getElementById("announcementType").value = state.type;
    document.getElementById("announcementsHeading")?.scrollIntoView({ behavior: "smooth", block: "start" });
    render();
  });
});

document.getElementById("showAllAnnouncements")?.addEventListener("click", () => {
  state.type = "";
  state.search = "";
  const search = document.getElementById("announcementSearch");
  const type = document.getElementById("announcementType");
  if (search) search.value = "";
  if (type) type.value = "";
  document.getElementById("announcementsHeading")?.scrollIntoView({ behavior: "smooth", block: "start" });
  render();
});

document.getElementById("publicCalendarPrev")?.addEventListener("click", () => moveCalendar(-1));
document.getElementById("publicCalendarNext")?.addEventListener("click", () => moveCalendar(1));
calendarGrid?.addEventListener("click", (event) => {
  const day = event.target.closest("[data-calendar-date]");
  if (!day) return;
  state.selectedEventDate = day.dataset.calendarDate || "";
  renderEvents();
});
document.getElementById("showCalendarEvents")?.addEventListener("click", () => {
  state.type = "Upcoming Events";
  state.search = "";
  const search = document.getElementById("announcementSearch");
  const type = document.getElementById("announcementType");
  if (search) search.value = "";
  if (type) type.value = state.type;
  document.getElementById("announcementsHeading")?.scrollIntoView({ behavior: "smooth", block: "start" });
  render();
});

loadAnnouncements();
