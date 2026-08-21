const {
  apiRequest,
  loginAndOpenCompatibility,
  registerMutation,
  resetAndVerifyBaseline,
} = require("../../../support/batch9-functionality");
const { loginByApi } = require("../../../support/integration");

describe("FT-064 - Manage Client Retake Override", () => {
  after(() => resetAndVerifyBaseline());

  it("allows an immediate retake for the controlled cooldown client", () => {
    loginAndOpenCompatibility();
    cy.intercept("PATCH", "**/api/match/admin/users/*/retake-date").as("retakeOverride");
    cy.get("#resultSearch").type("FT_QUIZ_RESULT_COOLDOWN");
    cy.get('[data-view="FT_QUIZ_RESULT_COOLDOWN"]').click();
    cy.get("#resultDialog [data-now]").click();
    cy.wait("@retakeOverride", { timeout: 30000 }).then(({ request, response }) => {
      expect(request.body).to.deep.equal({ immediate: true });
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.quizRetakeOverrideAt).to.be.a("string");
    });
    registerMutation({ kind: "compatibilityRetakeOverride", primaryId: "FT_CLIENT_QUIZ_COOLDOWN" })
      .its("registeredPaths").should("have.length", 1);
    loginByApi("PublicQuizCooldown").then(({ response, token }) => {
      expect(response.status).to.equal(200);
      return apiRequest({ path: "match/eligibility", token });
    }).then((eligibility) => {
      expect(eligibility.status).to.equal(200);
      expect(eligibility.body.canTakeQuiz).to.equal(true);
    });
  });
});
