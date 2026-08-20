const { animalApi, loginAndOpenAnimal, registerAnimalMutation, resetAndVerifyBaseline } = require("../../../support/animal-functionality");

describe("FT-048 - Edit Basic Animal Profile", () => {
  after(() => resetAndVerifyBaseline());
  it("edits the controlled animal profile through the management UI", () => {
    loginAndOpenAnimal("FT_ANIMAL_PROFILE_EDIT");
    cy.intercept("PUT", "**/api/animals/FT_ANIMAL_PROFILE_EDIT").as("updateAnimal");
    cy.get("#btnEditProfile").click();
    cy.get("#eBreed").clear().type("Batch 8 Mixed Breed");
    cy.get("#eNotes").clear().type("Batch 8 FT profile edit");
    cy.get("#editModalSave").click();
    cy.wait("@updateAnimal", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
    registerAnimalMutation({ kind: "animalBasicEdit", primaryId: "FT_ANIMAL_PROFILE_EDIT" })
      .its("registeredPaths").should("have.length", 1);
    cy.get("#basicInfoGrid").should("contain.text", "Batch 8 Mixed Breed");
    animalApi("FT_ANIMAL_PROFILE_EDIT").its("body.animal").should("include", {
      breed: "Batch 8 Mixed Breed",
      notes: "Batch 8 FT profile edit",
    });
  });
});
