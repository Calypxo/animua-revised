const { loginAndOpenCompatibility } = require("../../../support/batch9-functionality");

describe("FT-062 - Review Managed Compatibility Results", () => {
  it("browses seeded compatibility results and opens saved match details without mutation", () => {
    loginAndOpenCompatibility();
    cy.get("#resultSearch").type("FT_QUIZ_RESULT_COOLDOWN");
    cy.get("#resultsBody").should("contain.text", "FT Client Quiz Cooldown").and("contain.text", "100.0%");
    cy.get('[data-view="FT_QUIZ_RESULT_COOLDOWN"]').click();
    cy.get("#resultDialog").should("be.visible");
    cy.get("#resultDetails")
      .should("contain.text", "FT_QUIZ_RESULT_COOLDOWN")
      .and("contain.text", "Synthetic dog for FT_ANIMAL_READY_DOG")
      .and("contain.text", "Synthetic cat for FT_ANIMAL_READY_CAT")
      .and("contain.text", "2")
      .and("contain.text", "Matches Found");
  });
});
