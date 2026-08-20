describe("FT-022 — Submit Contact Inquiry", () => {
  it("submits one deterministic Contact Us inquiry and shows the backend-confirmed conversation", () => {
    let contactId;
    cy.loginClient();
    cy.intercept("POST", "**/api/public/contact").as("submitContactInquiry");
    cy.visitPublicPage("/pages/public/contact.html");

    cy.get('#contactForm input[name="fullName"]')
      .should("have.attr", "readonly");
    cy.get('#contactForm input[name="fullName"]')
      .should("have.value", "Client Active");
    cy.get('#contactForm input[name="email"]')
      .should("have.attr", "readonly");
    cy.get('#contactForm input[name="email"]')
      .should("have.value", Cypress.env("FT_CLIENT_ACTIVE_EMAIL"));
    cy.get('#contactForm input[name="subject"]').type("FT-022 Deterministic Contact Inquiry");
    cy.get('#contactForm textarea[name="message"]').type(
      "FT-022 deterministic contact inquiry submitted through the real public form.",
    );
    cy.get("#contactSubmit").click();

    cy.wait("@submitContactInquiry", { timeout: 30000 }).then(({ request, response }) => {
      expect(request.headers.authorization).to.match(/^Bearer\s+\S+/);
      expect(request.body).not.to.have.property("website");
      expect(response?.statusCode).to.equal(201);
      expect(response?.headers).to.have.property("ratelimit-remaining");
      expect(response?.body?.message).to.equal("Your message has been received by the ANIMUA team.");
      contactId = response?.body?.id;
      expect(contactId).to.match(/^[A-Za-z0-9]{20}$/);
      cy.task("registerFtGeneratedRecords", {
        kind: "contactInquiry",
        primaryId: contactId,
      }).then(({ registeredPaths }) => {
        expect(registeredPaths).to.include(`contactMessages/${contactId}`);
      });
    });

    cy.get("#contactStatus")
      .should("have.attr", "data-type", "success")
      .and("contain.text", "Your message has been received by the ANIMUA team.");
    cy.get(".swal2-popup")
      .should("be.visible")
      .and("contain.text", "Message Sent")
      .and("contain.text", "Staff replies will appear in Messages");
    cy.get(".swal2-confirm").click();
    cy.then(() => {
      cy.get(`.contact-reply-item[data-contact-id="${contactId}"]`, { timeout: 30000 })
        .should("be.visible")
        .and("contain.text", "FT-022 Deterministic Contact Inquiry")
        .and("contain.text", "Under Review");
    });
  });
});
