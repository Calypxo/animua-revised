describe("FT-006 — Client Password Change", () => {
  it("changes the dedicated mutable client's password after real email OTP verification", () => {
    if (!Cypress.config("isInteractive")) {
      throw new Error(
        "FT-006 requires Cypress Open Mode so a person can enter the real email OTP.",
      );
    }

    const email = Cypress.env("FT_CLIENT_PROFILE_MUTABLE_EMAIL");
    const currentPassword = Cypress.env("FT_PUBLIC_PASSWORD");
    const newPassword = Cypress.env("FT_CLIENT_PROFILE_MUTABLE_NEW_PASSWORD");
    if (!email || !currentPassword || !newPassword) {
      throw new Error(
        "FT-006 requires FT_CLIENT_PROFILE_MUTABLE_EMAIL, FT_PUBLIC_PASSWORD, and FT_CLIENT_PROFILE_MUTABLE_NEW_PASSWORD in Cypress environment variables.",
      );
    }
    expect(newPassword, "the controlled replacement password differs from baseline")
      .not.to.equal(currentPassword);

    cy.loginClient({ email, password: currentPassword });
    cy.intercept("GET", "**/api/auth/account").as("currentAccount");
    cy.intercept("POST", "**/api/auth/request-password-change-otp").as("requestPasswordOtp");
    cy.intercept("POST", "**/api/auth/confirm-password-change-otp").as("confirmPasswordOtp");

    cy.get("#userMenuBtn").click();
    cy.get("#viewProfileBtn").click();
    cy.wait("@currentAccount", { timeout: 30000 })
      .its("response.statusCode")
      .should("eq", 200);
    cy.get("#profilePasswordBtn").should("be.visible").click();
    cy.get(".change-password-modal").should("contain.text", "Change Password");
    cy.fillSensitiveInput("#oldPassword", currentPassword);
    cy.fillSensitiveInput("#newPassword", newPassword);
    cy.fillSensitiveInput("#confirmNewPassword", newPassword);
    cy.get(".swal2-confirm").should("contain.text", "Send OTP").click();

    cy.wait("@requestPasswordOtp", { timeout: 60000 })
      .its("response.statusCode")
      .should("eq", 200);
    cy.get(".password-change-otp-screen", { timeout: 30000 })
      .should("be.visible")
      .and("contain.text", "Verify Your Account");
    cy.get("#password-change-otp-code", { log: false }).focus({ log: false });
    cy.log("MANUAL STEP: Read the six-digit password-change OTP from the dedicated mailbox, enter it in the visible OTP boxes, then click Resume in the Cypress runner.");
    cy.pause();

    cy.get("#password-change-otp-code", { log: false }).should(($input) => {
      expect(String($input.val()), "a manually entered six-digit OTP").to.match(/^\d{6}$/);
    });
    cy.get("#confirm-password-change-otp-btn").click();
    cy.wait("@confirmPasswordOtp", { timeout: 60000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.message).to.equal("Password changed successfully.");
    });
    cy.get(".change-password-success")
      .should("be.visible")
      .and("contain.text", "Password Updated")
      .and("contain.text", "Your password has been changed.");

    cy.task("registerFtGeneratedRecords", { kind: "passwordChange" });
    cy.get(".swal2-confirm").should("contain.text", "OK").click();
    cy.logoutClient();
    cy.loginClient({ email, password: newPassword });
  });
});
