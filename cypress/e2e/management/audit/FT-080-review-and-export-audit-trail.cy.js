const path = require("path");
const { loginAndOpenAudit } = require("../../../support/final-batch-functionality");

describe("FT-080 - Review and Export Audit Trail", () => {
  it("reviews both controlled audit records and exports the supported CSV", () => {
    loginAndOpenAudit();
    cy.get("#searchAudit").type("FT_ANIMAL_PROFILE_EDIT");
    cy.get("#auditTableBody .audit-row").should("have.length", 1)
      .and("contain.text", "Animal Profiling")
      .and("contain.text", "Updated")
      .and("contain.text", "FT Staff Active");
    cy.get('[data-view-id="FT_AUDIT_ANIMAL"]').click();
    cy.get("#viewAuditModalBackdrop").should("have.class", "open");
    cy.get("#viewAuditContent").should("contain.text", "FT_AUDIT_ANIMAL")
      .and("contain.text", "FT_ANIMAL_PROFILE_EDIT")
      .and("contain.text", "Success");
    cy.get("#viewAuditClose").click();
    cy.get("#clearAuditFilters").click();
    cy.get("#searchAudit").type("FT Client Active");
    cy.get("#auditTableBody").should("contain.text", "Authentication")
      .and("contain.text", "Login");
    cy.get("#clearAuditFilters").click();
    cy.get("#btnExportAudit").click();
    cy.get("#umToast").should("have.class", "show").and("contain.text", "Audit logs exported.");
    cy.readFile(path.join(Cypress.config("downloadsFolder"), "audit-trail-logs.csv"), "utf8", {
      timeout: 30000,
    }).then((csv) => {
      expect(csv).to.include("FT_AUDIT_LOGIN");
      expect(csv).to.include("FT_AUDIT_ANIMAL");
    });
  });
});
