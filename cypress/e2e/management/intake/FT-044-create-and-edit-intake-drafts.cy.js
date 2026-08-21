const { resetAndVerifyBaseline } = require("../../../support/integration");

describe("FT-044 - Create and Edit Intake Drafts", () => {
  after(() => resetAndVerifyBaseline());

  it("creates and edits one controlled draft without converting it", () => {
    let intakeId = "";
    cy.loginAdmin();
    cy.intercept(
      { method: "GET", url: "**/api/intake", middleware: true },
      (request) => {
        delete request.headers["if-none-match"];
        delete request.headers["if-modified-since"];
      },
    ).as("intake");
    cy.intercept("POST", "**/api/intake").as("createDraft");
    cy.intercept("PUT", "**/api/intake/*").as("updateDraft");

    cy.visitManagementPage("/pages/intakeList.html");
    cy.wait("@intake", { timeout: 30000 });
    cy.get("#btnNewIntake").should("be.visible").and("be.enabled").click();
    cy.get('.source-opt[data-value="Rescue"]').click();
    cy.get("#fIdentifyingDescription").type("FT-044 controlled rescue draft");
    cy.get("#fSpecies").select("Dog");
    cy.get("#fSex").select("Male");
    cy.get("#fCondition").select("Good");
    cy.get("#fLocation").type("FT-044 Angeles City intake location");
    cy.get("#intakeOptionalToggle").click();
    cy.get("#fIntakeNotes").type("FT-044 initial controlled draft note");
    cy.get("#btnSaveDraft").click();
    cy.wait("@createDraft", { timeout: 30000 }).then(({ request, response }) => {
      expect(request.body).to.include({
        status: "Draft",
        source: "Rescue",
        identifyingDescription: "FT-044 controlled rescue draft",
      });
      expect(response?.statusCode).to.equal(201);
      intakeId = response?.body?.id || "";
      expect(intakeId).to.match(/^INT-\d{4}-\d{3,}$/);
      cy.task("registerFtGeneratedRecords", {
        kind: "intakeDraft",
        primaryId: intakeId,
        minimum: 1,
      });
    });
    cy.wait("@intake", { timeout: 30000 });

    cy.then(() => {
      cy.get("#searchIntake").clear().type(intakeId);
      cy.get(`tr[data-id="${intakeId}"]`).should("be.visible").click();
    });
    cy.get("#vBtnEdit").should("be.visible").and("be.enabled").click();
    cy.get("#fIdentifyingDescription")
      .clear()
      .type("FT-044 edited controlled rescue draft");
    cy.get("#fIntakeNotes")
      .clear()
      .type("FT-044 edited controlled draft note");
    cy.get("#btnSaveDraft").click();
    cy.wait("@updateDraft", { timeout: 30000 }).then(({ request, response }) => {
      expect(request.body).to.include({
        status: "Draft",
        identifyingDescription: "FT-044 edited controlled rescue draft",
        intakeNotes: "FT-044 edited controlled draft note",
      });
      expect(response?.statusCode).to.equal(200);
    });
    cy.wait("@intake", { timeout: 30000 }).then(({ response }) => {
      const draft = response?.body?.records?.find(({ id }) => id === intakeId);
      expect(draft).to.include({
        status: "Draft",
        identifyingDescription: "FT-044 edited controlled rescue draft",
        intakeNotes: "FT-044 edited controlled draft note",
        animalProfileId: null,
      });
    });
    cy.then(() =>
      cy.task("registerFtGeneratedRecords", {
        kind: "intakeDraft",
        primaryId: intakeId,
        minimum: 2,
      }),
    ).then(({ registeredPaths }) => {
      expect(registeredPaths).to.include(`intakeRecords/${intakeId}`);
      expect(registeredPaths.filter((path) => path.startsWith("auditLogs/"))).to.have.length(2);
      expect(registeredPaths.some((path) => path.startsWith("animals/"))).to.equal(false);
    });
  });
});
