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
      isBcryptHash: controller.isBcryptHash,
      verifyStoredPassword: controller.verifyStoredPassword,
      getEmailCredentials: controller.getEmailCredentials,
      storeAndSendOtp: controller.storeAndSendOtp,
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
  isBcryptHash,
  verifyStoredPassword,
  getEmailCredentials,
  storeAndSendOtp,
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
