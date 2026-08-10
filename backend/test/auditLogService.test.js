const test = require("node:test");
const assert = require("node:assert/strict");

function loadSanitizerWithoutFirebase() {
  const firebasePath = require.resolve("../src/config/firebase");
  const servicePath = require.resolve("../src/services/auditLogService");
  const originalFirebaseModule = require.cache[firebasePath];

  require.cache[firebasePath] = {
    id: firebasePath,
    filename: firebasePath,
    loaded: true,
    exports: { db: {} },
  };
  delete require.cache[servicePath];

  try {
    return require(servicePath).sanitizeAuditValue;
  } finally {
    delete require.cache[servicePath];
    if (originalFirebaseModule) require.cache[firebasePath] = originalFirebaseModule;
    else delete require.cache[firebasePath];
  }
}

const sanitizeAuditValue = loadSanitizerWithoutFirebase();

test("UT-006 sanitizeAuditValue removes sensitive data and preserves usable audit fields", () => {
  const sanitized = sanitizeAuditValue({
    action: "account.updated",
    displayName: "Ana User",
    password: "Never log this",
    accessToken: "token-value",
    otpCode: "123456",
    clientSecret: "secret-value",
    nested: {
      authorization: "Bearer hidden",
      safeField: "kept",
    },
    entries: [
      { token: "hidden", itemId: "INV-001" },
      { credentialHash: "hidden", quantity: 2 },
    ],
  });

  assert.equal(sanitized.action, "account.updated");
  assert.equal(sanitized.displayName, "Ana User");
  assert.equal("password" in sanitized, false);
  assert.equal("accessToken" in sanitized, false);
  assert.equal("otpCode" in sanitized, false);
  assert.equal("clientSecret" in sanitized, false);
  assert.deepEqual(sanitized.nested, { safeField: "kept" });
  assert.deepEqual(sanitized.entries, [{ itemId: "INV-001" }, { quantity: 2 }]);
});

test("UT-006 sanitizeAuditValue enforces its current depth and array-size limits", () => {
  const deep = sanitizeAuditValue({
    level1: { level2: { level3: { level4: { level5: "too deep" } } } },
  });
  const longArray = sanitizeAuditValue(Array.from({ length: 25 }, (_, index) => index));

  assert.equal(deep.level1.level2.level3.level4.level5, "[Nested data omitted]");
  assert.equal(longArray.length, 20);
  assert.deepEqual(longArray, Array.from({ length: 20 }, (_, index) => index));
});
