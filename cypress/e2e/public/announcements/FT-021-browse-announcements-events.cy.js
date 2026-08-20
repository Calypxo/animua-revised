describe("FT-021 — Browse Announcements and Events", () => {
  it("loads seeded public announcements and events and opens their real detail views", () => {
    cy.intercept("GET", "**/api/announcements/public").as("publicAnnouncements");
    cy.visitPublicPage("/pages/public/announcements.html");
    cy.wait("@publicAnnouncements", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      const announcement = (response?.body?.announcements || []).find(
        (item) => item.id === "FT_ANNOUNCEMENT_PUBLISHED",
      );
      expect(announcement).to.include({
        title: "FT Published Announcement",
        type: "News & Article",
        caption: "Synthetic public announcement",
      });
    });
    cy.get('[data-announcement-id="FT_ANNOUNCEMENT_PUBLISHED"]')
      .should("be.visible")
      .and("contain.text", "FT Published Announcement")
      .and("contain.text", "Synthetic public announcement")
      .find(".post-open-button")
      .click();
    cy.get(".announcement-detail")
      .should("be.visible")
      .and("contain.text", "FT Published Announcement")
      .and("contain.text", "Synthetic public announcement");

    cy.intercept("GET", "**/api/public/events").as("publicEvents");
    cy.visitPublicPage("/pages/public/home.html");
    cy.get('.home-highlight-story[data-highlight-key="events"]').click();
    cy.wait("@publicEvents", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      const event = (response?.body?.events || []).find((item) => item.id === "FT_EVENT_PUBLIC");
      expect(event).to.include({
        title: "FT Public Event",
        location: "FT Test Venue",
        description: "Synthetic event",
      });
    });
    cy.get("#storyModal")
      .should("not.have.class", "hidden")
      .and("contain.text", "FT Public Event")
      .and("contain.text", "FT Test Venue")
      .and("contain.text", "Synthetic event");
  });
});
