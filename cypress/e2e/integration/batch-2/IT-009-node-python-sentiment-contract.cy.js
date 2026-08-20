describe("IT-009 — Node-to-Python Sentiment HTTP Contract", () => {
  it("sends one real HTTP request to Python and accepts the normalized response without persistence", () => {
    cy.exec("node backend/scripts/itSentimentProbe.js", { timeout: 30000 }).then(
      ({ stdout }) => {
        const lines = stdout.trim().split(/\r?\n/);
        const result = JSON.parse(lines.at(-1));

        expect(result.reason).to.equal(
          "I am relocating and cannot bring my dog to our new home.",
        );
        expect(result.httpCalls).to.have.length(1);
        expect(result.httpCalls[0]).to.deep.include({
          url: result.configuredUrl,
          method: "POST",
          status: 200,
          requestBody: { reason: result.reason },
        });
        expect(result.result).to.deep.equal(result.httpCalls[0].responseBody);
        expect(result.result).to.include.all.keys(
          "sentiment",
          "category",
          "urgencyLabel",
          "urgencyScore",
          "confidence",
          "keywords",
          "suggestedPriority",
          "source",
        );
        expect(result.result.source).not.to.contain("Node fallback");
      },
    );
  });
});
