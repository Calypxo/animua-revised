const DB_NAME = "animua-public-offline";
const DB_VERSION = 1;
const QUEUE_STORE = "requestQueue";

function openOfflineDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) {
      reject(new Error("Offline storage is not available in this browser."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
        store.createIndex("type", "type");
        store.createIndex("queuedAt", "queuedAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open offline storage."));
  });
}

function withQueueStore(mode, callback) {
  return openOfflineDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(QUEUE_STORE, mode);
    const store = transaction.objectStore(QUEUE_STORE);
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

export function isNetworkError(error) {
  if (!navigator.onLine) return true;
  if (error?.status) return false;

  const message = String(error?.message || "");
  return error instanceof TypeError ||
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("Unable to connect") ||
    message.includes("could not reach");
}

export async function queuePublicRequest(type, payload) {
  const item = {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    type,
    payload,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    lastError: "",
  };

  await withQueueStore("readwrite", (store) => store.put(item));
  return item;
}

export async function getQueuedPublicRequests(type = "") {
  const items = await withQueueStore("readonly", (store) => store.getAll());
  return (items || [])
    .filter((item) => !type || item.type === type)
    .sort((left, right) => String(left.queuedAt).localeCompare(String(right.queuedAt)));
}

export async function deleteQueuedPublicRequest(id) {
  await withQueueStore("readwrite", (store) => store.delete(id));
}

export async function markQueuedPublicRequestAttempt(id, error) {
  const items = await getQueuedPublicRequests();
  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  item.attempts = Number(item.attempts || 0) + 1;
  item.lastError = String(error?.message || error || "Sync failed.");
  item.lastAttemptAt = new Date().toISOString();

  await withQueueStore("readwrite", (store) => store.put(item));
}
