const {
  apiRequest,
  currentToken,
  loginAndOpenCompatibility,
  registerMutation,
  resetAndVerifyBaseline,
} = require("../../../support/batch9-functionality");

describe("FT-063 - Manage Compatibility Quiz Settings", () => {
  after(() => resetAndVerifyBaseline());

  it("updates and persists the controlled cooldown setting through the UI", () => {
    loginAndOpenCompatibility();
    cy.intercept("PUT", "**/api/match/admin/settings").as("saveSettings");
    cy.get('[data-cq-tab="settings"]').click();
    cy.get("#quizEnabled").should("be.checked");
    cy.get("#cooldownDays").should("have.value", "30").clear().type("31");
    cy.get("#quizVersion").should("have.value", "1");
    cy.get('#settingsForm button[type="submit"]').click();
    cy.wait("@saveSettings", { timeout: 30000 }).then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(request.body).to.deep.equal({ quizEnabled: true, retakeCooldownDays: 31, quizVersion: 1 });
    });
    currentToken().then((token) => apiRequest({ path: "match/admin/settings", token })).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body.settings).to.include({ quizEnabled: true, retakeCooldownDays: 31, quizVersion: 1 });
    });
    registerMutation({ kind: "compatibilitySettings", primaryId: "compatibilityQuiz" })
      .its("registeredPaths").should("have.length", 1);
  });
});
