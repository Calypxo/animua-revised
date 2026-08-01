const CONTACT_BADGE_CACHE_KEY = "animua_contact_message_count";
const CONTACT_BADGE_TTL_MS = 15 * 60_000;

function normalizeCount(value) {
  return Math.max(0, Number(value || 0));
}

export function readContactMessageCount() {
  try {
    const cached = JSON.parse(
      localStorage.getItem(CONTACT_BADGE_CACHE_KEY) || "null"
    );
    if (
      !cached ||
      Date.now() - Number(cached.savedAt || 0) > CONTACT_BADGE_TTL_MS
    ) {
      return null;
    }
    return normalizeCount(cached.count);
  } catch (_) {
    return null;
  }
}

export function cacheContactMessageCount(value) {
  const count = normalizeCount(value);
  localStorage.setItem(
    CONTACT_BADGE_CACHE_KEY,
    JSON.stringify({ count, savedAt: Date.now() })
  );

  window.dispatchEvent(
    new CustomEvent("animua:contact-count", { detail: { count } })
  );

  if (window.parent !== window) {
    window.parent.postMessage(
      { type: "animua:contact-count", count },
      window.location.origin
    );
  }

  return count;
}

export function isContactMessageCountStorageEvent(event) {
  return event.key === CONTACT_BADGE_CACHE_KEY;
}
