const BASELINE_RESET_COMMAND = "npm --prefix backend run ft:baseline:reset";
const BASELINE_VERIFY_COMMAND = "npm --prefix backend run ft:baseline:verify";
const ENVIRONMENT_CHECK_COMMAND = "npm run check:functionality:config";
const COMMAND_TIMEOUT = 120000;

const ROLE_CREDENTIALS = {
  Public: ["FT_CLIENT_ACTIVE_EMAIL", "FT_PUBLIC_PASSWORD"],
  PublicMutable: ["FT_CLIENT_PROFILE_MUTABLE_EMAIL", "FT_PUBLIC_PASSWORD"],
  PublicQuizEligible: ["FT_CLIENT_QUIZ_ELIGIBLE_EMAIL", "FT_PUBLIC_PASSWORD"],
  PublicNotifications: ["FT_CLIENT_NOTIFICATIONS_EMAIL", "FT_PUBLIC_PASSWORD"],
  Admin: ["FT_ADMIN_ACTIVE_EMAIL", "FT_MANAGEMENT_PASSWORD"],
  Staff: ["FT_STAFF_ACTIVE_EMAIL", "FT_MANAGEMENT_PASSWORD"],
  Veterinarian: ["FT_VET_ACTIVE_EMAIL", "FT_MANAGEMENT_PASSWORD"],
  ManagementMutable: ["FT_MANAGEMENT_PROFILE_MUTABLE_EMAIL", "FT_MANAGEMENT_PASSWORD"],
};

function requiredEnvironmentValue(name) {
  const value = Cypress.env(name);
  if (!value) throw new Error(`Integration testing requires Cypress environment value ${name}.`);
  return value;
}

function apiUrl(path) {
  const baseUrl = String(Cypress.env("apiBaseUrl") || "").replace(/\/+$/, "");
  if (!baseUrl) throw new Error("Integration testing requires Cypress environment value apiBaseUrl.");
  return `${baseUrl}/${String(path || "").replace(/^\/+/, "")}`;
}

function authorizationHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function sessionTokenFromResponse(response) {
  const setCookieHeaders = [].concat(response.headers?.["set-cookie"] || []);
  const sessionHeader = setCookieHeaders.find((header) =>
    /^(?:__Host-)?animua_session=/.test(String(header)),
  );
  const encodedToken = String(sessionHeader || "")
    .split(";", 1)[0]
    .split("=")
    .slice(1)
    .join("=");

  return encodedToken ? decodeURIComponent(encodedToken) : "";
}

function apiRequest({ method = "GET", path, token, body, ...options }) {
  return cy.request({
    method,
    url: apiUrl(path),
    headers: authorizationHeaders(token),
    body,
    failOnStatusCode: false,
    ...options,
  });
}

function loginByApi(role) {
  const variables = ROLE_CREDENTIALS[role];
  if (!variables) throw new Error(`Unsupported integration-test role: ${role}.`);
  const [emailVariable, passwordVariable] = variables;
  const email = requiredEnvironmentValue(emailVariable);
  const password = requiredEnvironmentValue(passwordVariable);

  return apiRequest({
    method: "POST",
    path: "auth/login",
    body: { email, password },
    log: false,
  }).then((response) => {
    expect(response.status, `real ANIMUA ${role} login`).to.equal(200);
    expect(response.body?.token, `${role} JWT is not exposed in JSON`).to.be.undefined;
    const token = sessionTokenFromResponse(response);
    expect(token, `${role} HttpOnly session JWT`)
      .to.be.a("string")
      .and.not.be.empty;
    return { email, token };
  });
}

function firebasePasswordSignIn(email, password) {
  const apiKey = requiredEnvironmentValue("VITE_FIREBASE_API_KEY");
  return cy.request({
    method: "POST",
    url: `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    body: { email, password, returnSecureToken: true },
    failOnStatusCode: false,
    log: false,
  });
}

function uploadFtAnnouncementImage(token, variant) {
  return cy.task("uploadFtAnnouncementImage", {
    primaryId: "FT_ANNOUNCEMENT_DRAFT",
    token,
    variant,
  }, { timeout: COMMAND_TIMEOUT });
}

function inspectFtAnnouncementImage(storagePath = "") {
  return cy.task("inspectFtAnnouncementImage", {
    primaryId: "FT_ANNOUNCEMENT_DRAFT",
    storagePath,
  }, { timeout: COMMAND_TIMEOUT });
}

function assertCommandPassed(result, expectedOutput, label) {
  expect(result?.stdout, label).to.include(expectedOutput);
}

function resetAndVerifyBaseline() {
  let resetResult;
  let verifyResult;
  return cy
    .exec(BASELINE_RESET_COMMAND, { timeout: COMMAND_TIMEOUT })
    .then((result) => {
      resetResult = result;
      return cy.exec(BASELINE_VERIFY_COMMAND, { timeout: COMMAND_TIMEOUT });
    })
    .then((result) => {
      verifyResult = result;
      assertCommandPassed(resetResult, "Reset: PASSED", "FT_BASELINE_V1 reset");
      assertCommandPassed(verifyResult, "Verification: PASSED", "FT_BASELINE_V1 verification");
      expect(verifyResult.stdout).to.include(
        "Generated Firestore records pending cleanup: 0/0",
      );
      return { resetResult, verifyResult };
    });
}

function useIntegrationBaseline({ roles = ["Admin"], verifyRestored } = {}) {
  const context = { emails: {}, tokens: {} };

  before(() => {
    cy.exec(ENVIRONMENT_CHECK_COMMAND, { timeout: COMMAND_TIMEOUT });
    resetAndVerifyBaseline();
    roles.forEach((role) => {
      loginByApi(role).then(({ email, token }) => {
        context.emails[role] = email;
        context.tokens[role] = token;
      });
    });
  });

  after(() => {
    let resetResult;
    let verifyResult;

    cy.exec(BASELINE_RESET_COMMAND, {
      timeout: COMMAND_TIMEOUT,
      failOnNonZeroExitCode: false,
    }).then((result) => {
      resetResult = result;
    });

    if (verifyRestored) {
      cy.then(() => verifyRestored(context));
    }

    cy.exec(BASELINE_VERIFY_COMMAND, {
      timeout: COMMAND_TIMEOUT,
      failOnNonZeroExitCode: false,
    }).then((result) => {
      verifyResult = result;
    });

    cy.then(() => {
      assertCommandPassed(resetResult, "Reset: PASSED", "final FT_BASELINE_V1 reset");
      assertCommandPassed(verifyResult, "Verification: PASSED", "final baseline verification");
      expect(verifyResult?.stdout).to.include(
        "Generated Firestore records pending cleanup: 0/0",
      );
    });
  });

  return context;
}

function registerMutation(input) {
  return cy.task("registerFtGeneratedRecords", input, { timeout: COMMAND_TIMEOUT });
}

function getAuditLogs(token) {
  return apiRequest({ path: "audit?limit=1000", token }).then((response) => {
    expect(response.status).to.equal(200);
    return response.body?.logs || [];
  });
}

module.exports = {
  BASELINE_RESET_COMMAND,
  BASELINE_VERIFY_COMMAND,
  COMMAND_TIMEOUT,
  apiRequest,
  apiUrl,
  firebasePasswordSignIn,
  getAuditLogs,
  inspectFtAnnouncementImage,
  registerMutation,
  requiredEnvironmentValue,
  resetAndVerifyBaseline,
  uploadFtAnnouncementImage,
  useIntegrationBaseline,
};
