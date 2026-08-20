const path = require("path");
const { loginAndOpenArchive } = require("../../../support/final-batch-functionality");

describe("FT-077 - Export Archived Records", () => {
  it("exports the currently supported archived-record CSV", () => {
    loginAndOpenArchive();
    cy.get("#btnExportArchive").should("be.visible").click();
    cy.get("#umToast").should("have.class", "show").and("contain.text", "Archived records exported.");
    cy.readFile(path.join(Cypress.config("downloadsFolder"), "archived-records.csv"), "utf8", {
      timeout: 30000,
    }).then((csv) => {
      expect(csv).to.include("Archive ID");
      expect(csv).to.include("FT_ANIMAL_ARCHIVED");
    });
  });
});
