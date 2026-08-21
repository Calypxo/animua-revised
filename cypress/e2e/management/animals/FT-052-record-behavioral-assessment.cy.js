const { animalApi, loginAndOpenAnimal, registerAnimalMutation, resetAndVerifyBaseline } = require("../../../support/animal-functionality");

describe("FT-052 - Record Behavioral Assessment", () => {
  after(() => resetAndVerifyBaseline());
  it("records behavioral scores for the controlled empty quarantine animal", () => {
    loginAndOpenAnimal("FT_ANIMAL_QUARANTINE_EMPTY");
    cy.intercept("POST", "**/api/animals/FT_ANIMAL_QUARANTINE_EMPTY/behavioral").as("behavioral");
    cy.get('[data-tab="behavioral"]').click();
    cy.get("#behavioralContent").should("contain.text", "No behavioral assessment");
    cy.get("#btnEditBehavioral").click();
    cy.get('[data-trait-key="energyLevel"][data-score="4"]').click();
    cy.get("#behavioralNotes").type("Batch 8 FT behavioral assessment");
    cy.get("#behavioralModalSave").click();
    cy.wait("@behavioral", { timeout: 30000 }).then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(request.body?.traits?.energyLevel).to.equal(4);
      expect(Object.keys(request.body?.traits || {})).to.have.length(17);
    });
    registerAnimalMutation({ kind: "animalBehavioral", primaryId: "FT_ANIMAL_QUARANTINE_EMPTY" })
      .its("registeredPaths").should("have.length", 1);
    cy.get("#behavioralContent").should("contain.text", "Batch 8 FT behavioral assessment");
    animalApi("FT_ANIMAL_QUARANTINE_EMPTY").then((response) => {
      expect(response.body?.animal?.behavioralNotes).to.equal("Batch 8 FT behavioral assessment");
      expect(response.body?.animal?.behavioralAssessment?.energyLevel).to.equal(4);
    });
  });
});
