describe("FT-001 — Client Account Registration", () => {
  it("creates the dedicated FT client account and stops at the existing email-verification flow", () => {
    if (!Cypress.config("isInteractive")) {
      throw new Error(
        "FT-001 requires Cypress Open Mode so a person can complete the real Google reCAPTCHA.",
      );
    }

    const registrationEmail = Cypress.env("FT_REGISTRATION_ACCOUNT_EMAIL");
    const password = Cypress.env("FT_PUBLIC_PASSWORD");
    if (!registrationEmail || !password) {
      throw new Error(
        "FT-001 requires FT_REGISTRATION_ACCOUNT_EMAIL and FT_PUBLIC_PASSWORD in Cypress environment variables.",
      );
    }

    cy.intercept("POST", "**/api/auth/register").as("registerAccount");
    cy.visitPublicPage("/pages/public/home.html#login");
    cy.get("#authModal").should("not.have.class", "hidden");
    cy.get("#authSideAction").should("be.visible").click();
    cy.get("#register-section").should("be.visible");

    cy.get("#reg-first-name").type("FT");
    cy.get("#reg-last-name").type("Registration");
    cy.fillSensitiveInput("#reg-email", registrationEmail);
    cy.fillSensitiveInput("#reg-password", password);
    cy.fillSensitiveInput("#reg-confirm-password", password);
    cy.get("#reg-terms").check({ force: true }).should("be.checked");

    cy.get('#register-recaptcha iframe[title*="reCAPTCHA"]', { timeout: 60000 })
      .should("be.visible");
    cy.get("#register-recaptcha").scrollIntoView();
    cy.log("MANUAL STEP: Complete the visible Google reCAPTCHA, then click Resume in the Cypress runner.");
    cy.pause();

    cy.window().should((window) => {
      const captchaResponse = window.grecaptcha?.getResponse?.();
      expect(captchaResponse, "real reCAPTCHA response after manual completion")
        .to.be.a("string")
        .and.not.be.empty;
    });
    cy.get("#register-form .auth-submit-btn").should("be.enabled").click();

    cy.wait("@registerAccount", { timeout: 60000 }).then(({ request, response }) => {
      expect(request.body).to.include({
        fullName: "FT Registration",
        email: registrationEmail,
        termsAccepted: true,
        policyVersion: "1.0",
      });
      expect(request.body.firebaseUid).to.be.a("string").and.not.be.empty;
      expect(request.body.firebaseIdToken).to.be.a("string").and.not.be.empty;
      expect(request.body.captchaToken).to.be.a("string").and.not.be.empty;
      expect(response?.statusCode).to.equal(201);
      expect(response?.body).to.deep.include({
        requiresEmailVerification: true,
        message: "Registration successful. Please verify your email before logging in.",
      });
    });

    cy.get("#email-verification-screen", { timeout: 30000 })
      .should("be.visible")
      .and("contain.text", "Verify your email")
      .and("contain.text", "Email OTP");
    cy.get("#register-form").should("have.class", "hidden");
    cy.window().then((window) => {
      expect(window.localStorage.getItem("is_logged_in")).not.to.equal("true");
      expect(window.localStorage.getItem("animua_token")).to.be.null;
    });
  });
});
