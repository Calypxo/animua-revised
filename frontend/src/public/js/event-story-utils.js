const normalizeIdentityText = (value = "") =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const eventDateValue = (event = {}) => {
  const value = event.date || event.eventDate || event.startDate || event.startsAt || event.startAt || "";
  if (value?.toDate) return value.toDate().getTime();
  if (value?._seconds) return value._seconds * 1000;
  if (value?.seconds) return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const eventCalendarDate = (event = {}) => {
  const value = event.date || event.eventDate || event.startDate || event.startsAt || event.startAt || "";
  if (typeof value === "string") {
    const datePrefix = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (datePrefix) return datePrefix[1];
  }

  const dateValue = eventDateValue(event);
  if (!dateValue) return "";
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const eventContentIdentity = (event = {}) => {
  const title = normalizeIdentityText(event.title || event.name);
  const calendarDate = eventCalendarDate(event);
  const location = normalizeIdentityText(event.location || event.venue || event.address);
  if (!title || !calendarDate) return "";

  return `${title}|${calendarDate}|${location}`;
};

/**
 * Keep one story for each real event even when it is returned by both the
 * announcements and events endpoints. The first item wins so callers can put
 * their preferred, richer source first.
 */
export function deduplicateEventStories(events = []) {
  const seenIds = new Set();
  const seenContent = new Set();

  return events.filter((event) => {
    const id = normalizeIdentityText(event?.id);
    const contentIdentity = eventContentIdentity(event);
    if ((id && seenIds.has(id)) || (contentIdentity && seenContent.has(contentIdentity))) {
      return false;
    }

    if (id) seenIds.add(id);
    if (contentIdentity) seenContent.add(contentIdentity);
    return true;
  });
}
