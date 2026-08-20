describe("FT-012 — Review Compatibility Results", () => {
  it("loads the dedicated saved result and lets the client review its recommendations and answers", () => {
    const email = Cypress.env("FT_CLIENT_QUIZ_COOLDOWN_EMAIL");
    expect(email, "quiz-result FT client email is configured")
      .to.be.a("string")
      .and.not.be.empty;

    cy.loginClient({ email });
    cy.intercept("GET", "**/api/match/my-results").as("savedQuizResults");
    cy.visitPublicPage("/pages/public/compatibilityResults.html");

    cy.wait("@savedQuizResults", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      const results = response?.body?.results || [];
      const latest = results.find((result) => result.isLatest) || results[0];
      expect(latest?.resultId).to.equal("FT_QUIZ_RESULT_COOLDOWN");
      expect(latest?.matches, "saved compatible recommendations")
        .to.be.an("array")
        .and.not.be.empty;
    });

    cy.get("#compatibilityCompletedDate").should("not.have.text", "Not available");
    cy.get("#compatibilityRetakeDate").should("not.have.text", "Not available");
    cy.get(".compatibility-matches [data-saved-animal-id]")
      .should("have.length.greaterThan", 0)
      .first()
      .click();
    cy.get(".match-detail-modal")
      .should("be.visible")
      .and("contain.text", "Match Details")
      .and("contain.text", "Why");
    cy.get("[data-close-saved-animal]").first().click();

    cy.get("[data-review-answers]").click();
    cy.get(".compatibility-account-title").should(
      "contain.text",
      "Latest Quiz Answers",
    );
    cy.get("#compatibilityAccountBody")
      .should("contain.text", "Lifestyle & Activity")
      .and("contain.text", "Home Environment")
      .and("contain.text", "Care Preferences")
      .and("not.contain.text", "Not answered");
  });
});
