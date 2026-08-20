const { resetAndVerifyBaseline } = require("../../../support/integration");

describe("FT-033 — Browse Surrender Requests", () => {
  before(() => resetAndVerifyBaseline());

  it("shows seeded surrender states and opens complete request details", () => {
    cy.loginAdmin();
    cy.intercept("GET", "**/api/surrenders").as("surrenders");
    cy.visitManagementPage("/pages/surrenders.html");
    cy.wait("@surrenders", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      const requests = response?.body?.requests || [];
      [
        ["FT_SURRENDER_PENDING", "Pending"],
        ["FT_SURRENDER_SCHEDULED", "Approved"],
        ["FT_SURRENDER_REJECTED", "Rejected"],
        ["FT_SURRENDER_EXPIRED", "Expired"],
        ["FT_SURRENDER_CONVERTED", "Converted"],
      ].forEach(([id, status]) => {
        expect(requests.find((request) => request.id === id)).to.include({ id, status });
      });
    });

    cy.get("#searchSR").type("FT_SURRENDER_PENDING");
    cy.get('tr[data-id="FT_SURRENDER_PENDING"]').should("be.visible").click();
    cy.get("#srDrawer").should("have.attr", "aria-hidden", "false");
    cy.get("#srDrawerInner")
      .should("contain.text", "FT_SURRENDER_PENDING")
      .and("contain.text", "Owner Information")
      .and("contain.text", "Pet Information")
      .and("contain.text", "Pending");
  });
});
