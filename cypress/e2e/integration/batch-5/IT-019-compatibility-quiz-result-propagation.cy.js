const {
  apiRequest,
  registerMutation,
  useIntegrationBaseline,
} = require("../../../support/integration");

const BASELINE_RESULT_ID = "FT_QUIZ_RESULT_ELIGIBLE";
const MANAGEMENT_ROLES = ["Admin", "Staff", "Veterinarian", "ManagementMutable"];

function notificationsForResult(token, resultId) {
  return apiRequest({ path: "notifications", token }).then((response) => {
    expect(response.status).to.equal(200);
    return (response.body?.notifications || []).filter(
      ({ referenceId, type }) =>
        referenceId === resultId && type === "compatibility_quiz_completed",
    );
  });
}

describe("IT-019 — Compatibility Quiz Result Propagation", () => {
  let generatedResultId = "";
  const context = useIntegrationBaseline({
    roles: [
      "PublicQuizEligible",
      "Admin",
      "Staff",
      "Veterinarian",
      "ManagementMutable",
    ],
    verifyRestored({ tokens }) {
      return apiRequest({ path: "match/eligibility", token: tokens.PublicQuizEligible })
        .then((response) => {
          expect(response.status).to.equal(200);
          expect(response.body).to.include({
            canTakeQuiz: true,
            hasPreviousResult: true,
            reason: "RETAKE_AVAILABLE",
          });
          expect(response.body?.latestResult?.resultId).to.equal(BASELINE_RESULT_ID);
          return apiRequest({ path: "match/my-results", token: tokens.PublicQuizEligible });
        })
        .then((response) => {
          expect(response.body?.results).to.have.length(1);
          expect(response.body.results[0]).to.include({
            resultId: BASELINE_RESULT_ID,
            isLatest: true,
          });
          if (!generatedResultId) return undefined;
          return MANAGEMENT_ROLES.reduce(
            (chain, role) => chain.then(() =>
              notificationsForResult(tokens[role], generatedResultId)
                .then((notifications) => expect(notifications).to.have.length(0))),
            cy.wrap(null),
          );
        });
    },
  });

  it("persists one Python-ranked retake result, supersedes the prior latest result, and notifies management once", () => {
    let submissionBody;
    let submission;
    let duplicateSubmission;
    let ledgerResult;
    let latestResult;
    let resultHistory;
    let eligibilityAfter;
    const notificationsByRole = {};

    apiRequest({ path: "match/eligibility", token: context.tokens.PublicQuizEligible })
      .then((response) => {
        expect(response.status).to.equal(200);
        expect(response.body).to.include({
          canTakeQuiz: true,
          hasPreviousResult: true,
          reason: "RETAKE_AVAILABLE",
        });
        expect(response.body?.latestResult?.resultId).to.equal(BASELINE_RESULT_ID);
        return apiRequest({ path: "match/questions", token: context.tokens.PublicQuizEligible });
      })
      .then((response) => {
        expect(response.status).to.equal(200);
        const traitKeys = (response.body?.questions || [])
          .filter(({ active }) => active !== false)
          .map(({ traitKey }) => traitKey);
        expect(traitKeys).to.have.length(18);
        submissionBody = {
          preferences: Object.fromEntries(traitKeys.map((key) => [key, 3])),
          filters: {
            preferredSpecies: "Any",
            preferredSex: "Any",
            needAllergyFriendly: "no",
            acceptSpecialNeeds: "yes",
          },
        };
        return apiRequest({
          method: "POST",
          path: "match",
          token: context.tokens.PublicQuizEligible,
          body: submissionBody,
        });
      })
      .then((response) => {
        submission = response;
        expect(response.status).to.equal(200);
        expect(response.body?.success).to.equal(true);
        expect(response.body?.engine, "real Python scoring marker").to.equal("python");
        expect(response.body?.resultId).to.match(/^QR-\d{4}-[A-F0-9]{8}$/);
        generatedResultId = response.body.resultId;
        return registerMutation({
          kind: "compatibilityQuizRetake",
          primaryId: response.body.resultId,
        });
      })
      .then((result) => {
        ledgerResult = result;
        return apiRequest({
          method: "POST",
          path: "match",
          token: context.tokens.PublicQuizEligible,
          body: submissionBody,
        });
      })
      .then((response) => {
        duplicateSubmission = response;
      });

    apiRequest({ path: "match/my-latest-result", token: context.tokens.PublicQuizEligible })
      .then((response) => { latestResult = response.body?.result; });
    apiRequest({ path: "match/my-results", token: context.tokens.PublicQuizEligible })
      .then((response) => { resultHistory = response.body?.results || []; });
    apiRequest({ path: "match/eligibility", token: context.tokens.PublicQuizEligible })
      .then((response) => { eligibilityAfter = response.body; });
    MANAGEMENT_ROLES.forEach((role) => {
      cy.then(() => notificationsForResult(context.tokens[role], submission.body.resultId))
        .then((notifications) => { notificationsByRole[role] = notifications; });
    });

    cy.then(() => {
      const resultId = submission.body.resultId;
      const returnedMatches = submission.body.matches;
      expect(returnedMatches).to.be.an("array").and.not.be.empty;
      expect(returnedMatches.map(({ id }) => id)).to.have.length(new Set(
        returnedMatches.map(({ id }) => id),
      ).size);
      expect(returnedMatches).to.satisfy((matches) => matches.every(
        (match, index) => Number.isFinite(match.matchScore) &&
          Number.isFinite(match.matchPercent) &&
          (index === 0 || matches[index - 1].matchScore >= match.matchScore),
      ));

      expect(latestResult).to.include({
        id: resultId,
        resultId,
        userId: context.emails.PublicQuizEligible,
        userEmail: context.emails.PublicQuizEligible,
        isLatest: true,
      });
      expect(latestResult.preferences).to.deep.equal(submissionBody.preferences);
      expect(latestResult.filters).to.deep.equal(submissionBody.filters);
      expect(latestResult.matches).to.deep.equal(returnedMatches.map((match) => ({
        animalId: String(match.id || match.petId || ""),
        animalName: String(match.name || "Shelter animal"),
        compatibilityScore: Number(match.matchScore || 0),
        compatibilityPercent: Number(match.matchPercent || 0),
      })));

      expect(resultHistory).to.have.length(2);
      expect(resultHistory.filter(({ resultId: id }) => id === resultId)).to.have.length(1);
      expect(resultHistory.find(({ resultId: id }) => id === BASELINE_RESULT_ID))
        .to.include({ isLatest: false });
      expect(eligibilityAfter).to.include({
        canTakeQuiz: false,
        hasPreviousResult: true,
        reason: "RETAKE_COOLDOWN",
      });
      expect(eligibilityAfter.latestResult.resultId).to.equal(resultId);
      expect(eligibilityAfter.nextRetakeAt).to.equal(submission.body.nextRetakeAt);

      expect(duplicateSubmission.status).to.equal(403);
      expect(duplicateSubmission.body?.success).to.equal(false);
      expect(duplicateSubmission.body?.eligibility?.reason).to.equal("RETAKE_COOLDOWN");
      expect(ledgerResult.registeredPaths.filter((path) =>
        path === `compatibilityResults/${resultId}`)).to.have.length(1);
      expect(ledgerResult.registeredPaths.filter((path) =>
        path.startsWith("notifications/"))).to.have.length(4);
      MANAGEMENT_ROLES.forEach((role) => {
        expect(notificationsByRole[role], `${role} notification`).to.have.length(1);
        expect(notificationsByRole[role][0]).to.deep.include({
          referenceId: resultId,
          type: "compatibility_quiz_completed",
          category: "management",
        });
      });
    });
  });
});
