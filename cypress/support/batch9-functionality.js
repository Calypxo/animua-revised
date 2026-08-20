const {
  apiRequest,
  resetAndVerifyBaseline,
} = require("./integration");

function disableCaching(request) {
  delete request.headers["if-none-match"];
  delete request.headers["if-modified-since"];
}

function loginCommand(role) {
  return role === "Veterinarian" ? "loginVet" : `login${role}`;
}

function loginAndOpenInventory(role = "Admin") {
  cy.viewport(1440, 900);
  cy.clearLocalStorage();
  const suffix = role.replace(/\W/g, "");
  cy.intercept({ method: "GET", url: "**/api/inventory", middleware: true }, disableCaching)
    .as(`inventoryList${suffix}`);
  cy.intercept({ method: "POST", url: "**/api/predictive/items", middleware: true }, disableCaching)
    .as(`inventoryPredictions${suffix}`);
  cy[loginCommand(role)]();
  cy.window().then((window) => apiRequest({
    path: "protected",
    token: window.localStorage.getItem("animua_token"),
  })).then((response) => {
    expect(response.status).to.equal(200);
    expect(response.body?.user?.role).to.equal(role);
  });
  cy.visitManagementPage("/pages/inventory.html");
  cy.wait(`@inventoryList${suffix}`, { timeout: 30000 })
    .its("response.statusCode").should("eq", 200);
  cy.wait(`@inventoryPredictions${suffix}`, { timeout: 30000 })
    .its("response.statusCode").should("eq", 200);
  cy.get("body").should("not.have.class", "loading");
  cy.get("#inventoryTableBody tr[data-id]").should("have.length.greaterThan", 0);
}

function loginAndOpenCompatibility(role = "Admin") {
  cy.viewport(1440, 900);
  cy.clearLocalStorage();
  const suffix = role.replace(/\W/g, "");
  cy.intercept({ method: "GET", url: "**/api/match/admin/settings", middleware: true }, disableCaching)
    .as(`quizSettings${suffix}`);
  cy.intercept({ method: "GET", url: "**/api/match/admin/results", middleware: true }, disableCaching)
    .as(`quizResults${suffix}`);
  cy.intercept({ method: "GET", url: "**/api/match/admin/questions", middleware: true }, disableCaching)
    .as(`quizQuestions${suffix}`);
  cy[loginCommand(role)]();
  cy.window().then((window) => apiRequest({
    path: "protected",
    token: window.localStorage.getItem("animua_token"),
  })).then((response) => {
    expect(response.status).to.equal(200);
    expect(response.body?.user?.role).to.equal(role);
  });
  cy.visitManagementPage("/pages/compatibilityQuiz.html");
  cy.wait([`@quizSettings${suffix}`, `@quizResults${suffix}`, `@quizQuestions${suffix}`], { timeout: 30000 })
    .each(({ response }) => expect(response?.statusCode).to.equal(200));
  cy.get("body").should("not.have.class", "loading");
  cy.get("#resultsBody tr").should("have.length.greaterThan", 0);
}

function currentToken() {
  return cy.window().then((window) => window.localStorage.getItem("animua_token"));
}

function registerMutation(input) {
  return cy.task("registerFtGeneratedRecords", input, { timeout: 120000 });
}

module.exports = {
  apiRequest,
  currentToken,
  disableCaching,
  loginAndOpenCompatibility,
  loginAndOpenInventory,
  registerMutation,
  resetAndVerifyBaseline,
};
