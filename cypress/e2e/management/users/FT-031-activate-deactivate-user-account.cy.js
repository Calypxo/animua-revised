describe("FT-031 — Activate and Deactivate User Account", () => {
  it("deactivates and reactivates the seeded mutable management account", () => {
    const email = Cypress.env("FT_MANAGEMENT_PROFILE_MUTABLE_EMAIL");

    cy.loginAdmin();
    cy.intercept("GET", "**/api/users").as("users");
    cy.intercept("PATCH", `**/api/users/${encodeURIComponent(email)}/toggle-status`).as("toggleStatus");
    cy.visitManagementPage("/pages/userManagement.html");
    cy.wait("@users", { timeout: 30000 });
    cy.get("#searchUsers").type(email);

    const openStatusAction = (label) => {
      cy.get(`.user-record-card[data-id="${email}"]`).within(() => {
        cy.get(".user-menu-trigger").click();
        cy.contains('[data-action="toggle"]', label).click();
      });
    };

    openStatusAction("Deactivate account");
    cy.get("#deactivateTitle").should("have.text", "Deactivate User");
    cy.get("#deactivateConfirmBtn").click();
    cy.wait("@toggleStatus", { timeout: 30000 })
      .its("response.body.status")
      .should("eq", "Inactive");
    cy.get(`.user-record-card[data-id="${email}"]`).should("contain.text", "Inactive");

    openStatusAction("Activate account");
    cy.get("#deactivateTitle").should("have.text", "Activate User");
    cy.get("#deactivateConfirmBtn").click();
    cy.wait("@toggleStatus", { timeout: 30000 })
      .its("response.body.status")
      .should("eq", "Active");
    cy.get(`.user-record-card[data-id="${email}"]`).should("contain.text", "Active");
    cy.task("registerFtGeneratedRecords", { kind: "userStatus" });
  });
});
