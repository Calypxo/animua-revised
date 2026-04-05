// admin-frontend/src/services/users.service.js
import { apiFetch } from "../utils/api.js";

/**
 * Fetch all users (Admin only).
 * GET /api/users
 */
export async function getAllUsers() {
  return await apiFetch("/users");
}

/**
 * Fetch a single user by email (doc ID).
 * GET /api/users/:id
 */
export async function getUserById(id) {
  const data = await apiFetch(`/users/${encodeURIComponent(id)}`);
  return data.user;
}

/**
 * Create a new Admin or Staff user.
 * POST /api/users
 */
export async function createUser(payload) {
  return await apiFetch("/users", {
    method: "POST",
    body:   JSON.stringify(payload),
  });
}

/**
 * Update an existing user's details and permissions.
 * PUT /api/users/:id
 */
export async function updateUser(id, payload) {
  return await apiFetch(`/users/${encodeURIComponent(id)}`, {
    method: "PUT",
    body:   JSON.stringify(payload),
  });
}

/**
 * Toggle a user's Active / Inactive status.
 * PATCH /api/users/:id/toggle-status
 */
export async function toggleUserStatus(id) {
  return await apiFetch(`/users/${encodeURIComponent(id)}/toggle-status`, {
    method: "PATCH",
  });
}

/**
 * Reset a user's password (Admin only).
 * PATCH /api/users/:id/reset-password
 */
export async function resetPassword(id, newPassword) {
  return await apiFetch(`/users/${encodeURIComponent(id)}/reset-password`, {
    method: "PATCH",
    body:   JSON.stringify({ newPassword }),
  });
}