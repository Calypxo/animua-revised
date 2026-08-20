describe("FT-008 — Client Notification Preferences", () => {
  it("persists notification category choices for the dedicated FT client", () => {
    const email = Cypress.env("FT_CLIENT_NOTIFICATIONS_EMAIL");
    const expectedSettings = {
      applicationUpdates: false,
      surrenderRequestUpdates: true,
      announcementsEvents: false,
    };

    expect(email, "notification FT client email is configured")
      .to.be.a("string")
      .and.not.be.empty;

    cy.loginClient({ email });
    cy.intercept("GET", "**/api/auth/account").as("currentAccount");
    cy.intercept("PATCH", "**/api/auth/account/profile").as(
      "saveNotificationPreferences",
    );

    cy.get("#userMenuBtn").click();
    cy.get("#viewProfileBtn").click();
    cy.wait("@currentAccount", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.account?.email).to.equal(email);
    });
    cy.get("#profileNotificationsBtn").click();

    cy.get(".notification-settings-popup").should("be.visible");
    cy.get('[data-notification-setting="applicationUpdates"]')
      .should("be.checked")
      .uncheck({ force: true });
    cy.get('[data-notification-setting="surrenderRequestUpdates"]')
      .should("be.checked")
      .check({ force: true });
    cy.get('[data-notification-setting="announcementsEvents"]')
      .should("be.checked")
      .uncheck({ force: true });
    cy.get('[data-notification-setting="applicationUpdates"]')
      .closest(".notification-settings-switch")
      .find("em")
      .should("have.text", "OFF");
    cy.get('[data-notification-setting="surrenderRequestUpdates"]')
      .closest(".notification-settings-switch")
      .find("em")
      .should("have.text", "ON");
    cy.get('[data-notification-setting="announcementsEvents"]')
      .closest(".notification-settings-switch")
      .find("em")
      .should("have.text", "OFF");

    cy.get(".notification-settings-confirm").click();
    cy.wait("@saveNotificationPreferences", { timeout: 30000 }).then(
      ({ request, response }) => {
        expect(request.body.notificationSettings).to.deep.equal(expectedSettings);
        expect(request.body.notificationPreference).to.equal(
          "1 notification category enabled",
        );
        expect(response?.statusCode).to.equal(200);
        expect(response?.body?.account?.email).to.equal(email);
        expect(response?.body?.account?.notificationSettings).to.deep.equal(
          expectedSettings,
        );
      },
    );
    cy.get(".notification-settings-status")
      .should("have.text", "Notification settings saved.")
      .and("have.class", "is-success");

    cy.get(".notification-settings-popup .swal2-close").click();
    cy.get("#userMenuBtn").click();
    cy.get("#viewProfileBtn").click();
    cy.wait("@currentAccount", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.account?.email).to.equal(email);
      expect(response?.body?.account?.notificationSettings).to.deep.equal(
        expectedSettings,
      );
    });
    cy.get("#profileNotificationSummary").should(
      "have.text",
      "1 notification category enabled",
    );
  });
});
