const { disableCaching } = require("../../../support/final-batch-functionality");

describe("FT-025 — Management Portal Login", () => {
  it("authenticates the active FT administrator through the management login", () => {
    const email = Cypress.env("FT_ADMIN_ACTIVE_EMAIL");
    const password = Cypress.env("FT_MANAGEMENT_PASSWORD");

    expect(email, "FT admin email is configured").to.be.a("string").and.not.be.empty;
    expect(password, "FT management password is configured").to.be.a("string").and.not.be.empty;

    cy.intercept("POST", "**/api/auth/login").as("loginRequest");
    cy.intercept("GET", "**/api/protected").as("protectedSession");
    cy.intercept("GET", "**/api/dashboard/stats").as("dashboardStats");
    cy.visitManagementPage("/pages/admin-login.html", {
      onBeforeLoad(window) {
        window.localStorage.clear();
        window.sessionStorage.clear();
      },
    });
    cy.wait("@protectedSession", { timeout: 30000 })
      .its("response.statusCode")
      .should("eq", 401);
    cy.fillSensitiveInput("#login-email", email);
    cy.fillSensitiveInput("#login-password", password);
    cy.get("#login-form button[type='submit']").click();

    cy.wait("@loginRequest", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
    cy.location("pathname", { timeout: 30000 }).should("eq", "/pages/dashboard.html");
    cy.wait("@protectedSession", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
    cy.wait("@dashboardStats", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
    cy.get("#sidebar").should("be.visible").and("contain.text", "Dashboard");
    cy.get("#display-role").should("contain.text", "Admin");
    cy.assertHardenedBrowserStorage();
    cy.window().then((window) => {
      expect(window.localStorage.getItem("animua_token")).to.be.null;
      expect(window.localStorage.getItem("user_role")).to.be.null;
      expect(window.localStorage.getItem("user_email")).to.be.null;
    });

    cy.intercept(
      { method: "GET", url: "**/api/auth/account", middleware: true },
      disableCaching,
    ).as("adminAccount");
    cy.visitManagementPage("/pages/accountSettings.html");
    cy.wait("@adminAccount", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.account).to.include({ email, role: "Admin" });
    });
    cy.get("#profileForm").scrollIntoView().should("be.visible");
    cy.get("#emailInput").should("have.value", email);
    cy.get("#roleInput").should("have.value", "Admin");
    cy.assertHardenedBrowserStorage();
  });
});
