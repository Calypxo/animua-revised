describe("FT-003 — Client Login", () => {
  it("authenticates the active FT client through the public login interface", () => {
    const email = Cypress.env("FT_CLIENT_ACTIVE_EMAIL");
    const password = Cypress.env("FT_PUBLIC_PASSWORD");

    expect(email, "FT client email is configured").to.be.a("string").and.not.be.empty;
    expect(password, "FT public password is configured").to.be.a("string").and.not.be.empty;

    cy.intercept("POST", "**/api/auth/login").as("loginRequest");
    cy.visitPublicPage("/pages/public/home.html#login", {
      onBeforeLoad(window) {
        window.localStorage.clear();
        window.sessionStorage.clear();
      },
    });

    cy.get("#authModal").should("not.have.class", "hidden");
    cy.fillSensitiveInput("#login-email", email);
    cy.fillSensitiveInput("#login-password", password);
    cy.get("#login-form").then(($form) => {
      expect($form[0].checkValidity(), "login form is valid").to.equal(true);
    });
    cy.get("#login-form .auth-submit-btn").click();

    cy.wait("@loginRequest", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.account?.role || response?.body?.role).to.equal("Public");
    });
    cy.get("#userLoggedInBox", { timeout: 30000 }).should("be.visible");
    cy.get("#loginNavBtn").should("not.be.visible");
    cy.window().then((window) => {
      expect(window.localStorage.getItem("animua_token")).to.be.a("string").and.not.be.empty;
      expect(window.localStorage.getItem("user_role")).to.equal("Public");
      expect(window.localStorage.getItem("user_email")).to.equal(email);
      expect(window.localStorage.getItem("is_logged_in")).to.equal("true");
    });
  });
});
