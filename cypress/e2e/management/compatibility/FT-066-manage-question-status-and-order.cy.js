const {
  loginAndOpenCompatibility,
  registerMutation,
  resetAndVerifyBaseline,
} = require("../../../support/batch9-functionality");

describe("FT-066 - Manage Question Status and Order", () => {
  after(() => resetAndVerifyBaseline());

  it("deactivates and reorders the controlled Energy Level question before publishing", () => {
    loginAndOpenCompatibility();
    cy.intercept("PUT", "**/api/match/admin/questions").as("publishQuestions");
    cy.get('[data-cq-tab="questions"]').click();
    cy.contains("#questionList .cq-question-row strong", "Energy Level")
      .closest(".cq-question-row").find('[data-action="toggle"]').click();
    cy.contains("#questionList .cq-question-row strong", "Energy Level")
      .closest(".cq-question-row").should("have.class", "is-inactive")
      .find('[data-action="move-down"]').click();
    cy.get("#saveQuestionsBtn").click();
    cy.wait("@publishQuestions", { timeout: 30000 }).then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200);
      const question = request.body.questions.find(({ id }) => id === "energyLevel");
      expect(question.active).to.equal(false);
      expect(request.body.questions.indexOf(question)).to.equal(1);
    });
    registerMutation({ kind: "compatibilityQuestionStatusOrder", primaryId: "energyLevel" })
      .its("registeredPaths").should((paths) => {
        expect(paths).to.have.length.greaterThan(0);
        expect(paths.every((path) => path.startsWith("auditLogs/"))).to.equal(true);
      });
    cy.contains("#questionList .cq-question-row strong", "Energy Level")
      .closest(".cq-question-row").should("have.class", "is-inactive")
      .find(".cq-question-number").should("contain.text", "2");
  });
});
