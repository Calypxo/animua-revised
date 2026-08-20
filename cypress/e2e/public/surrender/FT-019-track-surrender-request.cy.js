const {
  resetAndVerifyBaseline,
} = require("../../../support/integration");

describe("FT-019 — Track Surrender Request", () => {
  before(() => resetAndVerifyBaseline());

  it("shows the signed-in client's baseline surrender request and detail view", () => {
    const clientEmail = Cypress.env("FT_CLIENT_ACTIVE_EMAIL");
    cy.loginClient();
    cy.intercept("GET", "**/api/adoptions/my-applications").as("myAdoptions");
    cy.intercept("GET", "**/api/surrenders/my-requests").as("mySurrenders");

    cy.visitPublicPage("/pages/public/my-submissions.html");
    cy.wait("@myAdoptions", { timeout: 30000 });
    cy.wait("@mySurrenders", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      const requests = response?.body?.requests || [];
      expect(requests.some((item) => item.id === "FT_SURRENDER_PENDING")).to.equal(true);
      requests.forEach((item) => {
        const ownerEmail = item.owner?.email || item.ownerEmail || item.account?.email;
        expect(ownerEmail, `owner of ${item.id}`).to.equal(clientEmail);
      });
    });

    cy.findSubmissionDetailsButton("FT_SURRENDER_PENDING", "surrender")
      .should("be.visible")
      .as("pendingSurrenderButton")
      .parents(".submission-card")
      .should("contain.text", "FT Surrender Pet")
      .and("contain.text", "Received");
    cy.get("@pendingSurrenderButton").click();
    cy.get(".surrender-detail-modal").should("be.visible");
    cy.get(".surrender-detail-modal")
      .should("contain.text", "Request Details")
      .and("contain.text", "FT_SURRENDER_PENDING")
      .and("contain.text", "Received");
  });
});
