const {
  apiRequest,
  getAuditLogs,
  registerMutation,
  useIntegrationBaseline,
} = require("../../../support/integration");

const SURRENDER_ID = "FT_SURRENDER_INTAKE_ELIGIBLE";

function findSurrender(response) {
  return (response.body?.requests || []).find(({ id }) => id === SURRENDER_ID);
}

describe("IT-012 — Approved Surrender to Intake", () => {
  let generatedIntakeId = "";
  const context = useIntegrationBaseline({
    verifyRestored({ tokens }) {
      return apiRequest({ path: "surrenders", token: tokens.Admin })
        .then((response) => {
          expect(findSurrender(response)).to.include({
            id: SURRENDER_ID,
            status: "Approved",
            intakeId: null,
          });
          expect(findSurrender(response).arrivalConfirmedAt).to.be.a("string").and.not.be.empty;
          return apiRequest({ path: "intake", token: tokens.Admin });
        })
        .then((response) => {
          expect(
            (response.body?.records || []).some(
              ({ id, surrenderRefId }) => id === generatedIntakeId || surrenderRefId === SURRENDER_ID,
            ),
          ).to.equal(false);
        });
    },
  });

  it("creates one linked intake, converts the surrender, and rejects duplicate conversion", () => {
    let sourceSurrender;
    let creationResponse;
    let ledgerResult;
    let intake;
    let convertedSurrender;
    let linkedIntakes;
    let linkedAnimals;
    let duplicateResponse;
    let intakeAudits;

    apiRequest({ path: "surrenders", token: context.tokens.Admin }).then((response) => {
      sourceSurrender = findSurrender(response);
      expect(sourceSurrender).to.include({ status: "Approved", intakeId: null });
      expect(sourceSurrender.arrivalConfirmedAt).to.be.a("string").and.not.be.empty;
    });

    cy.then(() => {
      const payload = {
        identifyingDescription: sourceSurrender.pet.colorMarkings,
        previousName: sourceSurrender.pet.name,
        species: sourceSurrender.pet.species,
        breed: sourceSurrender.pet.breed,
        sex: sourceSurrender.pet.sex,
        ageEstimate: sourceSurrender.pet.age,
        color: sourceSurrender.pet.colorMarkings,
        source: "Approved Surrender",
        condition: "Fair",
        injuries: "Unknown",
        vaccinated: "Unknown",
        alteredStatus: "Unknown",
        intakeDate: new Date().toISOString().slice(0, 10),
        location: "Angeles City Veterinary Office",
        intakeNotes: `From approved surrender request ${SURRENDER_ID}. Reason: ${sourceSurrender.surrenderReason}`,
        surrenderRefId: SURRENDER_ID,
        ownerName: sourceSurrender.owner.name,
        ownerContact: sourceSurrender.owner.contact,
        surrenderApprovedDate: sourceSurrender.reviewedAt,
        status: "Pending",
      };

      apiRequest({
        method: "POST",
        path: "intake",
        token: context.tokens.Admin,
        body: payload,
      }).then((response) => {
        creationResponse = response;
        generatedIntakeId = response.body?.id || "";
        if (response.status === 201 && generatedIntakeId) {
          return registerMutation({
            kind: "intakeFromSurrender",
            primaryId: generatedIntakeId,
          }).then((result) => { ledgerResult = result; });
        }
        return undefined;
      });

      cy.then(() => {
        if (!generatedIntakeId) return;
        apiRequest({ path: `intake/${generatedIntakeId}`, token: context.tokens.Admin }).then(
          (response) => { intake = response.body?.record; },
        );
        apiRequest({ path: "surrenders", token: context.tokens.Admin }).then((response) => {
          convertedSurrender = findSurrender(response);
        });
        apiRequest({ path: "intake", token: context.tokens.Admin }).then((response) => {
          linkedIntakes = (response.body?.records || []).filter(
            ({ surrenderRefId }) => surrenderRefId === SURRENDER_ID,
          );
        });
        apiRequest({ path: "animals", token: context.tokens.Admin }).then((response) => {
          linkedAnimals = (response.body?.animals || []).filter(
            ({ intakeId, surrenderRefId }) =>
              intakeId === generatedIntakeId || surrenderRefId === SURRENDER_ID,
          );
        });
        apiRequest({
          method: "POST",
          path: "intake",
          token: context.tokens.Admin,
          body: payload,
        }).then((response) => { duplicateResponse = response; });
        getAuditLogs(context.tokens.Admin).then((logs) => {
          intakeAudits = logs.filter(
            (log) => log.rawAction === "intake.created" && log.record === generatedIntakeId,
          );
        });
      });
    });

    cy.then(() => {
      expect(creationResponse?.status).to.equal(201);
      expect(generatedIntakeId).to.match(/^INT-\d{4}-\d{3,}$/);
      expect(creationResponse?.body).to.include({
        surrenderConverted: true,
        animalProfileId: null,
        status: "Pending",
      });
      expect(ledgerResult?.animalProfileId).to.equal(null);
      expect(intake).to.include({
        id: generatedIntakeId,
        surrenderRefId: SURRENDER_ID,
        source: "Approved Surrender",
        status: "Pending",
        animalProfileId: null,
        identifyingDescription: sourceSurrender.pet.colorMarkings,
        previousName: sourceSurrender.pet.name,
        species: sourceSurrender.pet.species,
        breed: sourceSurrender.pet.breed,
        sex: sourceSurrender.pet.sex,
        ageEstimate: sourceSurrender.pet.age,
        ownerName: sourceSurrender.owner.name,
        ownerContact: sourceSurrender.owner.contact,
      });
      expect(convertedSurrender).to.include({
        id: SURRENDER_ID,
        status: "Converted",
        intakeId: generatedIntakeId,
        deadlineStatus: "Completed",
        deadlineReminderStage: "Completed",
        noShowRisk: false,
      });
      expect(linkedIntakes).to.have.length(1);
      expect(linkedIntakes[0].id).to.equal(generatedIntakeId);
      expect(linkedAnimals).to.have.length(0);
      expect(intakeAudits).to.have.length(1);
      expect(intakeAudits[0].after).to.deep.include({
        source: "Approved Surrender",
        species: sourceSurrender.pet.species,
        status: "Pending",
      });
      expect(duplicateResponse?.status).to.be.oneOf([400, 409]);
    });

    apiRequest({ path: "intake", token: context.tokens.Admin }).then((response) => {
      expect(
        (response.body?.records || []).filter(
          ({ surrenderRefId }) => surrenderRefId === SURRENDER_ID,
        ),
      ).to.have.length(1);
    });
  });
});
