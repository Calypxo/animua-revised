import { describe, expect, it, vi } from "vitest";
import {
  clearUserSession,
  isAuthenticationFailure,
} from "../src/utils/storage.js";

describe("UT-035 — Public Client Session Handling", () => {
  it("classifies a backend HTTP 401 as an authentication failure", () => {
    expect(isAuthenticationFailure({ status: 401 })).toBe(true);
  });

  it("retains compatibility with explicit token-expiry errors", () => {
    expect(isAuthenticationFailure(new Error("Token has expired. Please log in again.")))
      .toBe(true);
  });

  it("does not classify a non-authentication server failure as session expiry", () => {
    expect(isAuthenticationFailure({ status: 500, message: "Unable to load notifications." }))
      .toBe(false);
  });

  it("removes all local authentication state while preserving unrelated data", () => {
    const values = new Map([
      ["animua_token", "issued-token"],
      ["user_role", "Public"],
      ["user_name", "Client"],
      ["user_email", "client@example.test"],
      ["user_profile_photo", "data:image/png;base64,fixture"],
      ["is_logged_in", "true"],
      ["show_welcome_toast", "true"],
      ["sidebar_collapsed", "true"],
      ["unrelated_preference", "keep"],
    ]);
    const storage = {
      removeItem: vi.fn((key) => values.delete(key)),
    };

    clearUserSession(storage);

    expect([...values.entries()]).toEqual([["unrelated_preference", "keep"]]);
    expect(storage.removeItem).toHaveBeenCalledTimes(8);
  });
});
