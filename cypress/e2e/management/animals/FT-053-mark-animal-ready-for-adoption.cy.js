const { animalApi, loginAndOpenAnimal, registerAnimalMutation, resetAndVerifyBaseline } = require("../../../support/animal-functionality");

describe("FT-053 - Mark Animal Ready for Adoption", () => {
  before(() => resetAndVerifyBaseline());
  after(() => resetAndVerifyBaseline());
  it("marks only the cleared and behaviorally assessed animal ready", () => {
    loginAndOpenAnimal("FT_ANIMAL_QUARANTINE_CLEARED");
    cy.intercept("PATCH", "**/api/animals/FT_ANIMAL_QUARANTINE_CLEARED/mark-ready").as("markReady");
    cy.get('[data-tab="adoption"]').click();
    cy.get("#adoptionContent").should("contain.text", "All requirements are complete");
    cy.get("#btnMarkReady").should("be.visible").click();
    cy.wait("@markReady", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
    registerAnimalMutation({ kind: "animalReadiness", primaryId: "FT_ANIMAL_QUARANTINE_CLEARED" })
      .its("registeredPaths").should("have.length", 1);
    cy.get("#profileStatusBadge").should("contain.text", "Ready");
    animalApi("FT_ANIMAL_QUARANTINE_CLEARED").its("body.animal").should("include", {
      status: "Ready",
      currentStage: "adoption",
      quarantineStatus: "Completed",
      quarantineClearance: "Cleared",
      visibleToPublic: true,
    });
  });
});
