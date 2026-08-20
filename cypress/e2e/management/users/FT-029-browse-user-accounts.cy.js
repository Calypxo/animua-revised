describe("FT-029 — Browse User Accounts", () => {
  it("loads seeded accounts with useful identity, role, and status information", () => {
    const adminEmail = Cypress.env("FT_ADMIN_ACTIVE_EMAIL");
    const inactiveEmail = Cypress.env("FT_MANAGEMENT_INACTIVE_EMAIL");
    const publicEmail = Cypress.env("FT_CLIENT_ACTIVE_EMAIL");

    cy.loginAdmin();
    cy.intercept("GET", "**/api/users").as("users");
    cy.visitManagementPage("/pages/userManagement.html");
    cy.wait("@users", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      const users = response?.body?.users || [];
      expect(users.find((user) => user.email === adminEmail)).to.include({ role: "Admin", status: "Active" });
      expect(users.find((user) => user.email === inactiveEmail)).to.include({ role: "Staff", status: "Inactive" });
      expect(users.find((user) => user.email === publicEmail)).to.include({ role: "Public", status: "Active" });
    });

    cy.get("#userResultCount").should("contain.text", "accounts");
    cy.get("#searchUsers").type(inactiveEmail);
    cy.get(`.user-record-card[data-id="${inactiveEmail}"]`)
      .should("be.visible")
      .and("contain.text", inactiveEmail)
      .and("contain.text", "Staff")
      .and("contain.text", "Inactive")
      .find('[data-action="view"]')
      .first()
      .click();
    cy.get("#viewModalBackdrop").should("have.class", "open");
    cy.get("#viewModalBody")
      .should("contain.text", inactiveEmail)
      .and("contain.text", "Staff")
      .and("contain.text", "Inactive");
  });
});
