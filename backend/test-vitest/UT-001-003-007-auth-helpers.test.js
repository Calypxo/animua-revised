const bcrypt = require("bcryptjs");
const { loadWithMocks } = require("./helpers/commonjs");

const firebaseMock = { db: {}, admin: {} };
const middleware = loadWithMocks("../src/middleware/authMiddleware", {
  "../src/config/firebase": firebaseMock,
});
const controller = loadWithMocks("../src/controllers/authController", {
  "../src/config/firebase": firebaseMock,
});

describe("UT-001 — Backend Role Normalization", () => {
  const cases = [
    [1, "Admin", "Admin"],
    [2, " admin ", "Admin"],
    [3, "veterinarian", "Veterinarian"],
    [4, "Vet", "Veterinarian"],
    [5, "Shelter Owner", ""],
  ];
  it.each(cases)("Scenario %i — normalizeRole(%j) returns %j", (_scenario, input, expected) => {
    expect(middleware.normalizeRole(input)).toBe(expected);
  });
});

describe("UT-002 — Bearer Token Extraction", () => {
  const cases = [
    [1, { authorization: "Bearer valid.jwt.token" }, "valid.jwt.token"],
    [2, {}, ""],
    [3, { authorization: "Basic abc" }, ""],
    [4, { authorization: "bearer abc" }, ""],
    [5, { authorization: "Bearer abc extra" }, ""],
  ];
  it.each(cases)("Scenario %i — applies the exact Bearer parsing contract", (_scenario, headers, expected) => {
    expect(middleware.getBearerToken({ headers })).toBe(expected);
  });
});

describe("UT-003 — Password Policy Validation", () => {
  const invalid = [
    [2, "Aa1!"],
    [3, "password1!"],
    [4, "Password!"],
    [5, "Password1"],
  ];
  it("Scenario 1 — accepts ValidPass1!", () => {
    expect(controller.validateNewPasswordValue("ValidPass1!")).toBeNull();
  });
  it.each(invalid)("Scenario %i — rejects %j", (_scenario, input) => {
    expect(controller.validateNewPasswordValue(input)).toEqual(expect.objectContaining({ status: 400 }));
  });
});

describe("UT-007 — Stored Password and OTP Helpers", () => {
  it("Scenario 1 — verifies a correct bcrypt password without rehashing", async () => {
    const hash = await bcrypt.hash("SecurePass1!", 4);
    expect(controller.isBcryptHash(hash)).toBe(true);
    await expect(controller.verifyStoredPassword("SecurePass1!", hash)).resolves.toEqual({ isMatch: true, needsRehash: false });
  });

  it("Scenario 2 — rejects an incorrect bcrypt password without rehashing", async () => {
    const hash = await bcrypt.hash("SecurePass1!", 4);
    await expect(controller.verifyStoredPassword("wrong", hash)).resolves.toEqual({ isMatch: false, needsRehash: false });
  });

  it("Scenario 3 — identifies matching legacy plaintext for rehashing", async () => {
    await expect(controller.verifyStoredPassword("LegacyPass1!", "LegacyPass1!")).resolves.toEqual({ isMatch: true, needsRehash: true });
  });

  it("Scenario 4 — trims the SMTP user and removes all password whitespace", () => {
    expect(controller.getEmailCredentials({
      SMTP_USER: "  mailer@animua.test ",
      EMAIL_APP_PASSWORD: "abcd efgh ijkl mnop",
    })).toEqual({ user: "mailer@animua.test", pass: "abcdefghijklmnop" });
  });

  it("Scenario 5 — deletes a stored OTP when delivery fails", async () => {
    const otpRef = { set: vi.fn().mockResolvedValue(), delete: vi.fn().mockResolvedValue() };
    const failure = new Error("provider unavailable");
    await expect(controller.storeAndSendOtp({
      otpRef,
      otpData: { otpHash: "hash" },
      send: vi.fn().mockRejectedValue(failure),
    })).rejects.toBe(failure);
    expect(otpRef.set).toHaveBeenCalledWith({ otpHash: "hash" });
    expect(otpRef.delete).toHaveBeenCalledOnce();
  });
});
