const test = require("node:test");
const assert = require("node:assert/strict");

function loadAuthHelpersWithoutFirebase() {
  const firebasePath = require.resolve("../src/config/firebase");
  const middlewarePath = require.resolve("../src/middleware/authMiddleware");
  const controllerPath = require.resolve("../src/controllers/authController");
  const originalFirebaseModule = require.cache[firebasePath];
  const fakeUsers = new Map();
  const fakeDb = {
    collection(name) {
      if (name !== "users") throw new Error(`Unexpected collection: ${name}`);
      return {
        doc(email) {
          return {
            id: email,
            async get() {
              const value = fakeUsers.get(email);
              return { exists: Boolean(value), id: email, data: () => value };
            },
          };
        },
      };
    },
  };

  require.cache[firebasePath] = {
    id: firebasePath,
    filename: firebasePath,
    loaded: true,
    exports: { db: fakeDb, admin: {} },
  };

  delete require.cache[middlewarePath];
  delete require.cache[controllerPath];

  try {
    const middleware = require(middlewarePath);
    const controller = require(controllerPath);
    return {
      normalizeRole: middleware.normalizeRole,
      getBearerToken: middleware.getBearerToken,
      isSessionVersionCurrent: middleware.isSessionVersionCurrent,
      validateNewPasswordValue: controller.validateNewPasswordValue,
      isBcryptHash: controller.isBcryptHash,
      verifyStoredPassword: controller.verifyStoredPassword,
      getEmailCredentials: controller.getEmailCredentials,
      storeAndSendOtp: controller.storeAndSendOtp,
      isEligibleManagementUserData: controller.isEligibleManagementUserData,
      requestManagementPasswordResetOtp: controller.requestManagementPasswordResetOtp,
      login: controller.login,
      managementResetNeutralMessage: controller.MANAGEMENT_RESET_NEUTRAL_MESSAGE,
      setFakeUser(email, data) { fakeUsers.set(email, data); },
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
  isSessionVersionCurrent,
  validateNewPasswordValue,
  isBcryptHash,
  verifyStoredPassword,
  getEmailCredentials,
  storeAndSendOtp,
  isEligibleManagementUserData,
  requestManagementPasswordResetOtp,
  login,
  managementResetNeutralMessage,
  setFakeUser,
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

test("management login accepts and identifies legacy plaintext passwords for migration", async () => {
  const result = await verifyStoredPassword("LegacyPass1!", "LegacyPass1!");

  assert.deepEqual(result, { isMatch: true, needsRehash: true });
  assert.deepEqual(
    await verifyStoredPassword("wrong-password", "LegacyPass1!"),
    { isMatch: false, needsRehash: true }
  );
});

test("management login verifies bcrypt passwords without requesting migration", async () => {
  const bcrypt = require("bcryptjs");
  const passwordHash = await bcrypt.hash("SecurePass1!", 4);

  assert.equal(isBcryptHash(passwordHash), true);
  assert.deepEqual(
    await verifyStoredPassword("SecurePass1!", passwordHash),
    { isMatch: true, needsRehash: false }
  );
  assert.deepEqual(
    await verifyStoredPassword("wrong-password", passwordHash),
    { isMatch: false, needsRehash: false }
  );
});

test("valid management credentials on the public portal return management-only guidance", async () => {
  const bcrypt = require("bcryptjs");
  const email = "staff.portal@animua.test";
  setFakeUser(email, {
    email,
    fullName: "Portal Staff",
    role: "Staff",
    status: "Active",
    password: await bcrypt.hash("SecurePass1!", 4),
  });
  const response = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };

  await login({
    body: {
      email,
      password: "SecurePass1!",
      portal: "public",
    },
  }, response);

  assert.equal(response.statusCode, 403);
  assert.equal(response.payload.code, "MANAGEMENT_PORTAL_REQUIRED");
  assert.equal(
    response.payload.message,
    "This account is for management use only. Please sign in through the ANIMUA Management Portal.",
  );
});

test("email credentials accept deployment aliases and normalize Gmail app passwords", () => {
  assert.deepEqual(
    getEmailCredentials({
      SMTP_USER: "  mailer@animua.test ",
      EMAIL_APP_PASSWORD: "abcd efgh ijkl mnop",
    }),
    {
      user: "mailer@animua.test",
      pass: "abcdefghijklmnop",
    }
  );
});

test("failed OTP delivery removes the unusable stored code", async () => {
  const calls = [];
  const otpRef = {
    async set(data) {
      calls.push(["set", data]);
    },
    async delete() {
      calls.push(["delete"]);
    },
  };
  const deliveryError = new Error("provider unavailable");

  await assert.rejects(
    storeAndSendOtp({
      otpRef,
      otpData: { otpHash: "hash" },
      send: async () => {
        calls.push(["send"]);
        throw deliveryError;
      },
    }),
    deliveryError
  );

  assert.deepEqual(calls, [
    ["set", { otpHash: "hash" }],
    ["send"],
    ["delete"],
  ]);
});

test("successful OTP delivery keeps the stored code", async () => {
  const calls = [];
  const otpRef = {
    async set(data) {
      calls.push(["set", data]);
    },
    async delete() {
      calls.push(["delete"]);
    },
  };

  await storeAndSendOtp({
    otpRef,
    otpData: { otpHash: "hash" },
    send: async () => calls.push(["send"]),
  });

  assert.deepEqual(calls, [
    ["set", { otpHash: "hash" }],
    ["send"],
  ]);
});

test("management recovery eligibility is restricted to active management roles", () => {
  for (const role of ["Admin", "Staff", "Veterinarian", "Vet"]) {
    assert.equal(isEligibleManagementUserData({ role, status: "Active" }), true, role);
  }
  assert.equal(isEligibleManagementUserData({ role: "Public", status: "Active" }), false);
  assert.equal(isEligibleManagementUserData({ role: "Admin", status: "Inactive" }), false);
  assert.equal(isEligibleManagementUserData({ role: "Unknown", status: "Active" }), false);
});

test("session versions invalidate prior management tokens while preserving legacy version zero", () => {
  assert.equal(isSessionVersionCurrent({}, {}), true, "legacy token and account use version zero");
  assert.equal(isSessionVersionCurrent({ sessionVersion: 2 }, { sessionVersion: 2 }), true);
  assert.equal(isSessionVersionCurrent({ sessionVersion: 1 }, { sessionVersion: 2 }), false);
  assert.equal(isSessionVersionCurrent({}, { sessionVersion: 1 }), false);
});

test("management recovery request is enumeration-safe for unknown and public-only accounts", async () => {
  setFakeUser("public@animua.test", { role: "Public", status: "Active" });
  const invoke = async (email) => {
    const response = {
      statusCode: 200,
      payload: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.payload = payload; return this; },
    };
    await requestManagementPasswordResetOtp({ body: { email } }, response);
    return response;
  };
  const unknown = await invoke("unknown@animua.test");
  const publicOnly = await invoke("public@animua.test");
  assert.equal(unknown.statusCode, 200);
  assert.equal(publicOnly.statusCode, 200);
  assert.equal(unknown.payload.message, managementResetNeutralMessage);
  assert.equal(publicOnly.payload.message, managementResetNeutralMessage);
});
