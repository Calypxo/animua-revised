describe("FT-026 — Management Role-Based Access", () => {
  function assertNavigation({ visible = [], hidden = [] }) {
    visible.forEach((label) => cy.get("#sidebar").should("contain.text", label));
    hidden.forEach((label) => cy.get("#sidebar").should("not.contain.text", label));
  }

  function clearSessionForNextRole() {
    cy.window().then((window) => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    cy.clearCookies();
  }

  it("enforces the configured Admin, Staff, and Veterinarian module access", () => {
    cy.loginAdmin();
    assertNavigation({
      visible: ["User Management", "Audit Trail", "Adoption Applications", "Inventory"],
    });
    cy.visitManagementPage("/pages/userManagement.html");
    cy.location("pathname", { timeout: 30000 }).should("eq", "/pages/userManagement.html");
    cy.get("body").should("not.contain.text", "Unauthorized Access");
    clearSessionForNextRole();

    cy.loginStaff();
    assertNavigation({
      visible: ["Animal Intake", "Surrender Requests", "Adoption Applications", "Inventory"],
      hidden: ["User Management", "Audit Trail"],
    });
    cy.visitManagementPage("/pages/userManagement.html");
    cy.location("pathname", { timeout: 30000 }).should("eq", "/pages/unauthorized.html");
    clearSessionForNextRole();

    cy.loginVet();
    assertNavigation({
      visible: ["Animal Profiling", "Inventory", "Reports"],
      hidden: ["Animal Intake", "Surrender Requests", "Adoption Applications", "User Management", "Audit Trail"],
    });
    cy.visitManagementPage("/pages/adoptionApplications.html");
    cy.location("pathname", { timeout: 30000 }).should("eq", "/pages/unauthorized.html");
  });
});
