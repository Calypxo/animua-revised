const test = require("node:test");
const assert = require("node:assert/strict");

function loadAuthHelpersWithoutFirebase() {
  const firebasePath = require.resolve("../src/config/firebase");
  const middlewarePath = require.resolve("../src/middleware/authMiddleware");
  const controllerPath = require.resolve("../src/controllers/authController");
  const originalFirebaseModule = require.cache[firebasePath];

  require.cache[firebasePath] = {
    id: firebasePath,
    filename: firebasePath,
    loaded: true,
    exports: { db: {}, admin: {} },
  };

  delete require.cache[middlewarePath];
  delete require.cache[controllerPath];

  try {
    const middleware = require(middlewarePath);
    const controller = require(controllerPath);
    return {
      normalizeRole: middleware.normalizeRole,
      getBearerToken: middleware.getBearerToken,
      validateNewPasswordValue: controller.validateNewPasswordValue,
    };
  } finally {
    delete require.cache[middlewarePath];
    delete require.cache[controllerPath];
    if (originalFirebaseModule) require.cache[firebasePath] = originalFirebaseModule;
    else delete require.cache[firebasePath];
  }
}

const {
  normalizeRole,
  getBearerToken,
  validateNewPasswordValue,
} = loadAuthHelpersWithoutFirebase();

test("UT-001 normalizeRole recognizes only canonical ANIMUA roles", () => {
  const scenarios = [
    ["Admin", "Admin"],
    ["admin", "Admin"],
    ["Staff", "Staff"],
    ["veterinarian", "Veterinarian"],
    ["Vet", "Veterinarian"],
    ["Public", "Public"],
    ["Shelter Owner", ""],
  ];

  for (const [input, expected] of scenarios) {
    assert.equal(normalizeRole(input), expected, input);
  }
});

test("UT-002 getBearerToken accepts only one correctly formatted Bearer token", () => {
  const scenarios = [
    [{ authorization: "Bearer valid.jwt.token" }, "valid.jwt.token", "valid Bearer token"],
    [{}, "", "missing Authorization header"],
    [{ authorization: "Basic dXNlcjpwYXNz" }, "", "wrong authentication scheme"],
    [{ authorization: "Bearer" }, "", "Bearer with no token"],
    [{ authorization: "Bearervalid.jwt.token" }, "", "malformed header without separator"],
    [{ authorization: "Bearer valid.jwt.token extra" }, "", "malformed header with extra value"],
  ];

  for (const [headers, expected, label] of scenarios) {
    assert.equal(getBearerToken({ headers }), expected, label);
  }
});

test("UT-003 validateNewPasswordValue enforces the implemented password policy", () => {
  const policyMessage = "New password must be at least 8 characters and include uppercase, lowercase, number, and special character.";
  const required = { status: 400, message: "New password is required." };

  assert.deepEqual(validateNewPasswordValue(undefined), required, "missing password");
  assert.deepEqual(validateNewPasswordValue(""), required, "empty password");
  assert.deepEqual(validateNewPasswordValue("Aa1!"), { status: 400, message: policyMessage }, "weak/short password");
  assert.deepEqual(validateNewPasswordValue("PASSWORD1!"), { status: 400, message: policyMessage }, "missing lowercase");
  assert.deepEqual(validateNewPasswordValue("password1!"), { status: 400, message: policyMessage }, "missing uppercase");
  assert.deepEqual(validateNewPasswordValue("Password!"), { status: 400, message: policyMessage }, "missing number");
  assert.deepEqual(validateNewPasswordValue("Password1"), { status: 400, message: policyMessage }, "missing special character");
  assert.deepEqual(
    validateNewPasswordValue(`Aa1!${"x".repeat(125)}`),
    { status: 400, message: "Password must not exceed 128 characters." },
    "password over 128 characters"
  );
  assert.equal(validateNewPasswordValue("ValidPass1!"), null, "valid password");
});
