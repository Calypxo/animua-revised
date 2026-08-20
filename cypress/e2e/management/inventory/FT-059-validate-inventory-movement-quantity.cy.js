const {
  loginAndOpenInventory,
  registerMutation,
  resetAndVerifyBaseline,
} = require("../../../support/batch9-functionality");

describe("FT-059 - Validate Inventory Movement Quantity", () => {
  after(() => resetAndVerifyBaseline());

  it("rejects zero and fractional quantities before recording one valid movement", () => {
    let movementRequests = 0;
    loginAndOpenInventory();
    cy.intercept("POST", "**/api/inventory/FT_TEST_BATCH_OUT_02/stock-out", (request) => {
      movementRequests += 1;
    }).as("stockOut");
    cy.get("#searchInventory").type("FT_TEST_BATCH_OUT_02");
    cy.get('tr[data-id="FT_TEST_BATCH_OUT_02"] [data-action="use"]').click();
    cy.get("#fOutQty").type("1.5");
    cy.get("#stockOutSave").click();
    cy.get("#errOutQty").should("contain.text", "valid quantity");
    cy.then(() => expect(movementRequests).to.equal(0));
    cy.get("#fOutQty").clear().type("0");
    cy.get("#stockOutSave").click();
    cy.get("#errOutQty").should("contain.text", "valid quantity");
    cy.then(() => expect(movementRequests).to.equal(0));
    cy.get("#fOutQty").clear().type("2");
    cy.get("#fOutProcedure").select("Other");
    cy.get("#fOutNotes").type("FT-059 controlled valid movement");
    cy.get("#stockOutSave").click();
    cy.wait("@stockOut", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(201);
      const transactionId = response?.body?.transaction?.id;
      expect(transactionId).to.be.a("string").and.not.be.empty;
      registerMutation({
        kind: "inventoryMovement",
        primaryId: "FT_TEST_BATCH_OUT_02",
        movementType: "out",
        transactionId,
        quantity: 2,
        responseStatus: 201,
      });
    });
    cy.then(() => expect(movementRequests).to.equal(1));
  });
});
