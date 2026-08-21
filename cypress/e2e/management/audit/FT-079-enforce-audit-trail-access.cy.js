const { loginAndOpenAudit } = require("../../../support/final-batch-functionality");

describe("FT-079 - Enforce Audit Trail Access", () => {
  it("allows Admin access and blocks the configured restricted Staff role", () => {
    loginAndOpenAudit();
    cy.location("pathname").should("eq", "/pages/auditTrail.html");
    cy.get("#auditTableBody").should("contain.text", "FT_ANIMAL_PROFILE_EDIT");
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.loginStaff();
    cy.visitManagementPage("/pages/auditTrail.html");
    cy.location("pathname", { timeout: 30000 }).should("eq", "/pages/unauthorized.html");
    cy.get("body").should("contain.text", "Access Denied");
  });
});
