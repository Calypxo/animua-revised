const {
  apiRequest,
  loginAndOpenCompatibility,
  registerMutation,
  resetAndVerifyBaseline,
} = require("../../../support/batch9-functionality");

describe("FT-067 - Publish Compatibility Questions", () => {
  after(() => resetAndVerifyBaseline());

  it("publishes an edited active question to both management and public quiz APIs", () => {
    loginAndOpenCompatibility();
    cy.intercept("PUT", "**/api/match/admin/questions").as("publishQuestions");
    cy.get('[data-cq-tab="questions"]').click();
    cy.contains("#questionList .cq-question-row strong", "Exercise Capacity")
      .closest(".cq-question-row").find('[data-action="edit"]').click();
    cy.get("#editorQuestionText").clear().type("How much Batch 9 exercise can you provide each day?");
    cy.get("#editorQuestionLabel").clear().type("Batch 9 Published Exercise Capacity");
    cy.get("#applyQuestionEdit").click();
    cy.get("#saveQuestionsBtn").click();
    cy.wait("@publishQuestions", { timeout: 30000 }).then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.version).to.equal(2);
      expect(request.body.questions.find(({ id }) => id === "exerciseNeeds")).to.include({
        active: true,
        label: "Batch 9 Published Exercise Capacity",
        text: "How much Batch 9 exercise can you provide each day?",
      });
    });
    registerMutation({ kind: "compatibilityQuestionPublish", primaryId: "exerciseNeeds" })
      .its("registeredPaths").should("have.length", 1);
    apiRequest({
      method: "POST",
      path: "auth/login",
      body: {
        email: Cypress.env("FT_CLIENT_QUIZ_ELIGIBLE_EMAIL"),
        password: Cypress.env("FT_PUBLIC_PASSWORD"),
      },
      log: false,
    }).then((login) => {
      expect(login.status).to.equal(200);
      return apiRequest({ path: "match/questions", token: login.body.token });
    }).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body.version).to.equal(2);
      expect(response.body.questions.find(({ id }) => id === "exerciseNeeds")).to.include({
        active: true,
        label: "Batch 9 Published Exercise Capacity",
      });
    });
  });
});
