const {
  loginAndOpenInventory,
  registerMutation,
  resetAndVerifyBaseline,
} = require("../../../support/batch9-functionality");

describe("FT-060 - Record Batch Inventory Movements", () => {
  after(() => resetAndVerifyBaseline());

  it("records exact multi-item stock-in and usage batches through the UI", () => {
    const movements = [];
    loginAndOpenInventory();
    cy.intercept("POST", "**/api/inventory/*/stock-in").as("batchIn");
    cy.intercept("POST", "**/api/inventory/*/stock-out").as("batchOut");
    cy.get("#btnStockIn").click();
    cy.get("#addStockInBatchRow").click();
    cy.get("#stockInBatchRows .batch-row").should("have.length", 2).each(($row, index) => {
      const ids = ["FT_TEST_BATCH_IN_01", "FT_TEST_BATCH_IN_02"];
      const quantities = [3, 4];
      cy.wrap($row).find(".batch-stock-item").select(ids[index]);
      cy.wrap($row).find(".batch-stock-qty").type(String(quantities[index]));
      cy.wrap($row).find(".batch-stock-note").type(`FT-060 stock in ${index + 1}`);
    });
    cy.get("#stockInSave").click();
    cy.wait(["@batchIn", "@batchIn"], { timeout: 30000 }).each(({ request, response }) => {
      expect(response?.statusCode).to.equal(201);
      movements.push({
        primaryId: request.url.match(/inventory\/([^/]+)\/stock-in/)[1],
        movementType: "in",
        transactionId: response.body.transaction.id,
        quantity: request.body.qty,
      });
    });
    cy.wait("@inventoryListAdmin", { timeout: 30000 });
    cy.get("#btnRecordUsage").click();
    cy.get("#addStockOutBatchRow").click();
    cy.get("#stockOutBatchRows .batch-row").should("have.length", 2).each(($row, index) => {
      const ids = ["FT_TEST_BATCH_OUT_01", "FT_TEST_BATCH_OUT_02"];
      const quantities = [2, 3];
      cy.wrap($row).find(".batch-out-item").select(ids[index]);
      cy.wrap($row).find(".batch-out-qty").type(String(quantities[index]));
      cy.wrap($row).find(".batch-out-procedure").select("Other");
    });
    cy.get("#stockOutSave").click();
    cy.wait(["@batchOut", "@batchOut"], { timeout: 30000 }).each(({ request, response }) => {
      expect(response?.statusCode).to.equal(201);
      movements.push({
        primaryId: request.url.match(/inventory\/([^/]+)\/stock-out/)[1],
        movementType: "out",
        transactionId: response.body.transaction.id,
        quantity: request.body.qty,
      });
    });
    cy.then(() => {
      expect(movements).to.have.length(4);
      movements.forEach((movement) => registerMutation({
        kind: "inventoryMovement",
        ...movement,
        responseStatus: 201,
      }));
    });
  });
});
