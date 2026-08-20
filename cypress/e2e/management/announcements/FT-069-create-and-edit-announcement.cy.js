const {
  apiRequest,
  currentToken,
  loginAndOpenAnnouncements,
  registerMutation,
  resetAndVerifyBaseline,
} = require("../../../support/batch10-functionality");

const TITLE = "FT-069 Controlled Announcement";
const CREATED = "FT-069 controlled announcement created through the management UI.";
const EDITED = "FT-069 controlled announcement edited through the management UI.";

describe("FT-069 - Create and Edit Announcement", () => {
  after(() => resetAndVerifyBaseline());

  it("creates and edits one ownership-tracked announcement through the UI", () => {
    let announcementId = "";
    loginAndOpenAnnouncements();
    cy.intercept("POST", "**/api/announcements").as("createAnnouncement");
    cy.intercept("PUT", "**/api/announcements/*").as("updateAnnouncement");
    cy.get("#btnNewAnnouncement").click();
    cy.get("#fTitle").type(TITLE);
    cy.get("#fCaption").type(CREATED);
    cy.get("#fType").select("News & Article");
    cy.get("#fStatus").select("Draft");
    cy.get("#fVisibleToPublic").select("false");
    cy.get('#announcementForm button[type="submit"], button[form="announcementForm"]').last().click();
    cy.wait("@createAnnouncement", { timeout: 30000 }).then(({ request, response }) => {
      expect(response?.statusCode).to.equal(201);
      expect(request.body).to.include({ title: TITLE, caption: CREATED, status: "Draft", visibleToPublic: false });
      announcementId = response.body?.announcementId;
      expect(announcementId).to.match(/^[A-Za-z0-9]{20}$/);
      return registerMutation({ kind: "announcementCreateEdit", primaryId: announcementId, phase: "created" });
    }).then(({ registeredPaths }) => {
      expect(registeredPaths).to.include(`announcements/${announcementId}`);
    });
    cy.wait("@announcementListAdmin", { timeout: 30000 });
    cy.get("#searchAnnouncement").clear().type(TITLE);
    cy.get("#announcementFeed .post-card").should("have.length", 1).and("contain.text", CREATED);
    cy.get("#announcementFeed [data-edit-id]").click();
    cy.get("#fCaption").clear().type(EDITED);
    cy.get('button[form="announcementForm"]').click();
    cy.wait("@updateAnnouncement", { timeout: 30000 }).then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(request.body).to.include({ title: TITLE, caption: EDITED, status: "Draft", visibleToPublic: false });
    });
    cy.wait("@announcementListAdmin", { timeout: 30000 });
    cy.reload();
    cy.wait("@announcementListAdmin", { timeout: 30000 });
    cy.get("#searchAnnouncement").type(TITLE);
    cy.get("#announcementFeed .post-card").should("have.length", 1).and("contain.text", EDITED);
    cy.then(() => registerMutation({ kind: "announcementCreateEdit", primaryId: announcementId, phase: "edited" }))
      .then(({ registeredPaths }) => {
        expect(registeredPaths).to.include(`announcements/${announcementId}`);
        expect(registeredPaths.filter((path) => path.startsWith("auditLogs/"))).to.have.length(2);
      });
    currentToken().then((token) => apiRequest({ path: "announcements", token })).then((response) => {
      const saved = response.body?.announcements?.find(({ id }) => id === announcementId);
      expect(saved).to.include({ title: TITLE, caption: EDITED, status: "Draft", visibleToPublic: false });
    });
  });
});
