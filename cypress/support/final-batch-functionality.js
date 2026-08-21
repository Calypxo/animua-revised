const {
  apiRequest,
  resetAndVerifyBaseline,
} = require("./integration");

function disableCaching(request) {
  delete request.headers["if-none-match"];
  delete request.headers["if-modified-since"];
  request.continue((response) => {
    delete response.headers.etag;
    response.headers["cache-control"] = "no-store";
  });
}

function currentToken() {
  return cy.getCookie("animua_session").then((cookie) => cookie?.value || "");
}

function loginMutableManagement(password = Cypress.env("FT_MANAGEMENT_PASSWORD")) {
  return cy.loginManagement("Staff", {
    email: Cypress.env("FT_MANAGEMENT_PROFILE_MUTABLE_EMAIL"),
    password,
  });
}

function loginAndOpen({ role = "Admin", credentials, page, requestUrl, alias, ready }) {
  cy.viewport(1440, 900);
  cy.clearLocalStorage();
  cy.intercept({ method: "GET", url: requestUrl, middleware: true }, disableCaching).as(alias);
  if (credentials) cy.loginManagement(role, credentials);
  else cy[`login${role === "Veterinarian" ? "Vet" : role}`]();
  cy.assertManagementSession(role);
  cy.visitManagementPage(page);
  cy.wait(`@${alias}`, { timeout: 30000 })
    .its("response.statusCode").should("be.oneOf", [200, 304]);
  cy.get("body").should("not.have.class", "loading");
  cy.get(ready).should("exist");
}

function loginAndOpenArchive() {
  return loginAndOpen({
    page: "/pages/archivedRecords.html",
    requestUrl: "**/api/animals?status=Archived",
    alias: "archiveList",
    ready: "#archiveTableBody .archive-row",
  });
}

function loginAndOpenAudit() {
  return loginAndOpen({
    page: "/pages/auditTrail.html",
    requestUrl: "**/api/audit?limit=500",
    alias: "auditList",
    ready: "#auditTableBody .audit-row",
  });
}

function loginAndOpenMutableAccount(password = Cypress.env("FT_MANAGEMENT_PASSWORD")) {
  const email = Cypress.env("FT_MANAGEMENT_PROFILE_MUTABLE_EMAIL");
  return loginAndOpen({
    role: "Staff",
    credentials: { email, password },
    page: "/pages/accountSettings.html",
    requestUrl: "**/api/auth/account",
    alias: "managementAccount",
    ready: "#profileForm",
  });
}

function registerFinalMutation(input) {
  return cy.task("registerFtGeneratedRecords", input, { timeout: 120000 });
}

module.exports = {
  apiRequest,
  currentToken,
  disableCaching,
  loginAndOpenArchive,
  loginAndOpenAudit,
  loginAndOpenMutableAccount,
  loginMutableManagement,
  registerFinalMutation,
  resetAndVerifyBaseline,
};
