const PRODUCTION_API_BASE_URL = "https://animua-backend.onrender.com/api";

const configuredApiBaseUrl = import.meta.env?.VITE_API_BASE_URL?.trim().replace(/\/+$/, "");

const currentHostname = globalThis.window?.location?.hostname || "localhost";
const isLocalHost =
  currentHostname === "localhost" ||
  currentHostname === "127.0.0.1";
const localApiBaseUrl = `http://${currentHostname}:5000/api`;

// Keep management and public pages on the same backend in every environment.
export const API_BASE_URL = isLocalHost
  ? (configuredApiBaseUrl || localApiBaseUrl)
  : (configuredApiBaseUrl || PRODUCTION_API_BASE_URL);

/**
 * Authenticated fetch wrapper.
 * The browser sends the HttpOnly session cookie; JavaScript never reads it.
 * Throws a structured error on non-2xx responses.
 *
 * @param {string} endpoint
 * @param {RequestInit} opts
 * @returns {Promise<any>}
 */
export async function apiFetch(endpoint, opts = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...opts,
    headers,
    credentials: "include",
  });

  const contentType = res.headers.get("content-type") || "";
  let data = {};

  try {
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = text ? { message: text } : {};
    }
  } catch (parseError) {
    data = { message: `Failed to parse server response (${res.status})` };
  }

  if (!res.ok) {
    const err = new Error(data.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
