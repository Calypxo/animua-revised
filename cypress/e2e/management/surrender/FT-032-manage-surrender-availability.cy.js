describe("FT-032 — Manage Surrender Availability", () => {
  it("pauses the seeded public surrender availability through the management control", () => {
    cy.loginAdmin();
    cy.intercept("GET", "**/api/surrenders/availability").as("availability");
    cy.intercept("GET", "**/api/surrenders").as("surrenders");
    cy.intercept("PATCH", "**/api/surrenders/availability").as("updateAvailability");
    cy.visitManagementPage("/pages/surrenders.html");
    cy.wait("@availability", { timeout: 30000 })
      .its("response.body.availability.acceptingRequests")
      .should("eq", true);
    cy.wait("@surrenders", { timeout: 30000 });
    cy.get("#surrenderAvailabilityToggle")
      .should("be.checked")
      .and("be.enabled")
      .uncheck({ force: true });
    cy.wait("@updateAvailability", { timeout: 30000 }).then(({ request, response }) => {
      expect(request.body).to.deep.equal({ acceptingRequests: false });
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.availability?.acceptingRequests).to.equal(false);
    });
    cy.get("#surrenderAvailabilityToggle").should("not.be.checked");
    cy.get("#surrenderAvailabilityLabel").should("have.text", "Paused");
    cy.get("#surrenderAvailabilityDescription").should("contain.text", "public form is closed");
  });
});
