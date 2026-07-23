import { API_BASE_URL } from "../../utils/api.js";

const state = { announcements: [], search: "", type: "" };
const feed = document.getElementById("announcementFeed");
const status = document.getElementById("announcementStatus");
document.querySelector("[data-login-link]")?.classList.toggle("hidden", localStorage.getItem("is_logged_in") === "true");

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
  return date ? date.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "Recently published";
}

function eventDate(value) {
  if (!value) return "";
  const parts = String(value).split("-").map(Number);
  const date = parts.length === 3 ? new Date(parts[0], parts[1] - 1, parts[2]) : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-PH", { weekday: "short", year: "numeric", month: "long", day: "numeric" });
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

function meta(icon, text) {
  const item = document.createElement("span");
  const iconNode = document.createElement("i");
  iconNode.className = icon;
  item.append(iconNode, document.createTextNode(text));
  return item;
}

function card(item) {
  const article = document.createElement("article");
  article.className = "public-announcement-card";
  if (item.imageUrl) {
    const media = document.createElement("div");
    media.className = "announcement-card-media";
    const image = document.createElement("img");
    image.src = item.imageUrl;
    image.alt = item.title ? `${item.title} cover` : "Announcement cover";
    image.loading = "lazy";
    image.addEventListener("error", () => media.remove());
    media.appendChild(image);
    article.appendChild(media);
  }

  const body = document.createElement("div");
  body.className = "announcement-card-body";
  const heading = document.createElement("div");
  heading.className = "announcement-card-heading";
  const badge = document.createElement("span");
  const type = item.type || "Announcement";
  badge.className = `announcement-type type-${type.toLowerCase()}`;
  badge.textContent = type;
  const time = document.createElement("time");
  time.textContent = publishedDate(item.createdAt);
  const date = toDate(item.createdAt);
  if (date) time.dateTime = date.toISOString();
  heading.append(badge, time);

  const title = document.createElement("h3");
  title.textContent = item.title || "ANIMUA update";
  const copy = document.createElement("p");
  copy.textContent = item.caption || "";
  body.append(heading, title, copy);

  if (item.eventDate || item.location) {
    const details = document.createElement("div");
    details.className = "announcement-event-meta";
    if (item.eventDate) details.appendChild(meta("fa-regular fa-calendar", eventDate(item.eventDate)));
    if (item.location) details.appendChild(meta("fa-solid fa-location-dot", item.location));
    body.appendChild(details);
  }
  article.appendChild(body);
  return article;
}

function render() {
  if (!feed) return;
  const term = state.search.toLowerCase();
  const filtered = state.announcements.filter((item) => {
    const content = `${item.title || ""} ${item.caption || ""} ${item.location || ""}`.toLowerCase();
    return (!state.type || item.type === state.type) && (!term || content.includes(term));
  });
  feed.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "announcement-empty";
    const icon = document.createElement("i");
    icon.className = "fa-regular fa-newspaper";
    const heading = document.createElement("h3");
    heading.textContent = state.search || state.type ? "No matching updates" : "No public announcements yet";
    const copy = document.createElement("p");
    copy.textContent = state.search || state.type ? "Try a different search or choose all updates." : "Published updates from ANIMUA management will appear here.";
    empty.append(icon, heading, copy);
    feed.appendChild(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  filtered.forEach((item) => fragment.appendChild(card(item)));
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
    render();
  } catch (error) {
    feed?.replaceChildren();
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

loadAnnouncements();
