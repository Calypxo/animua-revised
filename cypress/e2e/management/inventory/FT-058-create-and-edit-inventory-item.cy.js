const {
  loginAndOpenInventory,
  registerMutation,
  resetAndVerifyBaseline,
} = require("../../../support/batch9-functionality");

describe("FT-058 - Create and Edit Inventory Item", () => {
  after(() => resetAndVerifyBaseline());

  it("creates and edits one exact controlled inventory item through the UI", () => {
    loginAndOpenInventory();
    cy.intercept("POST", "**/api/inventory").as("createItem");
    cy.intercept("PUT", "**/api/inventory/ITM013X").as("updateItem");
    cy.get("#btnAddItem").should("be.visible").click();
    cy.get("#fItemName").type("Batch 9 FT Generated Item");
    cy.get("#fItemCategory").select("Consumable");
    cy.get("#fItemUnit").type("pcs");
    cy.get("#fItemCurrentStock").type("7");
    cy.get("#fItemAvgUsage").type("3");
    cy.get("#fItemLeadTime").type("5");
    cy.get("#itemModalSave").click();
    cy.wait("@createItem", { timeout: 30000 }).then(({ request, response }) => {
      expect(response?.statusCode).to.equal(201);
      expect(request.body).to.include({ id: "ITM013X", name: "Batch 9 FT Generated Item", currentStock: 7 });
      return registerMutation({ kind: "inventoryItem", primaryId: "ITM013X", minimum: 1 });
    });
    cy.wait("@inventoryListAdmin", { timeout: 30000 });
    cy.get("body").then(($body) => {
      if ($body.find("#drawerEditBtn").length) {
        cy.get("#drawerEditBtn").should("be.visible").click();
        return;
      }
      cy.get("#searchInventory").clear().type("ITM013X");
      cy.get('tr[data-id="ITM013X"] [data-action="view"]').click();
      cy.get("#drawerEditBtn").should("be.visible").click();
    });
    cy.get("#fItemName").clear().type("Batch 9 FT Generated Item Edited");
    cy.get("#fItemCurrentStock").clear().type("8");
    cy.get("#itemModalSave").click();
    cy.wait("@updateItem", { timeout: 30000 }).then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(request.body).to.include({ id: "ITM013X", name: "Batch 9 FT Generated Item Edited", currentStock: 8 });
    });
    cy.wait("@inventoryListAdmin", { timeout: 30000 });
    cy.get("#drawerCloseBtn").click();
    cy.get("#searchInventory").clear().type("ITM013X");
    cy.get('tr[data-id="ITM013X"]').should("contain.text", "Batch 9 FT Generated Item Edited");
    registerMutation({ kind: "inventoryItem", primaryId: "ITM013X", minimum: 2 }).then(({ registeredPaths }) => {
      expect(registeredPaths).to.include("inventoryItems/ITM013X");
      expect(registeredPaths.filter((path) => path.startsWith("auditLogs/"))).to.have.length(2);
    });
  });
});
