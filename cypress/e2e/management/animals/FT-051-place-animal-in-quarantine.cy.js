const { animalApi, loginAndOpenAnimal, registerAnimalMutation, resetAndVerifyBaseline } = require("../../../support/animal-functionality");

describe("FT-051 - Place Animal in Quarantine", () => {
  after(() => resetAndVerifyBaseline());
  it("places the controlled profiling animal in quarantine", () => {
    loginAndOpenAnimal("FT_ANIMAL_PROFILING");
    cy.intercept("PATCH", "**/api/animals/FT_ANIMAL_PROFILING/send-to-quarantine").as("quarantine");
    cy.get("#profileStatusBadge").should("contain.text", "Profiling");
    cy.get("#btnStatusChange").should("contain.text", "Place in Quarantine").click();
    cy.wait("@quarantine", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
    registerAnimalMutation({ kind: "animalQuarantine", primaryId: "FT_ANIMAL_PROFILING" })
      .its("registeredPaths").should("have.length", 1);
    cy.get("#profileStatusBadge").should("contain.text", "Quarantine");
    animalApi("FT_ANIMAL_PROFILING").its("body.animal").should("include", {
      status: "Quarantine",
      currentStage: "quarantine",
      quarantineStatus: "Active",
      quarantineClearance: "Pending",
      visibleToPublic: false,
    });
  });
});
