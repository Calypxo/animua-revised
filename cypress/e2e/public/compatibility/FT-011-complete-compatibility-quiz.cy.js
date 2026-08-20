const { resetAndVerifyBaseline } = require("../../../support/integration");
const { disableCaching } = require("../../../support/final-batch-functionality");

function answerCurrentQuizPhase() {
  cy.get("#questionArea .filter-section, #questionArea .question-card").each(
    ($question) => {
      const preferredFilter = $question
        .find('[data-value="Any"], [data-value="yes"]')
        .first();
      const choice = preferredFilter.length
        ? preferredFilter
        : $question.find('.option-btn[data-value="3"]').first();

      expect(choice, "available answer choice").to.have.length(1);
      cy.wrap(choice).click();
    },
  );
}

describe("FT-011 — Complete Compatibility Quiz", () => {
  before(() => resetAndVerifyBaseline());
  after(() => resetAndVerifyBaseline());

  it("submits a complete quiz for the dedicated first-attempt client and saves ranked matches", () => {
    const email = Cypress.env("FT_CLIENT_QUIZ_NEW_EMAIL");
    expect(email, "quiz-new FT client email is configured")
      .to.be.a("string")
      .and.not.be.empty;

    cy.loginClient({ email });
    cy.intercept(
      { method: "GET", url: "**/api/match/eligibility", middleware: true },
      disableCaching,
    ).as("quizEligibility");
    cy.intercept(
      { method: "GET", url: "**/api/match/questions", middleware: true },
      disableCaching,
    ).as("quizQuestions");
    cy.intercept("POST", "**/api/match").as("submitQuiz");

    cy.visitPublicPage("/pages/public/petCompatibility.html");
    cy.wait("@quizEligibility", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.canTakeQuiz).to.equal(true);
      expect(response?.body?.reason).to.equal("FIRST_ATTEMPT");
    });
    cy.wait("@quizQuestions", { timeout: 30000 })
      .its("response.statusCode")
      .should("eq", 200);

    cy.get("#questionArea").should("be.visible");
    cy.get("#quizAccessCard").should("not.be.visible");

    for (let phase = 0; phase < 5; phase += 1) {
      answerCurrentQuizPhase();
      if (phase < 4) {
        cy.get("#btnNext").should("have.attr", "aria-disabled", "false").click();
      }
    }

    cy.get("#progressPercentLabel").should("have.text", "100% complete");
    cy.get("#btnSubmit")
      .should("have.attr", "aria-disabled", "false")
      .click();

    cy.wait("@submitQuiz", { timeout: 30000 }).then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200);
      const resultId = response?.body?.resultId;
      expect(resultId).to.be.a("string").and.not.be.empty;
      cy.task("registerFtGeneratedRecords", {
        kind: "compatibilityQuiz",
        primaryId: resultId,
      }).then(({ registeredPaths }) => {
        expect(registeredPaths).to.include(`compatibilityResults/${resultId}`);
      });
      expect(request.headers).not.to.have.property("authorization");
      expect(request.headers.origin).to.equal(Cypress.env("publicBaseUrl"));
      expect(Object.keys(request.body.preferences || {})).to.have.length(18);
      expect(request.body.filters).to.deep.include({
        preferredSpecies: "Any",
        preferredSex: "Any",
        acceptSpecialNeeds: "yes",
      });
      expect(response?.body?.success).to.equal(true);
      expect(response?.body?.matches).to.be.an("array").and.not.be.empty;
    });

    cy.location("pathname", { timeout: 30000 }).should(
      "eq",
      "/pages/public/compatibilityResults.html",
    );
    cy.get("#compatibilityAccountBody", { timeout: 30000 })
      .should("contain.text", "Top recommended animals")
      .and("not.contain.text", "No animals matched the selected filters");
    cy.get(".compatibility-matches [data-saved-animal-id]")
      .should("have.length.greaterThan", 0)
      .first()
      .click();
    cy.get(".match-detail-modal")
      .should("be.visible")
      .and("contain.text", "Match Details")
      .and("contain.text", "% Match");
  });
});
