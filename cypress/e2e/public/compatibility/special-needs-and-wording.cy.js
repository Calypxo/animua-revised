const { DEFAULT_QUESTIONS } = require("../../../../backend/src/services/quizQuestionService");

describe("Public compatibility wording and animal care information", () => {
  beforeEach(() => {
    const questions = structuredClone(DEFAULT_QUESTIONS);
    questions[0].text = "What energy level fits your household?";
    questions[0].choices[0].text = "A very calm pet";
    questions[0].customWording = true;
    cy.intercept("**/api/**", request => {
      const path = new URL(request.url).pathname;
      if (request.method !== "GET") throw new Error(`Unexpected mutation: ${path}`);
      if (path.endsWith("/auth/account")) return request.reply({ account: { id: "public-test", fullName: "Public Test", email: "public@example.com", role: "Public" } });
      if (path.endsWith("/match/eligibility")) return request.reply({ canTakeQuiz: true, quizEnabled: true });
      if (path.endsWith("/match/questions")) return request.reply({ questions, version: 2 });
      if (path.endsWith("/public/pets")) return request.reply({ pets: [{ id: "care-test", displayLabel: "Care test animal", species: "Dog", status: "Ready", publicDescription: "A gentle companion.", specialNeedsStatus: "yes", specialNeedsNotes: "Daily mobility assistance and an accessible sleeping area." }] });
      return request.reply({ notifications: [], unreadCount: 0, results: [], pets: [] });
    });
  });

  it("uses the status preference and keeps published wording in both language modes", () => {
    cy.viewport(1600, 1000);
    cy.visit("/pages/public/petCompatibility.html");
    cy.get('.filter-section[data-key="acceptSpecialNeeds"]').should("contain.text", "special needs").and("not.contain.text", "4-5");
    cy.get('.select-tile[data-key="preferredSpecies"][data-value="Any"]').click();
    cy.get('.select-tile[data-key="preferredSex"][data-value="Any"]').click();
    cy.get('.toggle-tile[data-key="acceptSpecialNeeds"][data-value="no"]').click();
    cy.get("#btnNext").click();
    cy.get('.question-card[data-key="energyLevel"]').should("contain.text", "What energy level fits your household?").and("contain.text", "A very calm pet");
    cy.get('[data-quiz-language="tagalog"]').click();
    cy.get('.question-card[data-key="energyLevel"]').should("contain.text", "What energy level fits your household?").and("contain.text", "A very calm pet");
  });

  it("shows care status and instructions even when an animal already has a public description", () => {
    cy.visit("/pages/public/find-furbabies.html");
    cy.get('.view-profile-btn[data-id="care-test"]').click();
    cy.get("#petProfileModal").should("be.visible").and("contain.text", "Special needs: requires special care").and("contain.text", "Daily mobility assistance").and("contain.text", "A gentle companion.");
  });
});
