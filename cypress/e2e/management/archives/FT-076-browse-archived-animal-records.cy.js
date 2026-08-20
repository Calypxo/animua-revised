const { loginAndOpenArchive } = require("../../../support/final-batch-functionality");

describe("FT-076 - Browse Archived Animal Records", () => {
  it("opens the controlled archived animal and displays its retained information", () => {
    loginAndOpenArchive();
    cy.get("#searchArchive").type("FT_ANIMAL_ARCHIVED");
    cy.get("#archiveTableBody .archive-row").should("have.length", 1)
      .and("contain.text", "FT_ANIMAL_ARCHIVED")
      .and("contain.text", "Animal Management")
      .and("contain.text", "Other");
    cy.get('[data-view-id="ARC-ANIMAL-FT_ANIMAL_ARCHIVED"]').click();
    cy.get("#viewArchiveModalBackdrop").should("have.class", "open");
    cy.get("#viewArchiveContent")
      .should("contain.text", "FT_ANIMAL_ARCHIVED")
      .and("contain.text", "Animal Record")
      .and("contain.text", "Synthetic archived baseline")
      .and("contain.text", "FT Admin Active");
  });
});
