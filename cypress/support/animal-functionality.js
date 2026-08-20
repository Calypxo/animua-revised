const {
  apiRequest,
  resetAndVerifyBaseline,
} = require("./integration");

function disableCaching(request) {
  delete request.headers["if-none-match"];
  delete request.headers["if-modified-since"];
}

function loginAndOpenAnimal(id, role = "Admin") {
  const sessionAlias = `managementSession${role}`;
  const profileAlias = `animalProfile${role}`;
  cy.intercept(
    { method: "GET", url: "**/api/protected", middleware: true },
    disableCaching,
  ).as(sessionAlias);
  cy[`login${role === "Veterinarian" ? "Vet" : role}`]();
  cy.wait(`@${sessionAlias}`, { timeout: 30000 }).then(({ response }) => {
    if (response?.statusCode === 401) {
      return cy.wait(`@${sessionAlias}`, { timeout: 30000 })
        .its("response.statusCode")
        .should("eq", 200);
    }

    expect(response?.statusCode).to.equal(200);
  });
  cy.intercept(
    { method: "GET", url: `**/api/animals/${id}`, middleware: true },
    disableCaching,
  ).as(profileAlias);
  cy.visitManagementPage(`/pages/animalProfile.html?id=${id}`);
  cy.wait(`@${profileAlias}`, { timeout: 30000 }).then(({ response }) => {
    expect(response?.statusCode).to.equal(200);
    expect(response?.body?.animal).to.include({ id });
  });
  cy.get("body").should("not.have.class", "loading");
  cy.get("#profileMeta").should("contain.text", id);
}

function animalApi(id) {
  return cy.getCookie("animua_session").then((cookie) => apiRequest({
    path: `animals/${id}`,
    token: cookie?.value,
  }));
}

function registerAnimalMutation(input) {
  return cy.task("registerFtGeneratedRecords", input, { timeout: 120000 });
}

module.exports = {
  animalApi,
  disableCaching,
  loginAndOpenAnimal,
  registerAnimalMutation,
  resetAndVerifyBaseline,
};
