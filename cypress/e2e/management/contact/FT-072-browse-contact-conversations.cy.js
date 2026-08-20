const {
  loginAndOpenContact,
  resetAndVerifyBaseline,
} = require("../../../support/batch10-functionality");

describe("FT-072 - Browse Contact Conversations", () => {
  after(() => resetAndVerifyBaseline());

  it("searches, filters, and opens the controlled contact conversation history", () => {
    loginAndOpenContact("Staff");
    cy.get("#messageList").should("contain.text", "FT Client Active")
      .and("contain.text", Cypress.env("FT_CLIENT_ACTIVE_EMAIL"));
    cy.get("#messageSearch").type("FT New Inquiry");
    cy.get("#messageList .cm-message-item").should("have.length", 1).click();
    cy.get("#messageDetail").should("not.have.class", "hidden");
    cy.get("#detailUserName").should("have.text", "FT Client Active");
    cy.get('#userMessageHistory [data-message-id="FT_CONTACT_NEW"]')
      .should("contain.text", "FT New Inquiry")
      .and("contain.text", "Synthetic inquiry")
      .and("contain.text", "Needs reply");
    cy.get('#userMessageHistory [data-message-id="FT_CONTACT_REPLIED"]')
      .should("contain.text", "FT Replied Inquiry")
      .and("contain.text", "Replied");
    cy.get("#userMessageHistory").should("contain.text", "Synthetic reply");

    cy.get("#clearMessageFilters").click();
    cy.get('.ap-tab[data-status="Replied"]').click();
    cy.get("#messageList .cm-message-item").should("have.length", 1).click();
    cy.get('#userMessageHistory [data-message-id="FT_CONTACT_REPLIED"]')
      .should("have.length", 1)
      .filter(":visible")
      .should("have.length", 1)
      .click();
    cy.get("#replyContext").should("contain.text", "FT Replied Inquiry");
    cy.get("#userMessageHistory .cm-chat-row").then(($rows) => {
      const messages = [...$rows].map((row) => row.textContent);
      expect(messages.some((text) => text.includes("Synthetic inquiry"))).to.equal(true);
      expect(messages.some((text) => text.includes("Synthetic reply"))).to.equal(true);
    });
  });
});
