const BASELINE_RESET_COMMAND = "npm --prefix backend run ft:baseline:reset";
const BASELINE_VERIFY_COMMAND = "npm --prefix backend run ft:baseline:verify";
const COMMAND_TIMEOUT = 120000;

function requiredEnvironmentValue(name) {
  const value = Cypress.env(name);
  if (!value) {
    throw new Error(`IT-001 requires Cypress environment value ${name}.`);
  }
  return value;
}

function apiUrl(path) {
  const baseUrl = String(Cypress.env("apiBaseUrl") || "").replace(/\/+$/, "");
  return `${baseUrl}/${String(path || "").replace(/^\/+/, "")}`;
}

function authorizationHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

function loginByApi(email, password) {
  return cy.request({
    method: "POST",
    url: apiUrl("auth/login"),
    body: { email, password },
    failOnStatusCode: false,
    log: false,
  }).then((response) => {
    expect(response.status, `real ANIMUA login for ${email}`).to.equal(200);
    expect(response.body, "login response body").not.to.have.property("token");
    const setCookie = [].concat(response.headers["set-cookie"] || []).join(";");
    const token = decodeURIComponent(
      setCookie.match(/(?:__Host-animua_session|animua_session)=([^;]+)/)?.[1] || "",
    );
    expect(token, "JWT transported only in Set-Cookie").to.be.a("string").and.not.be.empty;
    return cy.clearCookies({ log: false }).then(() => token);
  });
}

describe("IT-001 — Protected API Authorization", () => {
  let adminEmail;
  let staffEmail;
  let mutableStaffEmail;
  let managementPassword;
  let adminToken;
  let staffToken;
  let mutableStaffToken;

  before(() => {
    adminEmail = requiredEnvironmentValue("FT_ADMIN_ACTIVE_EMAIL");
    staffEmail = requiredEnvironmentValue("FT_STAFF_ACTIVE_EMAIL");
    mutableStaffEmail = requiredEnvironmentValue(
      "FT_MANAGEMENT_PROFILE_MUTABLE_EMAIL",
    );
    managementPassword = requiredEnvironmentValue("FT_MANAGEMENT_PASSWORD");

    cy.exec("npm run check:functionality:config", { timeout: COMMAND_TIMEOUT });
    cy.exec(BASELINE_RESET_COMMAND, { timeout: COMMAND_TIMEOUT });
    cy.exec(BASELINE_VERIFY_COMMAND, { timeout: COMMAND_TIMEOUT });

    loginByApi(adminEmail, managementPassword).then((token) => {
      adminToken = token;
    });
    loginByApi(staffEmail, managementPassword).then((token) => {
      staffToken = token;
    });
    loginByApi(mutableStaffEmail, managementPassword).then((token) => {
      mutableStaffToken = token;
    });
  });

  after(() => {
    let resetResult;
    let mutableUserResponse;
    let verifyResult;

    cy.exec(BASELINE_RESET_COMMAND, {
      timeout: COMMAND_TIMEOUT,
      failOnNonZeroExitCode: false,
    }).then((result) => {
      resetResult = result;
    });

    cy.request({
      method: "GET",
      url: apiUrl(`users/${encodeURIComponent(mutableStaffEmail)}`),
      headers: authorizationHeader(adminToken),
      failOnStatusCode: false,
    }).then((response) => {
      mutableUserResponse = response;
    });

    cy.exec(BASELINE_VERIFY_COMMAND, {
      timeout: COMMAND_TIMEOUT,
      failOnNonZeroExitCode: false,
    }).then((result) => {
      verifyResult = result;
    });

    cy.then(() => {
      expect(resetResult?.stdout, "final FT_BASELINE_V1 reset output").to.include(
        "Reset: PASSED",
      );
      expect(mutableUserResponse?.status, "mutable fixture exists after reset").to.equal(200);
      expect(mutableUserResponse?.body?.user).to.include({
        id: mutableStaffEmail,
        email: mutableStaffEmail,
        role: "Staff",
        status: "Active",
      });
      expect(verifyResult?.stdout).to.include(
        "Generated Firestore records pending cleanup: 0/0",
      );
      expect(verifyResult?.stdout).to.include("Verification: PASSED");
    });
  });

  it("IT-001-A — grants an active Admin access to the Admin-only user endpoint", () => {
    cy.request({
      method: "GET",
      url: apiUrl(`users/${encodeURIComponent(adminEmail)}`),
      headers: authorizationHeader(adminToken),
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body?.user).to.include({
        id: adminEmail,
        email: adminEmail,
        role: "Admin",
        status: "Active",
      });
      expect(response.body.user).not.to.have.property("password");
    });
  });

  it("IT-001-B — rejects an unauthenticated request before returning protected data", () => {
    cy.request({
      method: "GET",
      url: apiUrl(`users/${encodeURIComponent(adminEmail)}`),
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.equal(401);
      expect(response.body).to.deep.equal({
        message: "Access denied. No valid token provided.",
      });
      expect(response.body).not.to.have.property("user");
    });
  });

  it("IT-001-C — authenticates an active Staff identity but rejects its Admin role", () => {
    cy.request({
      method: "GET",
      url: apiUrl(`users/${encodeURIComponent(adminEmail)}`),
      headers: authorizationHeader(staffToken),
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.equal(403);
      expect(response.body).to.deep.equal({
        message: "Access denied. Required role: Admin.",
      });
      expect(response.body).not.to.have.property("user");
    });
  });

  it("IT-001-D — revalidates Firestore status and rejects a pre-issued JWT after deactivation", () => {
    let deactivationResponse;
    let inactiveRequestResponse;
    let activationResponse;
    let firstLedgerResult;
    let finalLedgerResult;

    cy.request({
      method: "PATCH",
      url: apiUrl(`users/${encodeURIComponent(mutableStaffEmail)}/toggle-status`),
      headers: authorizationHeader(adminToken),
      failOnStatusCode: false,
    }).then((response) => {
      deactivationResponse = response;

      if (response.status !== 200 || response.body?.status !== "Inactive") {
        return;
      }

      return cy
        .task("registerFtGeneratedRecords", { kind: "userStatus", minimum: 1 })
        .then((result) => {
          firstLedgerResult = result;
        })
        .then(() =>
          cy.request({
            method: "GET",
            url: apiUrl(`users/${encodeURIComponent(mutableStaffEmail)}`),
            headers: authorizationHeader(mutableStaffToken),
            failOnStatusCode: false,
          }),
        )
        .then((response) => {
          inactiveRequestResponse = response;
        })
        .then(() =>
          cy.request({
            method: "PATCH",
            url: apiUrl(`users/${encodeURIComponent(mutableStaffEmail)}/toggle-status`),
            headers: authorizationHeader(adminToken),
            failOnStatusCode: false,
          }),
        )
        .then((response) => {
          activationResponse = response;
        })
        .then(() =>
          cy.task("registerFtGeneratedRecords", { kind: "userStatus", minimum: 1 }),
        )
        .then((result) => {
          finalLedgerResult = result;
        });
    });

    cy.then(() => {
      expect(deactivationResponse?.status, "authorized setup deactivation").to.equal(200);
      expect(deactivationResponse?.body?.status).to.equal("Inactive");
      expect(firstLedgerResult?.registeredPaths, "deactivation audit registered")
        .to.be.an("array")
        .and.not.be.empty;

      expect(inactiveRequestResponse?.status, "inactive middleware decision").to.equal(403);
      expect(inactiveRequestResponse?.body).to.deep.equal({
        message: "This account is inactive.",
      });
      expect(inactiveRequestResponse?.body).not.to.have.property("user");

      expect(activationResponse?.status, "immediate fixture reactivation").to.equal(200);
      expect(activationResponse?.body?.status).to.equal("Active");
      expect(finalLedgerResult?.registeredPaths, "status audits registered for reset")
        .to.be.an("array")
        .and.have.length.at.least(2);
    });
  });
});
