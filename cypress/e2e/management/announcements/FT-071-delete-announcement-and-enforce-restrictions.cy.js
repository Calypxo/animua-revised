const {
  apiRequest,
  currentToken,
  loginAndOpenAnnouncements,
  registerMutation,
  resetAndVerifyBaseline,
} = require("../../../support/batch10-functionality");

const TITLE = "FT-071 Deletable Announcement";
const CAPTION = "FT-071 controlled announcement created for deletion.";

describe("FT-071 - Delete Announcement and Enforce Restrictions", () => {
  after(() => resetAndVerifyBaseline());

  it("rejects Staff deletion and lets Admin delete one tracked public announcement", () => {
    let announcementId = "";
    loginAndOpenAnnouncements();
    cy.intercept("POST", "**/api/announcements").as("createDeletableAnnouncement");
    cy.get("#btnNewAnnouncement").click();
    cy.get("#fTitle").type(TITLE);
    cy.get("#fCaption").type(CAPTION);
    cy.get("#fType").select("News & Article");
    cy.get("#fStatus").select("Published");
    cy.get("#fVisibleToPublic").select("true");
    cy.get('button[form="announcementForm"]').click();
    cy.wait("@createDeletableAnnouncement", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(201);
      announcementId = response.body?.announcementId;
      expect(announcementId).to.match(/^[A-Za-z0-9]{20}$/);
      return registerMutation({ kind: "announcementDelete", primaryId: announcementId, phase: "created" });
    });
    cy.wait("@announcementListAdmin", { timeout: 30000 });
    cy.request({ url: `${Cypress.env("apiBaseUrl")}/announcements/public`, failOnStatusCode: false })
      .then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body.announcements.some(({ id }) => id === announcementId)).to.equal(true);
      });

    loginAndOpenAnnouncements("Staff");
    cy.get("#searchAnnouncement").type(TITLE);
    cy.get("#announcementFeed .post-card").should("have.length", 1);
    cy.get("#announcementFeed [data-delete-id]").should("not.exist");
    currentToken().then((token) => apiRequest({
      method: "DELETE",
      path: `announcements/${announcementId}`,
      token,
    })).then((response) => {
      expect(response.status).to.equal(403);
      expect(response.body?.message).to.equal("Access denied. Required role: Admin.");
    });
    currentToken().then((token) => apiRequest({ path: "announcements", token })).then((response) => {
      expect(response.body?.announcements?.some(({ id }) => id === announcementId)).to.equal(true);
    });

    loginAndOpenAnnouncements("Admin");
    cy.intercept("DELETE", "**/api/announcements/*").as("deleteAnnouncement");
    cy.get("#searchAnnouncement").type(TITLE);
    cy.get("#announcementFeed [data-delete-id]").click();
    cy.get(".swal2-confirm").should("be.visible").click();
    cy.wait("@deleteAnnouncement", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
    cy.wait("@announcementListAdmin", { timeout: 30000 });
    cy.get("#announcementFeed").should("contain.text", "No announcements found");
    cy.request({ url: `${Cypress.env("apiBaseUrl")}/announcements/public`, failOnStatusCode: false })
      .then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body.announcements.some(({ id }) => id === announcementId)).to.equal(false);
      });
    cy.then(() => registerMutation({ kind: "announcementDelete", primaryId: announcementId, phase: "deleted" }))
      .then(({ registeredPaths }) => {
        expect(registeredPaths).to.include(`announcements/${announcementId}`);
        expect(registeredPaths.filter((path) => path.startsWith("auditLogs/"))).to.have.length(3);
      });
  });
});
