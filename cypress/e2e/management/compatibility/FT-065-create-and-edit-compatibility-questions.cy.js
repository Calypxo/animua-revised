const { DEFAULT_QUESTIONS } = require("../../../../backend/src/services/quizQuestionService");
const { cloneDefaultQuestions, BEHAVIOR_GROUPS } = require("../../../../backend/src/services/behavioralQuestionService");

// Real management pages; every API call is mocked so these tests change no live records.
describe("Fixed compatibility wording and animal special-needs status", () => {
  let questions, animal;
  beforeEach(() => {
    questions = structuredClone(DEFAULT_QUESTIONS);
    animal = { id: "care-test", status: "Quarantine", species: "Dog", name: "Care test", intakeDate: "2026-09-01", behavioralAssessment: { ...Object.fromEntries(cloneDefaultQuestions().map(question => [question.traitKey, 3])), specialNeeds: 4 } };
    cy.intercept("**/api/**", request => {
      const path = new URL(request.url).pathname;
      if (path.endsWith("/protected")) return request.reply({ user: { id: "test-admin", role: "Admin", fullName: "Test Admin", email: "test@example.com" } });
      if (path.endsWith("/match/admin/questions")) {
        if (request.method === "PUT") questions = request.body.questions;
        return request.reply({ questions, version: request.method === "PUT" ? 2 : 1 });
      }
      if (path.endsWith("/match/admin/settings")) return request.reply({ settings: { quizEnabled: true, retakeCooldownDays: 30, quizVersion: 1 } });
      if (path.endsWith("/animals/behavioral-questions")) return request.reply({ questions: cloneDefaultQuestions(), groups: Object.values(BEHAVIOR_GROUPS), version: 1 });
      if (path.endsWith("/animals/care-test/behavioral")) {
        animal = { ...animal, ...request.body, behavioralAssessment: request.body.traits };
        return request.reply({ message: "Behavioral assessment saved." });
      }
      if (path.endsWith("/animals/care-test")) return request.reply({ animal });
      if (request.method !== "GET") throw new Error(`Unexpected mutation: ${request.method} ${path}`);
      return request.reply({ results: [], notifications: [], items: [], unreadCount: 0 });
    });
  });

  [1280, 390].forEach(width => {
    it(`edits wording while preserving question and answer mappings at ${width}px`, () => {
      cy.viewport(width, 844);
      cy.visit("/pages/compatibilityQuiz.html");
      cy.get('[data-cq-tab="questions"]').click();
      cy.get("#addQuestionBtn").should("not.exist");
      cy.get('#questionList [data-action="toggle"], #questionList [data-action="move-up"], #questionList [data-action="move-down"]').should("be.disabled");
      cy.get('#questionList [data-action="edit"]').first().click();
      cy.get("#questionEditorDialog .cq-question-modal").should($modal => {
        const rect = $modal[0].getBoundingClientRect();
        expect(rect.left, "modal stays inside left edge").to.be.at.least(-0.5);
        expect(rect.right, "modal stays inside right edge").to.be.at.most(width + 0.5);
        if (width > 800) expect(rect.width, "original desktop panel width").to.be.closeTo(860, 1);
      });
      cy.get("#editorQuestionTrait, #editorQuestionPhase").should("be.disabled");
      cy.get("#editorAddChoice").should("not.exist");
      cy.get("[data-editor-remove]").should("be.disabled");
      cy.get("#editorChoiceList select[disabled]").should("have.length", 5);
      cy.get("#editorQuestionText").clear().type("What energy level fits your household?");
      cy.get('[data-editor-choice="text"]').first().clear().type("A very calm pet");
      cy.get("#questionEditorDialog .um-modal-body").scrollTo("top");
      cy.get("#questionEditorDialog").screenshot(`compatibility-wording-${width}`);
      cy.get("#applyQuestionEdit").click();
      cy.intercept("PUT", "**/api/match/admin/questions").as("publishWording");
      cy.get("#saveQuestionsBtn").scrollIntoView().click();
      cy.wait("@publishWording").then(({ request }) => {
        expect(request.body.version).to.equal(1);
        const expected = structuredClone(DEFAULT_QUESTIONS);
        expected[0].text = "What energy level fits your household?";
        expected[0].choices[0].text = "A very calm pet";
        expect(request.body.questions).to.deep.equal(expected);
      });
      cy.get("#questionDraftBar").should("not.be.visible");
      cy.get("#questionList").should("contain.text", "What energy level fits your household?");
    });
  });

  it("reviews a legacy numeric rating and saves separate care status and notes", () => {
    cy.viewport(1280, 900);
    cy.visit("/pages/animalProfile.html?id=care-test");
    cy.get('[data-tab="behavioral"]').click();
    cy.get("#behavioralContent").should("contain.text", "Not yet assessed");
    cy.get("#btnEditBehavioral").click();
    cy.get("#specialNeedsStatus").should("have.value", "unknown");
    cy.get("#specialNeedsReviewHint").should("contain.text", "previous numeric");
    cy.get("#slider-specialNeeds").should("not.exist");
    cy.get("#specialNeedsStatus").select("yes");
    cy.get("#behavioralModalSave").click();
    cy.get("#toastMsg").should("contain.text", "Describe the animal's special needs");
    cy.get("#specialNeedsNotes").type("Daily mobility assistance and an accessible sleeping area.");
    cy.get("#behavioralModalBackdrop").screenshot("animal-special-needs-status");
    cy.intercept("POST", "**/api/animals/care-test/behavioral").as("saveAssessment");
    cy.get("#behavioralModalSave").click();
    cy.wait("@saveAssessment").then(({ request }) => {
      expect(request.body.specialNeedsStatus).to.equal("yes");
      expect(request.body.specialNeedsNotes).to.contain("Daily mobility assistance");
      expect(request.body.traits).not.to.have.property("specialNeeds");
      expect(Object.keys(request.body.traits)).to.have.length(16);
    });
    cy.get("#behavioralContent").should("contain.text", "Requires special care").and("contain.text", "Daily mobility assistance");
    cy.get("#btnEditBehavioral").click();
    cy.get("#specialNeedsStatus").should("have.value", "yes");
    cy.get("#specialNeedsNotes").should("contain.value", "Daily mobility assistance");
  });
});
