const {
  apiRequest,
  inspectFtAnnouncementImage,
  resetAndVerifyBaseline,
} = require("./integration");
const { disableCaching } = require("./batch9-functionality");

function loginCommand(role) {
  return role === "Veterinarian" ? "loginVet" : `login${role}`;
}

function currentToken() {
  return cy.window().then((window) => window.localStorage.getItem("animua_token"));
}

function loginAndOpenManagement({ role = "Admin", page, requestUrl, alias, ready }) {
  cy.viewport(1440, 900);
  cy.clearLocalStorage();
  const suffix = role.replace(/\W/g, "");
  const requestAlias = `${alias}${suffix}`;
  cy.intercept({ method: "GET", url: requestUrl, middleware: true }, disableCaching)
    .as(requestAlias);
  cy[loginCommand(role)]();
  currentToken().then((token) => apiRequest({ path: "protected", token })).then((response) => {
    expect(response.status).to.equal(200);
    expect(response.body?.user?.role).to.equal(role);
  });
  cy.visitManagementPage(page);
  cy.wait(`@${requestAlias}`, { timeout: 30000 })
    .its("response.statusCode").should("eq", 200);
  cy.get("body").should("not.have.class", "loading");
  cy.get(ready).should("exist");
  return requestAlias;
}

function loginAndOpenAnnouncements(role = "Admin") {
  return loginAndOpenManagement({
    role,
    page: "/pages/announcements.html",
    requestUrl: "**/api/announcements",
    alias: "announcementList",
    ready: "#announcementFeed .post-card",
  });
}

function loginAndOpenContact(role = "Admin") {
  const suffix = role.replace(/\W/g, "");
  cy.intercept({
    method: "GET",
    url: "**/src/management/contactMessages.js*",
    middleware: true,
  }, (request) => {
    disableCaching(request);
    request.headers["cache-control"] = "no-cache";
    request.continue((response) => {
      delete response.headers.etag;
      response.headers["cache-control"] = "no-store";
    });
  }).as(`contactSource${suffix}`);
  const requestAlias = loginAndOpenManagement({
    role,
    page: "/pages/contactMessages.html",
    requestUrl: "**/api/public/contact/messages",
    alias: "contactList",
    ready: "#messageList .cm-message-item",
  });
  cy.wait(`@contactSource${suffix}`, { timeout: 30000 })
    .its("response.statusCode").should("eq", 200);
  return requestAlias;
}

function loginAndOpenReports(role = "Admin") {
  return loginAndOpenManagement({
    role,
    page: "/pages/reports.html",
    requestUrl: "**/api/reports*",
    alias: "reportList",
    ready: "#liveReportTabs [data-report]",
  });
}

function registerMutation(input) {
  return cy.task("registerFtGeneratedRecords", input, { timeout: 120000 });
}

module.exports = {
  apiRequest,
  currentToken,
  inspectFtAnnouncementImage,
  loginAndOpenAnnouncements,
  loginAndOpenContact,
  loginAndOpenReports,
  registerMutation,
  resetAndVerifyBaseline,
};
