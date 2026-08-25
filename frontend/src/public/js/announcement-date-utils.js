function parseDateOnly(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseEventDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    const copy = new Date(value.getTime());
    return Number.isNaN(copy.getTime()) ? null : copy;
  }

  if (typeof value === "string") {
    const dateOnly = parseDateOnly(value);
    if (dateOnly) return dateOnly;
  }

  if (typeof value === "object") {
    const seconds = value._seconds ?? value.seconds;
    if (Number.isFinite(Number(seconds))) {
      return new Date(Number(seconds) * 1000);
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isUpcomingEventDate(value, now = new Date()) {
  const eventDate = parseEventDate(value);
  if (!eventDate) return false;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  eventDate.setHours(0, 0, 0, 0);
  return eventDate.getTime() >= today.getTime();
}

export function compareEventDates(left, right) {
  const leftDate = parseEventDate(left);
  const rightDate = parseEventDate(right);
  return (leftDate?.getTime() ?? Number.POSITIVE_INFINITY)
    - (rightDate?.getTime() ?? Number.POSITIVE_INFINITY);
}
