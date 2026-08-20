const {
  loginAndOpenContact,
  registerMutation,
  resetAndVerifyBaseline,
} = require("../../../support/batch10-functionality");

const REPLY = "FT-073 controlled management reply through the ANIMUA conversation.";

describe("FT-073 - Reply to Contact Inquiry", () => {
  before(() => resetAndVerifyBaseline());
  after(() => resetAndVerifyBaseline());

  it("sends one ordered reply with one notification and audit through the UI", () => {
    loginAndOpenContact();
    cy.intercept("POST", "**/api/public/contact/FT_CONTACT_NEW/reply").as("sendContactReply");
    cy.get("#messageSearch").type("FT New Inquiry");
    cy.get("#messageList .cm-message-item").should("have.length", 1).click();
    cy.get('#userMessageHistory [data-message-id="FT_CONTACT_NEW"]').click();
    cy.get("#replyMessage").type(REPLY);
    cy.get("#sendReplyBtn").click();
    cy.wait("@sendContactReply", { timeout: 30000 }).then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(request.body).to.deep.equal({ replyMessage: REPLY });
    });
    cy.get(".swal2-popup").should("be.visible");
    cy.get(".swal2-container", { timeout: 10000 }).should("not.exist");
    cy.wait("@contactListAdmin", { timeout: 30000 });
    cy.get("#userMessageHistory .cm-chat-message").then(($messages) => {
      const messageTexts = [...$messages].map((message) => message.textContent.trim());
      const exactReplies = messageTexts.filter((message) => message.includes(REPLY));
      expect(exactReplies).to.have.length(1);
      expect(messageTexts.findIndex((message) => message.includes(REPLY))).to.be.greaterThan(
        messageTexts.findIndex((message) => message.includes("Synthetic inquiry")),
      );
    });
    cy.then(() => registerMutation({ kind: "contactReply", primaryId: "FT_CONTACT_NEW" }))
      .then(({ registeredPaths }) => {
        expect(registeredPaths.filter((path) => path.startsWith("notifications/"))).to.have.length(1);
        expect(registeredPaths.filter((path) => path.startsWith("auditLogs/"))).to.have.length(1);
      });
    cy.sessionApiRequest({ path: "public/contact/messages" }).then((response) => {
      const contact = response.body?.messages?.find(({ id }) => id === "FT_CONTACT_NEW");
      expect(contact).to.include({ status: "Replied", replyMessage: REPLY });
      expect(contact.messages.map(({ message }) => message)).to.deep.equal(["Synthetic inquiry", REPLY]);
      expect(contact.messages.map(({ sender }) => sender)).to.deep.equal(["user", "admin"]);
    });
  });
});
