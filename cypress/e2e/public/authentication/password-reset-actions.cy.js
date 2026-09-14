// Exercise the real recovery UI without sending an email or changing an account.
describe("Password reset action buttons", () => {
  beforeEach(() => {
    cy.intercept("**/api/**", (request) => {
      if (new URL(request.url).pathname.endsWith("/auth/account")) {
        return request.reply({ statusCode: 401, body: { message: "Not signed in" } });
      }
      request.reply({ animals: [], announcements: [], requests: [] });
    });
    cy.intercept("POST", "**/api/auth/request-forgot-password-otp", { message: "Test OTP sent" }).as("requestOtp");
    cy.visit("/pages/public/home.html");
    cy.get("#loginNavBtn").click();
    cy.contains("a.auth-muted-link", "Forgot password?").click();
    cy.get("#forgotPasswordEmail").type("reset-test@example.com");
    cy.get(".swal2-confirm").contains("Send OTP").click();
    cy.wait("@requestOtp");
    cy.get("#password-change-otp-code").type("123456", { force: true });
    cy.get("#confirm-password-change-otp-btn").click();
    cy.get("#forgotNewPassword").should("be.visible");
  });

  function expectActions() {
    cy.get(".swal2-actions").should("exist").and("be.visible");
    cy.get(".swal2-confirm").should("be.visible").and("have.text", "Reset Password");
    cy.get(".swal2-cancel").should("be.visible").and("have.text", "Cancel");
    cy.get(".swal2-popup").should("not.have.class", "change-password-popup--otp");
  }

  it("restores the footer after OTP and submits the replacement password", () => {
    expectActions();
    cy.get(".swal2-confirm").click();
    cy.get(".swal2-validation-message").should("be.visible");
    cy.get("#forgotNewPassword").type("SyntheticPassword42!");
    cy.get("#forgotConfirmNewPassword").type("SyntheticPassword42!");
    cy.get(".swal2-popup").screenshot("password-reset-desktop");
    cy.intercept("POST", "**/api/auth/confirm-forgot-password-otp", {
      delay: 500,
      body: { message: "Password reset successfully." },
    }).as("reset");
    cy.get(".swal2-confirm").click();
    cy.get(".swal2-confirm").should("be.disabled");
    cy.wait("@reset").then(({ request }) => {
      expect(request.body).to.deep.equal({ email: "reset-test@example.com", otp: "123456", newPassword: "SyntheticPassword42!" });
    });
    cy.get(".password-update-success-popup").should("be.visible").and("contain.text", "Password Reset");
    cy.get(".swal2-confirm").should("be.visible").and("have.text", "Done");
  });

  it("keeps mobile actions available after an error and allows cancel", () => {
    cy.viewport(390, 667);
    expectActions();
    cy.get("#forgotNewPassword").type("SyntheticPassword42!");
    cy.get("#forgotConfirmNewPassword").type("SyntheticPassword42!");
    cy.intercept("POST", "**/api/auth/confirm-forgot-password-otp", {
      statusCode: 400, body: { message: "The test OTP has expired. Request a new code." },
    }).as("resetError");
    cy.get(".swal2-confirm").click();
    cy.wait("@resetError");
    cy.get(".swal2-validation-message").should("be.visible").and("contain.text", "expired");
    expectActions();
    cy.get(".swal2-confirm").should("be.enabled");
    cy.get("#forgotNewPassword").should("have.value", "SyntheticPassword42!");
    cy.get(".swal2-cancel").scrollIntoView().should("be.visible");
    cy.get(".swal2-popup").screenshot("password-reset-mobile");
    cy.get(".swal2-cancel").click();
    cy.get(".swal2-popup").should("not.exist");
  });
});
