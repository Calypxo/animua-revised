const { loginAndOpenInventory } = require("../../../support/batch9-functionality");

describe("FT-061 - Enforce Inventory Role Controls", () => {
  it("shows mutation controls to Admin and keeps Veterinarian inventory read-only", () => {
    loginAndOpenInventory("Admin");
    cy.get("#btnStockIn").should("be.visible");
    cy.get("#btnRecordUsage").should("be.visible");
    cy.get("#btnAddItem").should("be.visible");
    loginAndOpenInventory("Veterinarian");
    cy.get("#btnStockIn").should("not.be.visible");
    cy.get("#btnRecordUsage").should("not.be.visible");
    cy.get("#btnAddItem").should("not.be.visible");
    cy.get('#inventoryTableBody [data-action="view"]').should("exist");
    cy.get('#inventoryTableBody [data-action="stockin"], #inventoryTableBody [data-action="use"]').should("not.exist");
  });
});
