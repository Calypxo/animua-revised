describe("FT-013 — Compatibility Quiz Retake Eligibility", () => {
  it("blocks the cooldown client and allows the separately seeded eligible client", () => {
    const cooldownEmail = Cypress.env("FT_CLIENT_QUIZ_COOLDOWN_EMAIL");
    const eligibleEmail = Cypress.env("FT_CLIENT_QUIZ_ELIGIBLE_EMAIL");
    expect(cooldownEmail, "cooldown FT client email").to.be.a("string").and.not.be.empty;
    expect(eligibleEmail, "eligible FT client email").to.be.a("string").and.not.be.empty;

    cy.loginClient({ email: cooldownEmail });
    cy.intercept("GET", "**/api/match/eligibility").as("retakeEligibility");
    cy.visitPublicPage("/pages/public/petCompatibility.html");
    cy.wait("@retakeEligibility", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body).to.include({
        canTakeQuiz: false,
        hasPreviousResult: true,
        reason: "RETAKE_COOLDOWN",
      });
      expect(response?.body?.latestResult?.resultId).to.equal(
        "FT_QUIZ_RESULT_COOLDOWN",
      );
      expect(response?.body?.remainingDays).to.be.greaterThan(0);
    });
    cy.get("#quizAccessCard")
      .should("be.visible")
      .and("contain.text", "Compatibility result saved")
      .and("contain.text", "Next allowed retake");
    cy.get("#questionArea").should("not.be.visible");
    cy.get("#btnSubmit").should("not.exist");

    cy.visitPublicPage("/pages/public/home.html");
    cy.logoutClient();
    cy.loginClient({ email: eligibleEmail });
    cy.visitPublicPage("/pages/public/petCompatibility.html");
    cy.wait("@retakeEligibility", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body).to.include({
        canTakeQuiz: true,
        hasPreviousResult: true,
        reason: "RETAKE_AVAILABLE",
      });
      expect(response?.body?.latestResult?.resultId).to.equal(
        "FT_QUIZ_RESULT_ELIGIBLE",
      );
      expect(response?.body?.remainingDays).to.equal(0);
    });
    cy.get("#quizAccessCard")
      .should("be.visible")
      .and("contain.text", "Retake available");
    cy.get("#questionArea").should("be.visible");
    cy.get("#btnNext").should("exist");
  });
});
