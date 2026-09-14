// Real management UI with mocked requests; no production records are changed.
describe("Surrender analysis refresh", () => {
  const model = { source: "Tagalog RoBERTa Transformer", sentiment: "Neutral", category: "Relocation", modelCategory: "Relocation", urgencyLabel: "Low", urgencyScore: 25, confidence: 0.94, categoryConfidence: 0.94, keywords: ["lilipat"] };
  let request, latest, refreshCount, refreshDelay;
  beforeEach(() => {
    request = { id: "SR-PENDING", status: "Pending", createdAt: new Date().toISOString(), owner: { name: "Test Owner" }, pet: { name: "Test Pet", species: "Dog" }, surrenderReason: "Lilipat kami at bawal ang alagang aso sa bagong bahay.", nlpStatus: "pending", nlp: { source: "Local rules (RoBERTa analysis pending)", sentiment: "Neutral", category: "Other", urgencyLabel: "Medium", urgencyScore: 55, confidence: 0 } };
    latest = null;
    refreshCount = 0;
    refreshDelay = 0;
    cy.intercept("**/api/**", req => {
      const path = new URL(req.url).pathname;
      if (path.endsWith("/protected")) return req.reply({ user: { id: "admin-test", role: "Admin", fullName: "Test Admin", email: "test@example.com" } });
      if (path.endsWith("/surrenders/availability")) return req.reply({ acceptingRequests: true });
      if (path.endsWith("/surrenders/analysis-status")) { refreshCount++; return req.reply({ delay: refreshDelay, body: { requests: [latest || request] } }); }
      if (path.endsWith("/surrenders")) return req.reply({ requests: [request] });
      if (path.endsWith("/SR-PENDING/reanalyze")) return req.reply({ nlp: model, nlpStatus: "completed", nlpAnalyzedAt: new Date().toISOString() });
      if (req.method !== "GET") throw new Error(`Unexpected write: ${path}`);
      return req.reply({ notifications: [], unreadCount: 0, results: [], items: [] });
    });
  });

  [1280, 390].forEach(width => {
    it(`updates pending analysis without a rerun or losing the open review at ${width}px`, () => {
      cy.viewport(width, 720);
      cy.visit("/pages/surrenders.html?id=SR-PENDING");
      cy.get(".triage-analysis-status").should("contain.text", "RoBERTa analysis in progress");
      cy.get(".triage-confidence").should("contain.text", "Not available").and("not.contain.text", "0%");
      cy.get("#reanalyzeSurrenderBtn").should("be.disabled");
      cy.get(".triage-analysis-status").scrollIntoView();
      cy.screenshot(`analysis-pending-${width}`, {
        capture: "viewport", disableTimersAndAnimations: false,
        onBeforeScreenshot: () => {
          const status = cy.state("document").querySelector(".triage-analysis-status");
          let parent = status.parentElement;
          while (parent && !(parent.scrollHeight > parent.clientHeight && /auto|scroll/.test(getComputedStyle(parent).overflowY))) parent = parent.parentElement;
          if (parent) parent.scrollTo({ top: parent.scrollTop + status.getBoundingClientRect().top - parent.getBoundingClientRect().top - 80, behavior: "instant" });
        },
      });
      cy.get("#drawerRejectBtn").click();
      cy.get("#rejectReason").type("Keep this review draft while analysis updates.");
      cy.then(() => { latest = { id: request.id, nlp: model, nlpStatus: "completed", nlpAnalyzedAt: new Date().toISOString() }; });
      cy.get(".triage-analysis-source", { timeout: 12000 }).should("contain.text", "Tagalog RoBERTa Transformer");
      cy.get(".triage-confidence").should("contain.text", "94%");
      cy.get(".triage-analysis-status").should("not.exist");
      cy.get("#rejectReason").should("have.value", "Keep this review draft while analysis updates.");
      cy.get("#rejectModalCancel").click();
      cy.get("#reanalyzeSurrenderBtn").should("be.enabled");
      cy.get('tr[data-id="SR-PENDING"]').should("contain.text", "Relocation");
    });
  });

  it("refreshes an old fallback display from the saved result when opened", () => {
    request.nlpStatus = "fallback";
    request.nlp.source = "Node fallback (Tagalog sentiment service unavailable)";
    latest = { id: request.id, nlp: model, nlpStatus: "completed", nlpAnalyzedAt: new Date().toISOString() };
    cy.visit("/pages/surrenders.html?id=SR-PENDING");
    cy.get(".triage-analysis-source").should("contain.text", "Tagalog RoBERTa Transformer");
    cy.then(() => expect(refreshCount).to.be.greaterThan(0));
  });

  it("offers a retry after the pending analysis fails", () => {
    latest = { id: request.id, nlp: request.nlp, nlpStatus: "fallback", nlpAnalyzedAt: null };
    cy.visit("/pages/surrenders.html?id=SR-PENDING");
    cy.get(".triage-analysis-status").should("contain.text", "RoBERTa did not finish");
    cy.get("#reanalyzeSurrenderBtn").should("be.enabled").click();
    cy.get(".triage-analysis-source").should("contain.text", "Tagalog RoBERTa Transformer");
    cy.get(".triage-analysis-status").should("not.exist");
  });

  it("a delayed refresh cannot replace a newer successful rerun with fallback", () => {
    request.nlpStatus = "fallback";
    request.nlp.source = "Node fallback (Tagalog sentiment service unavailable)";
    refreshDelay = 4000;
    cy.intercept("GET", "**/surrenders/analysis-status*").as("staleRefresh");
    cy.visit("/pages/surrenders.html?id=SR-PENDING");
    cy.get("#reanalyzeSurrenderBtn").click();
    cy.get(".triage-analysis-source").should("contain.text", "Tagalog RoBERTa Transformer");
    cy.wait("@staleRefresh");
    cy.get(".triage-analysis-source").should("contain.text", "Tagalog RoBERTa Transformer");
    cy.get(".triage-analysis-status").should("not.exist");
  });
});
