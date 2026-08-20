const { animalApi, loginAndOpenAnimal, registerAnimalMutation, resetAndVerifyBaseline } = require("../../../support/animal-functionality");

describe("FT-056 - Archive Animal Record", () => {
  after(() => resetAndVerifyBaseline());
  it("archives the controlled candidate through the profile UI", () => {
    loginAndOpenAnimal("FT_ANIMAL_ARCHIVE_CANDIDATE");
    cy.intercept("PATCH", "**/api/animals/FT_ANIMAL_ARCHIVE_CANDIDATE/archive").as("archive");
    cy.get('button[aria-label="More profile actions"]').click();
    cy.get("#ddArchive").should("be.visible").click();
    cy.wait("@archive", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
    registerAnimalMutation({ kind: "animalArchive", primaryId: "FT_ANIMAL_ARCHIVE_CANDIDATE" })
      .its("registeredPaths").should("have.length", 1);
    cy.get("#profileStatusBadge").should("contain.text", "Archived");
    animalApi("FT_ANIMAL_ARCHIVE_CANDIDATE").then((response) => {
      expect(response.body?.animal).to.include({
        status: "Archived",
        statusBeforeArchive: "Ready",
        archiveReason: "Other",
      });
      expect(response.body?.animal?.archivedBy).to.equal(Cypress.env("FT_ADMIN_ACTIVE_EMAIL"));
    });
  });
});
