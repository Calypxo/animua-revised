describe("FT-023 — Manage Client Contact Conversation", () => {
  it("opens the seeded conversation, shows its history, and sends a real client follow-up", () => {
    const followUp = "FT-023 deterministic client follow-up.";
    cy.loginClient();
    cy.intercept("GET", "**/api/public/contact/my-messages").as("myContactMessages");
    cy.intercept(
      "POST",
      "**/api/public/contact/FT_CONTACT_REPLIED/follow-up",
    ).as("sendContactFollowUp");
    cy.visitPublicPage("/pages/public/contact.html");

    cy.wait("@myContactMessages", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      const conversation = (response?.body?.messages || []).find(
        (item) => item.id === "FT_CONTACT_REPLIED",
      );
      expect(conversation).to.exist;
      expect(conversation.status).to.equal("Replied");
      expect(conversation.messages.map((message) => message.message)).to.deep.equal([
        "Synthetic inquiry",
        "Synthetic reply",
      ]);
    });
    cy.get("#contactContentGrid").scrollIntoView().should("have.class", "show");
    cy.get('.contact-reply-item[data-contact-id="FT_CONTACT_REPLIED"]')
      .should("be.visible")
      .and("contain.text", "FT Replied Inquiry")
      .and("contain.text", "Replied")
      .click();
    cy.get('.contact-thread-view[data-active-contact-id="FT_CONTACT_REPLIED"]')
      .should("be.visible")
      .and("contain.text", "Synthetic inquiry")
      .and("contain.text", "Synthetic reply");
    cy.get('[data-contact-reply-form] textarea[name="message"]').type(followUp);
    cy.get(".contact-thread-send").click();

    cy.wait("@sendContactFollowUp", { timeout: 30000 }).then(({ request, response }) => {
      expect(request.headers).not.to.have.property("authorization");
      expect(request.headers.origin).to.equal(Cypress.env("publicBaseUrl"));
      expect(request.body).to.deep.equal({ message: followUp });
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.message).to.equal("Your reply has been added to the conversation.");
      cy.task("registerFtGeneratedRecords", { kind: "contactFollowUp" })
        .its("registeredPaths")
        .should("not.be.empty");
    });
    cy.get('.contact-thread-view[data-active-contact-id="FT_CONTACT_REPLIED"]', { timeout: 30000 })
      .should("contain.text", "Synthetic inquiry")
      .and("contain.text", "Synthetic reply")
      .and("contain.text", followUp)
      .and("contain.text", "Under Review");
  });
});
