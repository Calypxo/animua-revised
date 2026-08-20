const {
  loginAndOpenMutableAccount,
  registerFinalMutation,
  resetAndVerifyBaseline,
} = require("../../../support/final-batch-functionality");

describe("FT-081 - Manage Management Profile", () => {
  after(() => resetAndVerifyBaseline());

  it("persists and restores an allowed display-name change", () => {
    const originalName = "Management Profile Mutable";
    const updatedName = "FT Management Profile Updated";
    cy.intercept("PATCH", "**/api/auth/account/profile").as("saveProfile");
    loginAndOpenMutableAccount();
    cy.get("#displayNameInput").should("have.value", originalName);
    cy.get("#emailInput").should("have.attr", "readonly");
    cy.get("#emailInput").should("have.value", Cypress.env("FT_MANAGEMENT_PROFILE_MUTABLE_EMAIL"));
    cy.get("#roleInput").should("have.attr", "readonly");
    cy.get("#roleInput").should("have.value", "Staff");
    cy.get("#displayNameInput").clear().type(updatedName);
    cy.get("#saveProfileButton").click();
    cy.wait("@saveProfile", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.fullName).to.equal(updatedName);
    });
    registerFinalMutation({
      kind: "managementProfile",
      primaryId: "FT_MANAGEMENT_PROFILE_MUTABLE",
      phase: "updated",
    });
    cy.reload();
    cy.wait("@managementAccount", { timeout: 30000 });
    cy.get("#displayNameInput").should("have.value", updatedName);
    cy.sessionApiRequest({ path: "auth/account" })
      .its("body.account.fullName").should("eq", updatedName);
    cy.get("#displayNameInput").clear().type(originalName);
    cy.get("#saveProfileButton").click();
    cy.wait("@saveProfile", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
    registerFinalMutation({
      kind: "managementProfile",
      primaryId: "FT_MANAGEMENT_PROFILE_MUTABLE",
      phase: "restored",
    });
    cy.reload();
    cy.wait("@managementAccount", { timeout: 30000 });
    cy.get("#displayNameInput").should("have.value", originalName);
  });
});
