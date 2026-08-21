describe("FT-005 — Client Profile Management", () => {
  it("loads the dedicated mutable client profile and persists an allowed profile edit", () => {
    const email = Cypress.env("FT_CLIENT_PROFILE_MUTABLE_EMAIL");
    const updatedPhone = "09175550005";

    expect(email, "mutable FT client email is configured")
      .to.be.a("string")
      .and.not.be.empty;

    cy.loginClient({ email });
    cy.intercept("GET", "**/api/auth/account").as("currentAccount");
    cy.intercept("PATCH", "**/api/auth/account/profile").as("updateProfile");

    cy.get("#userMenuBtn").click();
    cy.get("#viewProfileBtn").click();
    cy.wait("@currentAccount", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.account?.email).to.equal(email);
    });

    cy.get("#profileModal").should("not.have.class", "hidden");
    cy.get("#profileFullName")
      .should("have.value", "Client Profile Mutable")
      .and("have.attr", "readonly");
    cy.get("#profileEmail")
      .should("have.value", email)
      .and("have.attr", "readonly");
    cy.get("#profilePhone").should("have.value", "09170000000");

    cy.get("#profileEditBtn").click();
    cy.get("#profilePhone").should("not.have.attr", "readonly");
    cy.get("#profilePhone").clear().type(updatedPhone);
    cy.get("#profileFullName").should("have.attr", "readonly");
    cy.get("#profileEmail").should("have.attr", "readonly");
    cy.get("#profileSaveBtn").should("be.enabled").click();

    cy.wait("@updateProfile", { timeout: 30000 }).then(({ request, response }) => {
      expect(request.body.phone).to.equal(updatedPhone);
      expect(request.body.fullName).to.equal("Client Profile Mutable");
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.account?.email).to.equal(email);
      expect(response?.body?.account?.phone).to.equal(updatedPhone);
    });
    cy.get("#profileStatusMessage")
      .should("have.text", "Changes saved successfully.")
      .and("have.class", "is-success");

    cy.get("#profileModal .profile-modal-close").click();
    cy.get("#userMenuBtn").click();
    cy.get("#viewProfileBtn").click();
    cy.wait("@currentAccount", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.account?.email).to.equal(email);
      expect(response?.body?.account?.phone).to.equal(updatedPhone);
    });
    cy.get("#profilePhone").should("have.value", updatedPhone);
  });
});
