const { DEFAULT_QUESTIONS } = require("../../../../backend/src/services/quizQuestionService");
const { cloneDefaultQuestions, BEHAVIOR_GROUPS } = require("../../../../backend/src/services/behavioralQuestionService");

// Real management pages; every API call is mocked so these tests change no live records.
describe("Fixed compatibility wording and animal special-needs status", () => {
  let questions, animal;
  beforeEach(() => {
    questions = structuredClone(DEFAULT_QUESTIONS);
    animal = { behavioralNotes: "Observed behaviors:\n- Leash walking\n\nAssessment notes:\nKeep a calm routine.", id: "care-test", status: "Quarantine", species: "Dog", name: "Care test", intakeDate: "2026-09-01", behavioralAssessment: { ...Object.fromEntries(cloneDefaultQuestions().map(question => [question.traitKey, 3])), specialNeeds: 4 } };
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
        animal = { ...animal, ...request.body, behavioralNotes: request.body.notes, behavioralAssessment: request.body.traits };
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
      cy.get('#questionList button:not([data-action="edit"])').should("not.exist");
      cy.get('#questionList [data-action="edit"]').first().click();
      cy.get("#questionEditorDialog .cq-question-modal").should($modal => {
        const rect = $modal[0].getBoundingClientRect();
        expect(rect.left, "modal stays inside left edge").to.be.at.least(-0.5);
        expect(rect.right, "modal stays inside right edge").to.be.at.most(width + 0.5);
        if (width > 800) expect(rect.width, "original desktop panel width").to.be.closeTo(860, 1);
      });
      cy.get("#editorQuestionTrait").should("have.text", "Energy level");
      cy.get("#editorQuestionPhase").should("have.text", "Lifestyle");
      cy.get("#editorAddChoice, [data-editor-remove], #questionEditorDialog select").should("not.exist");
      cy.get("#editorChoiceList .cq-fixed-score").should("have.length", 5);
      cy.get("#editorChoiceList [data-editor-choice=text]").should("have.length", 5);
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

  [1280, 390].forEach(width => {
    it(`reviews, drafts and saves care status without losing observations at ${width}px`, () => {
      const careNotes = "Daily mobility assistance and an accessible sleeping area.";
      cy.viewport(width, 720);
      cy.visit("/pages/animalProfile.html?id=care-test");
      cy.get('[data-tab="behavioral"]').click();
      cy.get("#behavioralContent").should("contain.text", "Not yet assessed");
      cy.get("#btnEditBehavioral").click();
      cy.get("#specialNeedsStatus").should("have.value", "unknown");
      cy.get('[name="specialNeedsChoice"][value="unknown"]').should("be.checked");
      cy.get("#specialNeedsReviewHint").should("contain.text", "previous numeric");
      cy.get("#slider-specialNeeds, #addBehaviorObservation, #behaviorObservationList").should("not.exist");
      cy.get('[name="specialNeedsChoice"][value="yes"]').check();
      cy.get("#specialNeedsNotes").should("have.attr", "required");
      cy.get("#behavioralModalSave").click();
      cy.get("#toastMsg").should("contain.text", "Describe the animal's special needs");
      cy.get("#specialNeedsNotes").type(careNotes);
      cy.get('[name="specialNeedsChoice"][value="no"]').check();
      cy.get("#specialNeedsNotes").should("be.disabled").and("not.be.visible");
      cy.get('[name="specialNeedsChoice"][value="yes"]').check();
      cy.get("#specialNeedsNotes").should("have.value", careNotes);
      cy.get("#behavioralModalDraft").click();
      cy.reload();
      cy.get('[data-tab="behavioral"]').click();
      cy.get("#btnEditBehavioral").click();
      cy.get('[name="specialNeedsChoice"][value="yes"]').should("be.checked");
      cy.get("#specialNeedsNotes").should("have.value", careNotes).and("have.attr", "required");
      cy.get(".care-status-option").each($option => {
        const rect = $option[0].getBoundingClientRect();
        expect(rect.left).to.be.at.least(0);
        expect(rect.right).to.be.at.most(width);
      });
      cy.get('[name="specialNeedsChoice"]').each($input => {
        expect($input[0].getBoundingClientRect().width, "radio stays compact on phones").to.be.closeTo(17, 1);
      });
      cy.get("#behavioralModalBackdrop .um-modal-body").scrollTo("top");
      cy.get("#behavioralModalBackdrop").should("have.css", "opacity", "1");
      cy.get("#behavioralModalBackdrop .behavioral-modal").should($modal => {
        const rect = $modal[0].getBoundingClientRect();
        expect(rect.left, "assessment fits the left edge").to.be.at.least(-0.5);
        expect(rect.right, "assessment fits the right edge").to.be.at.most(width + 0.5);
      });
      cy.screenshot(`animal-special-needs-status-${width}`, { capture: "viewport", disableTimersAndAnimations: false });
      cy.intercept("POST", "**/api/animals/care-test/behavioral").as("saveAssessment");
      cy.get("#behavioralModalSave").click();
      cy.wait("@saveAssessment").then(({ request }) => {
        expect(request.body.specialNeedsStatus).to.equal("yes");
        expect(request.body.specialNeedsNotes).to.equal(careNotes);
        expect(request.body.traits).not.to.have.property("specialNeeds");
        expect(Object.keys(request.body.traits)).to.have.length(16);
        expect(request.body.notes).to.equal("Observed behaviors:\n- Leash walking\n\nAssessment notes:\nKeep a calm routine.");
      });
      cy.get("#behavioralContent .care-summary-card").should("contain.text", "Requires special care").and("contain.text", careNotes);
      cy.get("#behavioralModalBackdrop").should("have.css", "opacity", "0");
      cy.get("#behavioralContent .care-summary-card").screenshot(`animal-care-summary-${width}`);
      cy.get("#btnEditBehavioral").click();
      cy.get('[name="specialNeedsChoice"][value="yes"]').should("be.checked");
      cy.get("#specialNeedsNotes").should("have.value", careNotes);
      cy.get('[name="specialNeedsChoice"][value="no"]').check();
      cy.get("#behavioralModalSave").click();
      cy.wait("@saveAssessment").then(({ request }) => {
        expect(request.body.specialNeedsStatus).to.equal("no");
        expect(request.body.specialNeedsNotes).to.equal("");
      });
      cy.get("#behavioralContent .care-summary-card").should("contain.text", "No known special needs");
      cy.get("#behavioralContent .care-summary-notes").should("not.exist");
    });

    it(`shows an actionable empty assessment and care status at ${width}px`, () => {
      animal.behavioralAssessment = null;
      cy.viewport(width, 720);
      cy.visit("/pages/animalProfile.html?id=care-test");
      cy.get('[data-tab="behavioral"]').click();
      cy.get("#behavioralContent .care-status-badge").should("have.text", "Not yet assessed");
      cy.get(".behavioral-assessment-empty").should("contain.text", "Select Add Assessment");
      cy.get("#behavioralContent").should("not.contain.text", "numeric");
      cy.get(".behavioral-assessment-empty").scrollIntoView().screenshot(`animal-assessment-empty-${width}`);
      cy.get("#behavioralContent .care-summary-card, .behavioral-assessment-empty").each($card => {
        const rect = $card[0].getBoundingClientRect();
        expect(rect.left).to.be.at.least(0);
        expect(rect.right).to.be.at.most(width);
      });
      cy.get("#btnEditBehavioral").click();
      cy.get('[name="specialNeedsChoice"][value="unknown"]').should("be.checked");
      cy.get("#specialNeedsNotes").should("not.have.attr", "required");
    });
  });
});
