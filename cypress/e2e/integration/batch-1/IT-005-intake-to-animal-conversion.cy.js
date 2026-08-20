const {
  apiRequest,
  getAuditLogs,
  registerMutation,
  useIntegrationBaseline,
} = require("../../../support/integration");

const INTAKE_ID = "FT_INTAKE_CONVERT_CANDIDATE";

describe("IT-005 — Intake-to-Animal Conversion", () => {
  let generatedAnimalId = "";
  const context = useIntegrationBaseline({
    verifyRestored({ tokens }) {
      return apiRequest({ path: `intake/${INTAKE_ID}`, token: tokens.Admin }).then(
        (response) => {
          expect(response.status).to.equal(200);
          expect(response.body?.record).to.include({
            id: INTAKE_ID,
            status: "Approved",
            animalProfileId: null,
          });
          if (generatedAnimalId) {
            return apiRequest({
              path: `animals/${encodeURIComponent(generatedAnimalId)}`,
              token: tokens.Admin,
            }).its("status").should("eq", 404);
          }
          return undefined;
        },
      );
    },
  });

  it("converts one approved intake, persists its relationship and audit, and prevents duplication", () => {
    let startingIntake;
    let conversionResponse;
    let ledgerResult;
    let convertedIntake;
    let generatedAnimal;
    let duplicateResponse;
    let linkedAnimals;
    let audits;

    apiRequest({ path: `intake/${INTAKE_ID}`, token: context.tokens.Admin }).then(
      (response) => {
        expect(response.status).to.equal(200);
        startingIntake = response.body.record;
        expect(startingIntake).to.include({ status: "Approved", animalProfileId: null });
      },
    );

    apiRequest({
      method: "POST",
      path: `intake/${INTAKE_ID}/convert`,
      token: context.tokens.Admin,
    }).then((response) => {
      conversionResponse = response;
      generatedAnimalId = response.body?.animalProfileId || "";
      if (response.status === 201 && generatedAnimalId) {
        return registerMutation({ kind: "intakeConversion", primaryId: INTAKE_ID }).then(
          (result) => {
            ledgerResult = result;
          },
        );
      }
      return undefined;
    });

    cy.then(() => {
      if (!generatedAnimalId) return;
      apiRequest({ path: `intake/${INTAKE_ID}`, token: context.tokens.Admin }).then(
        (response) => {
          convertedIntake = response.body?.record;
        },
      );
      apiRequest({
        path: `animals/${encodeURIComponent(generatedAnimalId)}`,
        token: context.tokens.Admin,
      }).then((response) => {
        generatedAnimal = response.body?.animal;
      });
      apiRequest({
        method: "POST",
        path: `intake/${INTAKE_ID}/convert`,
        token: context.tokens.Admin,
      }).then((response) => {
        duplicateResponse = response;
      });
      apiRequest({ path: "animals", token: context.tokens.Admin }).then((response) => {
        linkedAnimals = (response.body?.animals || []).filter(
          (animal) => animal.intakeId === INTAKE_ID,
        );
      });
      getAuditLogs(context.tokens.Admin).then((logs) => {
        audits = logs.filter(
          (log) => log.rawAction === "intake.converted" && log.record === INTAKE_ID,
        );
      });
    });

    cy.then(() => {
      expect(conversionResponse?.status).to.equal(201);
      expect(conversionResponse?.body).to.include({
        intakeId: INTAKE_ID,
        animalProfileId: generatedAnimalId,
      });
      expect(ledgerResult?.animalProfileId).to.equal(generatedAnimalId);
      expect(ledgerResult?.registeredPaths).to.include(`animals/${generatedAnimalId}`);

      expect(convertedIntake).to.include({
        id: INTAKE_ID,
        status: "Converted",
        animalProfileId: generatedAnimalId,
      });
      expect(generatedAnimal).to.include({
        id: generatedAnimalId,
        intakeId: INTAKE_ID,
        status: "Profiling",
        currentStage: "profiling",
        species: startingIntake.species,
        breed: startingIntake.breed,
        identifyingDescription: startingIntake.identifyingDescription,
        source: startingIntake.source,
        intakeDate: startingIntake.intakeDate,
        intakeLocation: startingIntake.location,
      });
      expect(
        generatedAnimal.history.filter((entry) => entry.event === "Started profiling"),
      ).to.have.length(1);
      expect(audits).to.have.length(1);
      expect(audits[0].after).to.deep.include({
        status: "Converted",
        animalProfileId: generatedAnimalId,
      });

      expect(duplicateResponse?.status).to.equal(400);
      expect(duplicateResponse?.body?.message).to.equal(
        "Only Pending or Approved intakes can be moved to profiling.",
      );
      expect(linkedAnimals).to.have.length(1);
      expect(linkedAnimals[0].id).to.equal(generatedAnimalId);
    });
  });
});
