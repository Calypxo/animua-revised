const {
  resetAndVerifyBaseline,
} = require("../../../support/integration");

describe("FT-015 — Track Adoption Application", () => {
  before(() => resetAndVerifyBaseline());

  it("shows the signed-in client's baseline adoption and its tracking details", () => {
    const clientEmail = Cypress.env("FT_CLIENT_ACTIVE_EMAIL");
    cy.loginClient();
    cy.intercept("GET", "**/api/adoptions/my-applications").as("myAdoptions");
    cy.intercept("GET", "**/api/surrenders/my-requests").as("mySurrenders");

    cy.visitPublicPage("/pages/public/my-submissions.html");
    cy.wait("@myAdoptions", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      const adoptions = response?.body?.adoptions || [];
      expect(adoptions.some((item) => item.id === "FT_ADOPTION_PENDING")).to.equal(true);
      adoptions.forEach((item) => {
        const ownerEmail = item.applicant?.email || item.account?.email;
        expect(ownerEmail, `owner of ${item.id}`).to.equal(clientEmail);
      });
    });
    cy.wait("@mySurrenders", { timeout: 30000 });

    cy.findSubmissionDetailsButton("FT_ADOPTION_PENDING", "adoption")
      .should("be.visible")
      .as("pendingAdoptionButton")
      .parents(".submission-card")
      .should("contain.text", "FT_ANIMAL_READY_DOG")
      .and("contain.text", "Under Review");
    cy.get("@pendingAdoptionButton").click();
    cy.get(".application-detail-modal").should("be.visible");
    cy.get(".application-detail-modal")
      .should("contain.text", "Application Details")
      .and("contain.text", "FT-APP-001")
      .and("contain.text", "Under Review");
  });
});
