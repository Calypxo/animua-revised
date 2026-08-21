const {
  loginAndOpenAnnouncements,
  resetAndVerifyBaseline,
} = require("../../../support/batch10-functionality");

describe("FT-068 - Browse Managed Announcements", () => {
  after(() => resetAndVerifyBaseline());

  it("browses, filters, and opens the controlled managed announcements", () => {
    loginAndOpenAnnouncements("Staff");
    cy.get('[data-announcement-id="FT_ANNOUNCEMENT_PUBLISHED"]')
      .should("contain.text", "FT Published Announcement")
      .and("contain.text", "Synthetic public announcement")
      .and("contain.text", "Published")
      .and("contain.text", "News & Article")
      .and("contain.text", "Visible on the public community page");
    cy.get('[data-announcement-id="FT_ANNOUNCEMENT_DRAFT"]')
      .should("contain.text", "FT Draft Announcement")
      .and("contain.text", "Synthetic private draft")
      .and("contain.text", "Draft")
      .and("contain.text", "Upcoming Events")
      .and("contain.text", "Internal post");

    cy.get("#searchAnnouncement").type("FT Published Announcement");
    cy.get("#announcementFeed .post-card").should("have.length", 1);
    cy.get('[data-announcement-id="FT_ANNOUNCEMENT_PUBLISHED"] [data-edit-id]').click();
    cy.get("#announcementModalBackdrop").should("have.class", "open");
    cy.get("#announcementModalTitle").should("have.text", "Edit Community Post");
    cy.get("#fTitle").should("have.value", "FT Published Announcement");
    cy.get("#fCaption").should("have.value", "Synthetic public announcement");
    cy.get("#fStatus").should("have.value", "Published");
    cy.get("#fVisibleToPublic").should("have.value", "true");
    cy.get("#announcementCancelBtn").click();

    cy.get("#searchAnnouncement").clear();
    cy.get("#filterStatus").select("Draft");
    cy.get("#announcementFeed .post-card").should("have.length", 1)
      .and("have.attr", "data-announcement-id", "FT_ANNOUNCEMENT_DRAFT");
  });
});
