const {
  apiRequest,
  getAuditLogs,
  registerMutation,
  useIntegrationBaseline,
} = require("../../../support/integration");

const ANIMAL_ID = "FT_ANIMAL_READY_DOG";

describe("IT-013 — Adoption Submission Propagation", () => {
  let generatedAdoptionId = "";
  const context = useIntegrationBaseline({
    roles: ["Public", "Admin", "Staff"],
    verifyRestored({ tokens }) {
      return apiRequest({ path: `animals/${ANIMAL_ID}`, token: tokens.Admin })
        .then((response) => {
          expect(response.body?.animal).to.include({ id: ANIMAL_ID, status: "Ready" });
          if (!generatedAdoptionId) return undefined;
          return apiRequest({ path: `adoptions/${generatedAdoptionId}`, token: tokens.Admin });
        })
        .then((response) => {
          if (response) expect(response.status).to.equal(404);
        });
    },
  });

  it("propagates one authenticated client application to persistence, management notifications, and audit", () => {
    const payload = {
      pet_id: ANIMAL_ID,
      pet_age: "Adult",
      pet_sex: "Male",
      pet_type: "Dog",
      pet_status: "Ready",
      application_reference: `IT-013-${Date.now()}`,
      submission_timestamp: new Date().toISOString(),
      full_name: "Client Active",
      age: "30",
      birthdate: "1996-01-01",
      address: "FT Address, Angeles City",
      civil_status: "Single",
      gender: "Prefer not to say",
      citizenship: "Filipino",
      contact_number: "09170000000",
      occupation: "Functionality Tester",
      has_current_pets: "No",
      visit_veterinarian: "Yes",
      housing_type: "Owned house",
      residence_allows_pets: "Yes",
      why_adopt: "I can provide a safe and permanent home.",
      primary_caregiver: "Applicant",
      pet_stay_location: "Inside the family home",
      hours_alone: "4",
      provide_vet_care: "Yes",
      provide_daily_care: "Yes",
      cannot_care_plan: "Contact the shelter for responsible assistance.",
      confirm_truthful: true,
      agree_declaration: true,
      understand_no_guarantee: true,
      signature_name: "Client Active",
    };
    let creationResponse;
    let adoption;
    let animal;
    let clientApplications;
    let adminNotification;
    let staffNotification;
    let ledgerResult;
    let audits;

    apiRequest({
      method: "POST",
      path: "adoptions",
      token: context.tokens.Public,
      body: payload,
    }).then((response) => {
      creationResponse = response;
      generatedAdoptionId = response.body?.adoptionId || "";
      if (response.status === 201 && generatedAdoptionId) {
        return registerMutation({
          kind: "adoptionApplication",
          primaryId: generatedAdoptionId,
        }).then((result) => { ledgerResult = result; });
      }
      return undefined;
    });

    cy.then(() => {
      if (!generatedAdoptionId) return;
      apiRequest({ path: `adoptions/${generatedAdoptionId}`, token: context.tokens.Admin })
        .then((response) => { adoption = response.body?.adoption; });
      apiRequest({ path: `animals/${ANIMAL_ID}`, token: context.tokens.Admin })
        .then((response) => { animal = response.body?.animal; });
      apiRequest({ path: "adoptions/my-applications", token: context.tokens.Public })
        .then((response) => { clientApplications = response.body?.adoptions || []; });
      apiRequest({ path: "notifications", token: context.tokens.Admin })
        .then((response) => {
          adminNotification = (response.body?.notifications || []).find(
            ({ referenceId, type }) =>
              referenceId === generatedAdoptionId && type === "adoption_application_created",
          );
        });
      apiRequest({ path: "notifications", token: context.tokens.Staff })
        .then((response) => {
          staffNotification = (response.body?.notifications || []).find(
            ({ referenceId, type }) =>
              referenceId === generatedAdoptionId && type === "adoption_application_created",
          );
        });
      getAuditLogs(context.tokens.Admin).then((logs) => {
        audits = logs.filter(
          (log) => log.rawAction === "adoption.created" &&
            log.details === "POST /api/adoptions completed with status 201.",
        );
      });
    });

    cy.then(() => {
      expect(creationResponse?.status).to.equal(201);
      expect(generatedAdoptionId).to.match(/^[A-Za-z0-9]{20}$/);
      expect(adoption).to.deep.include({
        id: generatedAdoptionId,
        pet_id: ANIMAL_ID,
        status: "Pending",
      });
      expect(adoption.applicant).to.include({
        email: context.emails.Public,
        occupation: payload.occupation,
        birthdate: payload.birthdate,
        address: payload.address,
      });
      expect(adoption.other_information).to.include({ why_adopt: payload.why_adopt });
      expect(adoption.declaration).to.include({
        confirm_truthful: true,
        agree_declaration: true,
        understand_no_guarantee: true,
      });
      const clientMatches = clientApplications.filter(({ id }) => id === generatedAdoptionId);
      expect(clientMatches).to.have.length(1);
      expect(clientMatches[0].account?.email).to.equal(context.emails.Public);
      expect(clientMatches[0].applicant?.email).to.equal(context.emails.Public);
      expect(animal).to.include({ id: ANIMAL_ID, status: "Ready" });

      expect(adminNotification).to.deep.include({
        category: "management",
        referenceId: generatedAdoptionId,
      });
      expect(staffNotification).to.deep.include({
        category: "management",
        referenceId: generatedAdoptionId,
      });
      expect(
        ledgerResult.registeredPaths.filter((path) => path.startsWith("notifications/")),
      ).to.have.length(3);
      expect(audits).to.have.length(1);
      expect(audits[0]).to.include({
        module: "Adoption Management",
        status: "Success",
        record: context.emails.Public,
      });
      expect(audits[0].after).to.deep.include({
        pet_id: ANIMAL_ID,
        occupation: "Functionality Tester",
      });
    });
  });
});
