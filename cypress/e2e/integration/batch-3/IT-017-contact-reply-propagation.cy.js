const {
  apiRequest,
  getAuditLogs,
  registerMutation,
  useIntegrationBaseline,
} = require("../../../support/integration");

const CONTACT_ID = "FT_CONTACT_NEW";
const REPLY = "IT-017 deterministic staff reply through the ANIMUA conversation.";

function findContact(response) {
  return (response.body?.messages || []).find(({ id }) => id === CONTACT_ID);
}

describe("IT-017 — Contact Reply Propagation", () => {
  const context = useIntegrationBaseline({
    roles: ["Admin", "Public"],
    verifyRestored({ tokens }) {
      return apiRequest({ path: "public/contact/messages", token: tokens.Admin })
        .then((response) => {
          const contact = findContact(response);
          expect(contact).to.include({ id: CONTACT_ID, status: "New", replyMessage: "" });
          expect(contact.messages.map(({ message }) => message)).to.deep.equal([
            "Synthetic inquiry",
          ]);
        });
    },
  });

  it("stores one ordered staff reply and creates one correctly referenced client notification and audit", () => {
    let replyResponse;
    let managementContact;
    let clientContact;
    let notifications;
    let audits;

    apiRequest({ path: "public/contact/messages", token: context.tokens.Admin })
      .then((response) => {
        const starting = findContact(response);
        expect(starting).to.include({ status: "New", replyMessage: "" });
        expect(starting.messages).to.have.length(1);
      });

    apiRequest({
      method: "POST",
      path: `public/contact/${CONTACT_ID}/reply`,
      token: context.tokens.Admin,
      body: { replyMessage: REPLY },
    }).then((response) => {
      replyResponse = response;
      if (response.status === 200) {
        return registerMutation({ kind: "contactReply", primaryId: CONTACT_ID });
      }
      return undefined;
    });

    apiRequest({ path: "public/contact/messages", token: context.tokens.Admin })
      .then((response) => { managementContact = findContact(response); });
    apiRequest({ path: "public/contact/my-messages", token: context.tokens.Public })
      .then((response) => { clientContact = findContact(response); });
    apiRequest({ path: "notifications", token: context.tokens.Public }).then((response) => {
      notifications = (response.body?.notifications || []).filter(
        ({ referenceId, type }) => referenceId === CONTACT_ID && type === "contact_reply",
      );
    });
    getAuditLogs(context.tokens.Admin).then((logs) => {
      audits = logs.filter(
        (log) => log.rawAction === "contact.replied" && log.record === CONTACT_ID,
      );
    });

    cy.then(() => {
      expect(replyResponse?.status).to.equal(200);
      expect(replyResponse?.body).to.include({
        message: "Reply saved to the user's ANIMUA account.",
        deliveryChannel: "in-app",
      });
      expect(managementContact).to.include({
        id: CONTACT_ID,
        status: "Replied",
        replyMessage: REPLY,
        repliedBy: context.emails.Admin,
      });
      expect(managementContact.messages.map(({ message }) => message)).to.deep.equal([
        "Synthetic inquiry",
        REPLY,
      ]);
      expect(managementContact.messages.map(({ sender }) => sender)).to.deep.equal([
        "user",
        "admin",
      ]);
      expect(clientContact.messages.map(({ message }) => message)).to.deep.equal([
        "Synthetic inquiry",
        REPLY,
      ]);
      expect(clientContact.status).to.equal("Replied");
      expect(notifications).to.have.length(1);
      expect(notifications[0]).to.deep.include({
        category: "contact",
        type: "contact_reply",
        referenceId: CONTACT_ID,
      });
      expect(audits).to.have.length(1);
      expect(audits[0]).to.include({
        module: "Contact Messages",
        status: "Success",
        record: CONTACT_ID,
      });
      expect(audits[0].after).to.deep.include({ replyMessage: REPLY });
    });
  });
});
