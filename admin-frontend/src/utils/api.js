const LOCAL_API_BASE_URL = "http://localhost:5000/api";
const PRODUCTION_API_BASE_URL = "https://animua-backend.onrender.com/api";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "");

const isLocalHost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

// Keep management and public pages on the same backend in every environment.
export const API_BASE_URL = isLocalHost
  ? (configuredApiBaseUrl || LOCAL_API_BASE_URL)
  : (configuredApiBaseUrl || PRODUCTION_API_BASE_URL);

/**
 * Authenticated fetch wrapper.
 * Automatically attaches the Bearer token from localStorage.
 * Throws a structured error on non-2xx responses.
 *
 * @param {string} endpoint
 * @param {RequestInit} opts
 * @returns {Promise<any>}
 */
export async function apiFetch(endpoint, opts = {}) {
  const token = localStorage.getItem("animua_token");

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers || {}),
  };

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...opts,
    headers,
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
