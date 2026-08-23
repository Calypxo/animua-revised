import { API_BASE_URL } from "../utils/api.js";

const DB_NAME = "animua-admin-offline";
const DB_VERSION = 2;
const REQUEST_STORE = "requestQueue";
const ANNOUNCEMENT_STORE = "announcementQueue";

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

function withRequestStore(mode, callback) {
  return openOfflineDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(REQUEST_STORE, mode);
    const store = transaction.objectStore(REQUEST_STORE);
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

export function isAdminNetworkError(error) {
  if (!navigator.onLine) return true;
  if (error?.status) return false;

  const message = String(error?.message || "");
  return error instanceof TypeError ||
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("Unable to connect");
}

async function parseApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  let data = {};

  try {
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = text ? { message: text } : {};
    }
  } catch (error) {
    data = { message: `Failed to parse server response (${response.status})` };
  }

  if (!response.ok) {
    const error = new Error(data.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function replayRequest(item) {
  const response = await fetch(`${API_BASE_URL}${item.endpoint}`, {
    method: item.method,
    credentials: "include",
    headers: item.headers,
    body: item.body,
  });

  return parseApiResponse(response);
}

export async function queueAdminRequest(endpoint, options = {}) {
  const item = {
    id: `admin-request-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    endpoint,
    method: options.method || "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body || "",
    queuedAt: new Date().toISOString(),
    attempts: 0,
    lastError: "",
  };

  await withRequestStore("readwrite", (store) => store.put(item));
  return item;
}

export async function getQueuedAdminRequests() {
  const items = await withRequestStore("readonly", (store) => store.getAll());
  return (items || []).sort((left, right) => String(left.queuedAt).localeCompare(String(right.queuedAt)));
}

export async function deleteQueuedAdminRequest(id) {
  await withRequestStore("readwrite", (store) => store.delete(id));
}

export async function markQueuedAdminRequestAttempt(id, error) {
  const items = await getQueuedAdminRequests();
  const item = items.find((entry) => entry.id === id);
  if (!item) return;

  item.attempts = Number(item.attempts || 0) + 1;
  item.lastError = String(error?.message || error || "Sync failed.");
  item.lastAttemptAt = new Date().toISOString();
  await withRequestStore("readwrite", (store) => store.put(item));
}

export async function syncQueuedAdminRequests() {
  if (!navigator.onLine || syncQueuedAdminRequests.running) return;
  syncQueuedAdminRequests.running = true;

  try {
    const queued = await getQueuedAdminRequests();
    for (const item of queued) {
      try {
        await replayRequest(item);
        await deleteQueuedAdminRequest(item.id);
      } catch (error) {
        await markQueuedAdminRequestAttempt(item.id, error);
        if (isAdminNetworkError(error)) break;
      }
    }
  } catch (error) {
    console.error("Failed to sync queued admin requests:", error);
  } finally {
    syncQueuedAdminRequests.running = false;
  }
}

export async function queuedAdminApiFetch(endpoint, options = {}, fallbackData = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      credentials: "include",
    });
    return await parseApiResponse(response);
  } catch (error) {
    if (!isAdminNetworkError(error)) throw error;
    const queued = await queueAdminRequest(endpoint, options);
    return {
      offlineQueued: true,
      offlineQueueId: queued.id,
      ...fallbackData,
    };
  }
}

if ("addEventListener" in globalThis) {
  globalThis.addEventListener("online", syncQueuedAdminRequests);
  if (navigator.onLine) {
    setTimeout(syncQueuedAdminRequests, 1500);
  }
}
