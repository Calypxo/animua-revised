const {
  loginAndOpenMutableAccount,
  registerFinalMutation,
  resetAndVerifyBaseline,
} = require("../../../support/final-batch-functionality");

describe("FT-082 - Change Management Password", () => {
  after(() => resetAndVerifyBaseline());

  it("changes and restores the dedicated mutable management password", () => {
    const originalPassword = Cypress.env("FT_MANAGEMENT_PASSWORD");
    const newPassword = Cypress.env("FT_MANAGEMENT_PROFILE_MUTABLE_NEW_PASSWORD");
    expect(originalPassword, "baseline management password").to.be.a("string").and.not.be.empty;
    expect(newPassword, "mutable replacement management password").to.be.a("string").and.not.be.empty;
    expect(newPassword).not.to.equal(originalPassword);

    const changeThroughUi = (currentPassword, replacementPassword, phase) => {
      let startedAt;
      cy.intercept("PATCH", "**/api/auth/account/password").as(`changePassword${phase}`);
      cy.then(() => {
        startedAt = Date.now();
      });
      cy.get("#securitySettings").scrollIntoView().should("be.visible");
      cy.fillSensitiveInput("#currentPassword", currentPassword);
      cy.fillSensitiveInput("#newPassword", replacementPassword);
      cy.fillSensitiveInput("#confirmPassword", replacementPassword);
      cy.get("#changePasswordButton").click();
      cy.get(".swal2-confirm").should("contain.text", "Change password").click();
      cy.wait(`@changePassword${phase}`, { timeout: 30000 }).then(({ response }) => {
        expect(response?.statusCode).to.equal(200);
        expect(response?.body?.message).to.equal("Password changed successfully.");
      });
      cy.then(() => registerFinalMutation({
        kind: "managementPassword",
        primaryId: "FT_MANAGEMENT_PROFILE_MUTABLE",
        phase,
        startedAt,
      }));
      cy.get(".swal2-confirm").should("be.visible").click();
      cy.location("pathname", { timeout: 30000 }).should("eq", "/pages/admin-login.html");
    };

    loginAndOpenMutableAccount(originalPassword);
    changeThroughUi(originalPassword, newPassword, "changed");
    loginAndOpenMutableAccount(newPassword);
    changeThroughUi(newPassword, originalPassword, "restored");
    cy.loginManagement("Staff", {
      email: Cypress.env("FT_MANAGEMENT_PROFILE_MUTABLE_EMAIL"),
      password: originalPassword,
    });
    cy.location("pathname").should("eq", "/pages/dashboard.html");
  });
});
