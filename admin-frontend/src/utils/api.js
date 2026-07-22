// admin-frontend/src/utils/api.js
// render: "https://animua-backend.onrender.com/api"
// local:   "http://localhost:5000/api"
export const API_BASE_URL = "http://localhost:5000/api";

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