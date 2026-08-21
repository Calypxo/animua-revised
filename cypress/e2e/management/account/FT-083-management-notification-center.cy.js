const {
  loginMutableManagement,
  registerFinalMutation,
  resetAndVerifyBaseline,
} = require("../../../support/final-batch-functionality");

describe("FT-083 - Management Notification Center", () => {
  after(() => resetAndVerifyBaseline());

  it("shows, opens, and marks one controlled management notification as read", () => {
    const relatedId = "FT_CONTACT_REPLIED";
    let notificationId;
    cy.task("createFtManagementNotificationFixture", null, { timeout: 120000 }).then((result) => {
      notificationId = result.notificationId;
      expect(result.relatedId).to.equal(relatedId);
      expect(notificationId).to.match(/^[A-Za-z0-9]{20}$/);
      expect(result.registeredPaths).to.deep.equal([`notifications/${notificationId}`]);
    });

    cy.intercept("GET", "**/api/notifications").as("managementNotifications");
    loginMutableManagement();
    cy.wait("@managementNotifications", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      const item = (response?.body?.notifications || []).find((notification) =>
        notification.id === notificationId &&
        notification.referenceId === relatedId &&
        notification.userEmail === Cypress.env("FT_MANAGEMENT_PROFILE_MUTABLE_EMAIL"));
      expect(item, "controlled mutable-management notification").to.exist;
      expect(item.read).to.equal(false);
      expect(item.type).to.equal("contact_message_created");
      expect(item.metadata).to.deep.include({
        resourceType: "contact_message",
        relatedResourceId: relatedId,
      });
    });
    cy.get(".notif-btn").should("have.class", "has-attention").click();
    cy.wait("@managementNotifications", { timeout: 30000 })
      .its("response.statusCode").should("be.oneOf", [200, 304]);
    cy.then(() => {
      cy.get(`#managementAttentionCenter [data-notification-id="${notificationId}"]`)
        .should("be.visible")
        .and("contain.text", "New contact inquiry received")
        .and("contain.text", "FT Client Active");
      cy.intercept("PATCH", `**/api/notifications/${notificationId}/read`).as("markManagementRead");
      cy.intercept("GET", "**/api/public/contact/messages").as("relatedConversations");
      cy.get(`#managementAttentionCenter [data-notification-id="${notificationId}"]`).click();
      cy.wait("@markManagementRead", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
      registerFinalMutation({
        kind: "managementNotificationRead",
        primaryId: notificationId,
        referenceId: relatedId,
      });
    });
    cy.wait("@relatedConversations", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
    cy.location("pathname").should("eq", "/pages/contactMessages.html");
    cy.location("search").should("contain", `id=${relatedId}`);
    cy.get("#messageDetail").should("not.have.class", "hidden");
    cy.get("#detailUserName").should("have.text", "FT Client Active");
    cy.get(`#userMessageHistory [data-message-id="${relatedId}"]`)
      .should("have.length", 1)
      .and("contain.text", "FT Replied Inquiry");
    cy.get("#userMessageHistory").should("contain.text", "Synthetic inquiry")
      .and("contain.text", "Synthetic reply");
  });
});
