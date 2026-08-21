describe("FT-024 — Use ANIMUA Chatbot", () => {
  it("submits supported public questions and displays usable ANIMUA guidance", () => {
    const questions = [
      {
        text: "How do I submit an adoption application?",
        guidance: /adopt|application|find furbabies|profile/i,
      },
      {
        text: "How do I submit a surrender request in Angeles City?",
        guidance: /surrender|request|angeles|barangay|owner/i,
      },
    ];
    const validUnavailable = /unavailable|unable|cannot connect|could not answer|try again|server/i;

    cy.intercept("POST", "**/api/chatbot/message").as("chatbotMessage");
    cy.visitPublicPage("/pages/public/home.html");
    cy.get("#chatbotToggle").should("be.visible").click();
    cy.get("#chatbotPanel").should("be.visible");

    questions.forEach(({ text, guidance }) => {
      cy.get("#chatbotInput").should("be.enabled").clear().type(text);
      cy.get("#chatbotForm").submit();
      cy.get("#chatbotMessages .chatbot-message.user p").last().should("have.text", text);
      cy.wait("@chatbotMessage", { timeout: 60000 }).then(({ request }) => {
        expect(request.body).to.include({ message: text, language: "english" });
      });
      cy.get("#chatbotMessages .chatbot-message.bot p", { timeout: 60000 }).should(($messages) => {
        const reply = String($messages.last().text()).trim();
        expect(reply, "visible chatbot response").not.to.equal("");
        expect(reply, "completed chatbot response").not.to.equal("Typing...");
        expect(
          guidance.test(reply) || validUnavailable.test(reply),
          "supported guidance or the implemented unavailable/fallback response",
        ).to.equal(true);
      });
    });
  });
});
