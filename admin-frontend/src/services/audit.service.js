// admin-frontend/src/services/audit.service.js
import {
  apiFetch,
} from "../utils/api.js";

/**
 * Fetch recent audit trail records.
 * Admin only.
 */
export async function getAuditLogs(
  limit = 500
) {
  const safeLimit = Math.min(
    Math.max(
      Number(limit) || 500,
      1
    ),
    1000
  );

  const data = await apiFetch(
    `/audit?limit=${safeLimit}`
  );

  if (!Array.isArray(data?.logs)) {
    throw new Error(
      "The audit service returned an invalid response."
    );
  }

  return data.logs;
}
