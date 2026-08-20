const { loginAndOpenInventory } = require("../../../support/batch9-functionality");

describe("FT-057 - Browse Inventory and Predictions", () => {
  it("browses seeded stock records and live prediction states without mutation", () => {
    loginAndOpenInventory();
    cy.get("#predictiveStatus").should("not.have.class", "predictive-loading");
    cy.get("#searchInventory").type("FT_TEST_PREDICT_OK");
    cy.get('tr[data-id="FT_TEST_PREDICT_OK"]')
      .should("be.visible")
      .invoke("text")
      .should("match", /(?:Fast|Slow) Moving/);
    cy.get('tr[data-id="FT_TEST_PREDICT_OK"] [data-action="view"]').click();
    cy.get("#viewItemModalBackdrop").should("be.visible").and("contain.text", "FT_TEST_PREDICT_OK");
    cy.get("#drawerCloseBtn").click();
    cy.get("#searchInventory").clear().type("FT_TEST_PREDICT_UNAVAILABLE");
    cy.get('tr[data-id="FT_TEST_PREDICT_UNAVAILABLE"]')
      .should("be.visible")
      .and("contain.text", "Unavailable");
  });
});
