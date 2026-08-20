const {
  apiRequest,
  getAuditLogs,
  registerMutation,
  useIntegrationBaseline,
} = require("../../../support/integration");

const ELIGIBLE_ID = "FT_ADOPTION_FINALIZE_ELIGIBLE";
const BLOCKED_ID = "FT_ADOPTION_FINALIZE_BLOCKED";
const ANIMAL_ID = "FT_ANIMAL_READY_FINALIZE";
const ADOPTED_NAME = "IT Fifteen";

describe("IT-015 — Adoption Finalization and Animal Removal", () => {
  const context = useIntegrationBaseline({
    roles: ["Admin", "Public"],
    verifyRestored({ tokens }) {
      return apiRequest({ path: `adoptions/${ELIGIBLE_ID}`, token: tokens.Admin })
        .then((response) => {
          expect(response.body?.adoption).to.include({ status: "Approved", adoptionDate: "" });
          expect(response.body?.adoption?.arrivalConfirmedAt).to.be.a("string").and.not.be.empty;
          return apiRequest({ path: `animals/${ANIMAL_ID}`, token: tokens.Admin });
        })
        .then((response) => {
          expect(response.body?.animal).to.include({ id: ANIMAL_ID, status: "Ready" });
          return apiRequest({ path: "public/pets" });
        })
        .then((response) => {
          expect((response.body?.pets || []).some(({ id }) => id === ANIMAL_ID)).to.equal(true);
        });
    },
  });

  it("finalizes only the eligible adoption, adopts and unpublishes its animal, and prevents duplication", () => {
    const adoptionDate = new Date().toISOString().slice(0, 10);
    const payload = { adoptionDate, adoptedName: ADOPTED_NAME };
    let animalBefore;
    let blockedBefore;
    let blockedResponse;
    let finalizeResponse;
    let duplicateResponse;
    let finalizedAdoption;
    let blockedAfter;
    let adoptedAnimal;
    let publicPets;
    let publicDetail;
    let notification;
    let audits;

    apiRequest({ path: `animals/${ANIMAL_ID}`, token: context.tokens.Admin })
      .then((response) => { animalBefore = response.body?.animal; });
    apiRequest({ path: `adoptions/${BLOCKED_ID}`, token: context.tokens.Admin })
      .then((response) => { blockedBefore = response.body?.adoption; });

    apiRequest({
      method: "PATCH",
      path: `adoptions/${BLOCKED_ID}/finalize`,
      token: context.tokens.Admin,
      body: payload,
    }).then((response) => { blockedResponse = response; });
    apiRequest({
      method: "PATCH",
      path: `adoptions/${ELIGIBLE_ID}/finalize`,
      token: context.tokens.Admin,
      body: payload,
    }).then((response) => { finalizeResponse = response; });
    apiRequest({
      method: "PATCH",
      path: `adoptions/${ELIGIBLE_ID}/finalize`,
      token: context.tokens.Admin,
      body: payload,
    }).then((response) => {
      duplicateResponse = response;
      return registerMutation({ kind: "adoptionFinalization", primaryId: ELIGIBLE_ID });
    });

    apiRequest({ path: `adoptions/${ELIGIBLE_ID}`, token: context.tokens.Admin })
      .then((response) => { finalizedAdoption = response.body?.adoption; });
    apiRequest({ path: `adoptions/${BLOCKED_ID}`, token: context.tokens.Admin })
      .then((response) => { blockedAfter = response.body?.adoption; });
    apiRequest({ path: `animals/${ANIMAL_ID}`, token: context.tokens.Admin })
      .then((response) => { adoptedAnimal = response.body?.animal; });
    apiRequest({ path: "public/pets" })
      .then((response) => { publicPets = response.body?.pets || []; });
    apiRequest({ path: `public/pets/${ANIMAL_ID}` })
      .then((response) => { publicDetail = response; });
    apiRequest({ path: "notifications", token: context.tokens.Public }).then((response) => {
      notification = (response.body?.notifications || []).filter(
        ({ referenceId, type }) =>
          referenceId === ELIGIBLE_ID && type === "adoption_finalized",
      );
    });
    getAuditLogs(context.tokens.Admin).then((logs) => {
      audits = logs.filter(
        (log) => log.rawAction === "adoption.finalized" &&
          [ELIGIBLE_ID, BLOCKED_ID].includes(log.record),
      );
    });

    cy.then(() => {
      expect(blockedResponse?.status).to.equal(400);
      expect(blockedResponse?.body?.message).to.equal(
        "Shelter arrival must be confirmed before the adoption can be finalized.",
      );
      expect(blockedAfter).to.deep.equal(blockedBefore);

      expect(finalizeResponse?.status).to.equal(200);
      expect(finalizedAdoption).to.include({
        id: ELIGIBLE_ID,
        status: "Finalized",
        adoptionDate,
        adoptedName: ADOPTED_NAME,
        deadlineStatus: "Completed",
        deadlineReminderStage: "Completed",
        noShowRisk: false,
      });
      expect(adoptedAnimal).to.include({
        id: ANIMAL_ID,
        status: "Adopted",
        currentStage: "adopted",
        visibleToPublic: false,
        adoptionStatus: "Adopted",
        adoptionDate,
        adoptedName: ADOPTED_NAME,
        adoptionApplicationId: ELIGIBLE_ID,
        adopterName: finalizedAdoption.applicant.full_name,
      });
      expect(adoptedAnimal.history).to.have.length(animalBefore.history.length + 1);
      expect(adoptedAnimal.history.filter(({ event }) => event === "Adopted")).to.have.length(1);
      expect(adoptedAnimal.history.at(-1)).to.deep.include({
        date: adoptionDate,
        event: "Adopted",
      });
      expect(publicPets.some(({ id }) => id === ANIMAL_ID)).to.equal(false);
      expect(publicDetail.status).to.equal(404);
      expect(publicDetail.body).not.to.have.property("pet");
      expect(notification).to.have.length(1);

      expect(duplicateResponse?.status).to.equal(400);
      expect(duplicateResponse?.body?.message).to.equal(
        "Only approved applications can be finalized.",
      );
      expect(audits.filter(({ record, status }) => record === ELIGIBLE_ID && status === "Success"))
        .to.have.length(1);
      expect(audits.filter(({ record, status }) => record === ELIGIBLE_ID && status === "Failed"))
        .to.have.length(1);
      expect(audits.filter(({ record, status }) => record === BLOCKED_ID && status === "Failed"))
        .to.have.length(1);
    });
  });
});
