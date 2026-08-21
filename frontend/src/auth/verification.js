import { API_BASE_URL } from "../utils/api.js";

export async function syncEmailVerification(user) {
  if (!user) return false;
  await user.reload();
  if (!user.emailVerified) return false;

  const firebaseIdToken = await user.getIdToken(true);
  const response = await fetch(`${API_BASE_URL}/auth/sync-email-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ firebaseIdToken }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Unable to synchronize email verification.");
  }
  return data.emailVerified === true;
}
