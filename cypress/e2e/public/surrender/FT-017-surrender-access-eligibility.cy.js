describe("FT-017 — Surrender Access and Eligibility", () => {
  it("enforces authenticated access, active availability, Angeles City eligibility, and agreement before submission", () => {
    let submissionAttempted = false;
    cy.loginClient();
    cy.intercept("GET", "**/api/surrenders/availability").as("surrenderAvailability");
    cy.intercept("POST", "**/api/surrenders", () => {
      submissionAttempted = true;
    }).as("unexpectedSurrenderSubmission");

    cy.visitPublicPage("/pages/public/surrender.html");
    cy.wait("@surrenderAvailability", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.availability?.acceptingRequests).to.equal(true);
    });

    cy.get("#accountIdentityCard")
      .should("not.have.class", "is-signed-out")
      .and("contain.text", Cypress.env("FT_CLIENT_ACTIVE_EMAIL"));
    cy.get(".surrender-workspace").scrollIntoView().should("have.class", "show");
    cy.get("#surrenderAvailabilityPanel").should("not.be.visible");
    cy.get("#surrenderForm").should("be.visible");
    cy.get("#ownerCity").should("have.value", "Angeles City").and("have.attr", "readonly");
    cy.get("#ownerBarangay option").then(($options) => {
      const values = [...$options].map((option) => option.value).filter(Boolean);
      expect(values).to.include("Pampang");
      expect(values).not.to.include("Mabalacat City");
    });
    cy.get("#barangayHelp").should("contain.text", "Only supported Angeles City barangays");

    cy.fillValidSurrenderForm({
      petName: "FT-017 Eligibility Animal",
      reason: "FT-017 verifies the implemented eligibility and required agreement state.",
      agree: false,
    });
    cy.get("#agreeAllTerms").should("not.be.checked").and("have.attr", "required");
    cy.get("#submitSurrenderBtn").click();
    cy.get("#agreementError")
      .should("contain.text", "Confirm that you have read and agree to the surrender terms");
    cy.get("#surrenderSuccessPanel").should("have.class", "hidden");
    cy.then(() => expect(submissionAttempted).to.equal(false));
  });
});
