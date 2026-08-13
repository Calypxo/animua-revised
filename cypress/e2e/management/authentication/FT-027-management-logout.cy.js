describe("FT-027 — Management Logout and Session Removal", () => {
  it("logs out through the management UI and blocks the old protected session", () => {
    cy.loginAdmin();
    cy.logoutManagement();

    cy.window().then((window) => {
      expect(window.localStorage.getItem("animua_token")).to.be.null;
      expect(window.localStorage.getItem("user_role")).to.be.null;
    });
    cy.visitManagementPage("/pages/dashboard.html");
    cy.location("pathname", { timeout: 30000 }).should("eq", "/pages/admin-login.html");
    cy.reload();
    cy.location("pathname").should("eq", "/pages/admin-login.html");
    cy.get("#login-form").should("be.visible");
    cy.window().then((window) => {
      expect(window.localStorage.getItem("is_logged_in"), "management login-state flag").to.be.null;
    });
  });
});
