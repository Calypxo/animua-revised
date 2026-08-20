describe("FT-002 — Email OTP Verification", () => {
  it("verifies the seeded unverified client through the real email OTP flow", () => {
    if (!Cypress.config("isInteractive")) {
      throw new Error(
        "FT-002 requires Cypress Open Mode so a person can enter the real email OTP.",
      );
    }

    const email = Cypress.env("FT_CLIENT_UNVERIFIED_EMAIL");
    const password = Cypress.env("FT_PUBLIC_PASSWORD");
    if (!email || !password) {
      throw new Error(
        "FT-002 requires FT_CLIENT_UNVERIFIED_EMAIL and FT_PUBLIC_PASSWORD in Cypress environment variables.",
      );
    }

    cy.intercept("POST", "**/api/auth/login").as("unverifiedLogin");
    cy.intercept("POST", "**/api/auth/request-email-verification-otp").as("requestEmailOtp");
    cy.intercept("POST", "**/api/auth/confirm-email-verification-otp").as("confirmEmailOtp");

    cy.visitPublicPage("/pages/public/home.html#login");
    cy.get("#authModal").should("not.have.class", "hidden");
    cy.fillSensitiveInput("#login-email", email);
    cy.fillSensitiveInput("#login-password", password);
    cy.get("#login-form .auth-submit-btn").click();

    cy.wait("@unverifiedLogin", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(403);
      expect(response?.body?.verificationRequired).to.equal(true);
    });
    cy.wait("@requestEmailOtp", { timeout: 60000 })
      .its("response.statusCode")
      .should("eq", 200);

    cy.get("#email-verification-screen", { timeout: 30000 })
      .should("be.visible")
      .and("contain.text", "Verify your email");
    cy.get("#email-verification-message")
      .should("contain.text", "six-digit OTP");
    cy.get("#email-verification-code", { log: false }).focus({ log: false });
    cy.log("MANUAL STEP: Read the six-digit OTP from the dedicated mailbox, enter it in the visible OTP boxes, then click Resume in the Cypress runner.");
    cy.pause();

    cy.get("#email-verification-code", { log: false }).should(($input) => {
      expect(String($input.val()), "a manually entered six-digit OTP").to.match(/^\d{6}$/);
    });
    cy.get("#check-email-verification-btn").click();
    cy.wait("@confirmEmailOtp", { timeout: 60000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.message).to.equal("Email verified successfully.");
      expect(response?.body?.emailVerified).to.equal(true);
    });

    cy.location("pathname", { timeout: 30000 }).should("eq", "/pages/public/home.html");
    cy.get("#userLoggedInBox", { timeout: 30000 }).should("be.visible");
    cy.getCookie("animua_session").should((cookie) => {
      expect(cookie, "HttpOnly session created by OTP confirmation").not.to.be.null;
      expect(cookie.httpOnly).to.equal(true);
    });
    cy.window().then((window) => {
      expect(window.localStorage.getItem("is_logged_in")).to.be.null;
      expect(window.localStorage.getItem("user_email")).to.be.null;
      expect(window.localStorage.getItem("animua_token")).to.be.null;
    });
  });
});
