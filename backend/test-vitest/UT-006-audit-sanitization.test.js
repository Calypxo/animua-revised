const { loadWithMocks } = require("./helpers/commonjs");

const { sanitizeAuditValue } = loadWithMocks("../src/services/auditLogService", {
  "../src/config/firebase": { db: {} },
});

describe("UT-006 — Audit Data Sanitization", () => {
  it("Scenario 1 — removes password and accessToken while retaining action", () => {
    expect(sanitizeAuditValue({ password: "secret", accessToken: "abc", action: "login" })).toEqual({ action: "login" });
  });
  it("Scenario 2 — sanitizes sensitive keys recursively", () => {
    expect(sanitizeAuditValue({ nested: { clientSecret: "secret", safeField: "value" } })).toEqual({ nested: { safeField: "value" } });
  });
  it("Scenario 3 — retains only the first 20 array entries", () => {
    expect(sanitizeAuditValue(Array.from({ length: 25 }, (_, index) => index))).toEqual(Array.from({ length: 20 }, (_, index) => index));
  });
  it("Scenario 4 — omits values passed beyond depth four", () => {
    const result = sanitizeAuditValue({ l1: { l2: { l3: { l4: { l5: "x" } } } } });
    expect(result.l1.l2.l3.l4.l5).toBe("[Nested data omitted]");
  });
  it("Scenario 5 — converts undefined to null", () => {
    expect(sanitizeAuditValue(undefined)).toBeNull();
  });
});
