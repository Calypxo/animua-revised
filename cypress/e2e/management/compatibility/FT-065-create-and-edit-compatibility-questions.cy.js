const {
  loginAndOpenCompatibility,
  registerMutation,
  resetAndVerifyBaseline,
} = require("../../../support/batch9-functionality");

describe("FT-065 - Create and Edit Compatibility Questions", () => {
  after(() => resetAndVerifyBaseline());

  it("creates, edits, and publishes one controlled inactive compatibility question", () => {
    let questionId = "";
    loginAndOpenCompatibility();
    cy.intercept("PUT", "**/api/match/admin/questions").as("publishQuestions");
    cy.get('[data-cq-tab="questions"]').click();
    cy.get("#addQuestionBtn").click();
    cy.get("#editorQuestionText").type("Which controlled Batch 9 preference should be saved?");
    cy.get("#editorQuestionLabel").type("Batch 9 FT Question");
    cy.get('#editorChoiceList .cq-editor-choice').eq(0).find('[data-editor-choice="text"]').type("Controlled option one");
    cy.get('#editorChoiceList .cq-editor-choice').eq(1).find('[data-editor-choice="text"]').type("Controlled option two");
    cy.get('#editorChoiceList .cq-editor-choice').eq(0).find('[data-editor-choice="value"]').select("2");
    cy.get('#editorChoiceList .cq-editor-choice').eq(1).find('[data-editor-choice="value"]').select("4");
    cy.get("#applyQuestionEdit").click();
    cy.contains("#questionList .cq-question-row strong", "Batch 9 FT Question")
      .closest(".cq-question-row").find('[data-action="edit"]').click();
    cy.get("#editorQuestionText").clear().type("Which controlled Batch 9 preference should be recorded?");
    cy.get("#editorQuestionLabel").clear().type("Batch 9 FT Question Edited");
    cy.get("#applyQuestionEdit").click();
    cy.get("#questionDraftBar").should("not.have.attr", "hidden");
    cy.get("#saveQuestionsBtn").scrollIntoView().click();
    cy.wait("@publishQuestions", { timeout: 30000 }).then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200);
      const question = request.body.questions.find(({ label }) => label === "Batch 9 FT Question Edited");
      expect(question).to.include({ active: false, text: "Which controlled Batch 9 preference should be recorded?" });
      questionId = question.id;
      expect(questionId).to.match(/^question-\d{13}$/);
    });
    cy.then(() => registerMutation({ kind: "compatibilityQuestionCreate", primaryId: questionId }))
      .its("registeredPaths").should("have.length", 1);
    cy.contains("#questionList .cq-question-row strong", "Batch 9 FT Question Edited").should("be.visible");
  });
});
