describe("FT-009 — Client Notification Inbox", () => {
  it("shows the seeded FT notifications and marks the unread item as read", () => {
    const email = Cypress.env("FT_CLIENT_NOTIFICATIONS_EMAIL");

    expect(email, "notification FT client email is configured")
      .to.be.a("string")
      .and.not.be.empty;

    cy.intercept("GET", "**/api/notifications").as("getNotifications");
    cy.intercept("PATCH", "**/api/notifications/read").as(
      "markNotificationsRead",
    );
    cy.loginClient({ email });

    cy.wait("@getNotifications", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.unreadCount).to.equal(1);

      const notifications = response?.body?.notifications || [];
      const unread = notifications.find(
        (item) => item.id === "FT_NOTIFICATION_UNREAD",
      );
      const read = notifications.find(
        (item) => item.id === "FT_NOTIFICATION_READ",
      );

      expect(unread).to.include({
        testId: "FT_NOTIFICATION_UNREAD",
        userEmail: email,
        title: "FT Unread Notification",
        message: "Synthetic unread notification",
        read: false,
      });
      expect(read).to.include({
        testId: "FT_NOTIFICATION_READ",
        userEmail: email,
        title: "FT Read Notification",
        message: "Synthetic read notification",
        read: true,
      });
    });

    cy.get("#notificationBtn").should(
      "have.attr",
      "aria-label",
      "Notifications, 1 unread",
    );
    cy.get("#notificationBtn").click();
    cy.wait("@getNotifications", { timeout: 30000 })
      .its("response.statusCode")
      .should("be.oneOf", [200, 304]);
    cy.get("#notificationPopup")
      .should("have.class", "show")
      .and("contain.text", "FT Unread Notification")
      .and("contain.text", "Synthetic unread notification")
      .and("contain.text", "FT Read Notification")
      .and("contain.text", "Synthetic read notification");
    cy.wait("@markNotificationsRead", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.updated).to.equal(1);
    });
    cy.get("#notificationPopup .notification-item.is-unread").should("not.exist");
    cy.get("#notificationBtn .notification-dot").should("have.attr", "hidden");

    cy.get("#notificationBtn").click();
    cy.get("#notificationBtn").click();
    cy.wait("@getNotifications", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.unreadCount).to.equal(0);
      expect(response?.body?.notifications.map((item) => item.id)).to.include.members([
        "FT_NOTIFICATION_UNREAD",
        "FT_NOTIFICATION_READ",
      ]);
    });
    cy.get("#notificationPopup")
      .should("have.class", "show")
      .and("contain.text", "All caught up")
      .and("contain.text", "FT Unread Notification")
      .and("contain.text", "FT Read Notification");
  });
});
