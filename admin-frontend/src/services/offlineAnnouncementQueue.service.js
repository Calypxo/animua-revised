const DB_NAME = "animua-admin-offline";
const DB_VERSION = 2;
const ANNOUNCEMENT_STORE = "announcementQueue";
const REQUEST_STORE = "requestQueue";

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) {
      reject(new Error("Offline storage is not available in this browser."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ANNOUNCEMENT_STORE)) {
        const store = db.createObjectStore(ANNOUNCEMENT_STORE, { keyPath: "id" });
        store.createIndex("queuedAt", "queuedAt");
      }
      if (!db.objectStoreNames.contains(REQUEST_STORE)) {
        const store = db.createObjectStore(REQUEST_STORE, { keyPath: "id" });
        store.createIndex("queuedAt", "queuedAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open offline storage."));
  });
}

function withAnnouncementStore(mode, callback) {
  return openOfflineDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(ANNOUNCEMENT_STORE, mode);
    const store = transaction.objectStore(ANNOUNCEMENT_STORE);
    const request = callback(store);

    transaction.oncomplete = () => {
      db.close();
      resolve(request?.result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("Offline storage transaction failed."));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error("Offline storage transaction was cancelled."));
    };
  }));
}

export function isNetworkSaveError(error) {
  if (!navigator.onLine) return true;
  if (error?.status) return false;

  const message = String(error?.message || "");
  return error instanceof TypeError ||
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("Unable to connect");
}

export async function queueAnnouncementSave({
  action,
  remoteId = "",
  payload,
  imageFile = null,
  imageAction = "none",
}) {
  const id = `announcement-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const item = {
    id,
    action,
    remoteId,
    payload,
    imageFile,
    imageAction,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    lastError: "",
  };

  await withAnnouncementStore("readwrite", (store) => store.put(item));
  return item;
}

export async function getQueuedAnnouncementSaves() {
  const items = await withAnnouncementStore("readonly", (store) => store.getAll());
  return (items || []).sort((left, right) => String(left.queuedAt).localeCompare(String(right.queuedAt)));
}

export async function deleteQueuedAnnouncementSave(id) {
  await withAnnouncementStore("readwrite", (store) => store.delete(id));
}

export async function markQueuedAnnouncementAttempt(id, error) {
  const items = await getQueuedAnnouncementSaves();
  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  item.attempts = Number(item.attempts || 0) + 1;
  item.lastError = String(error?.message || error || "Sync failed.");
  item.lastAttemptAt = new Date().toISOString();

  await withAnnouncementStore("readwrite", (store) => store.put(item));
}
