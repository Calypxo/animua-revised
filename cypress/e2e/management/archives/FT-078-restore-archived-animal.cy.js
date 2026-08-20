const {
  apiRequest,
  currentToken,
  loginAndOpenArchive,
  registerFinalMutation,
  resetAndVerifyBaseline,
} = require("../../../support/final-batch-functionality");

describe("FT-078 - Restore Archived Animal", () => {
  after(() => resetAndVerifyBaseline());

  it("restores the controlled archived animal to its prior active state", () => {
    loginAndOpenArchive();
    cy.get("#searchArchive").type("FT_ANIMAL_ARCHIVED");
    cy.intercept("PATCH", "**/api/animals/FT_ANIMAL_ARCHIVED/restore").as("restoreAnimal");
    cy.get('[data-view-id="ARC-ANIMAL-FT_ANIMAL_ARCHIVED"]').click();
    cy.get("#modalRestoreBtn").should("be.visible").click();
    cy.get(".swal2-confirm").should("contain.text", "Restore Record").click();
    cy.wait("@restoreAnimal", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.status).to.equal("Ready");
    });
    registerFinalMutation({ kind: "animalRestore", primaryId: "FT_ANIMAL_ARCHIVED" })
      .its("registeredPaths").should("have.length", 1);
    cy.get("#archiveTableBody").should("not.contain.text", "FT_ANIMAL_ARCHIVED");
    currentToken().then((token) => apiRequest({ path: "animals/FT_ANIMAL_ARCHIVED", token }))
      .then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body?.animal).to.include({ id: "FT_ANIMAL_ARCHIVED", status: "Ready" });
      });
    cy.intercept("GET", "**/api/animals/FT_ANIMAL_ARCHIVED").as("restoredProfile");
    cy.visitManagementPage("/pages/animalProfile.html?id=FT_ANIMAL_ARCHIVED");
    cy.wait("@restoredProfile", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
    cy.get("#profileStatusBadge").should("contain.text", "Ready");
  });
});
