const { animalApi, loginAndOpenAnimal, registerAnimalMutation, resetAndVerifyBaseline } = require("../../../support/animal-functionality");

describe("FT-055 - Set Quarantine Clearance", () => {
  after(() => resetAndVerifyBaseline());
  it("enforces the management role and clears the controlled assessed animal", () => {
    let medicalRecordId = "";
    loginAndOpenAnimal("FT_ANIMAL_QUARANTINE_ASSESSED", "Staff");
    cy.get('[data-tab="medical"]').click();
    cy.get('[data-clearance-decision="Cleared"]').should("not.exist");
    cy.clearAnimuaSession();
    loginAndOpenAnimal("FT_ANIMAL_QUARANTINE_ASSESSED");
    cy.intercept("POST", "**/api/animals/FT_ANIMAL_QUARANTINE_ASSESSED/medical").as("clearance");
    cy.get('[data-tab="medical"]').click();
    cy.get('[data-clearance-decision="Cleared"]').scrollIntoView().should("be.visible").click();
    cy.wait("@clearance", { timeout: 30000 }).then(({ request, response }) => {
      expect(response?.statusCode).to.equal(201);
      expect(request.body).to.include({ type: "Quarantine Clearance", clearance: "Cleared" });
      medicalRecordId = response?.body?.id || "";
      expect(medicalRecordId).to.match(/^MR-\d+$/);
      registerAnimalMutation({
        kind: "animalClearance",
        primaryId: "FT_ANIMAL_QUARANTINE_ASSESSED",
        medicalRecordId,
      }).its("registeredPaths").should("have.length", 1);
    });
    cy.get("#quarantineCard").should("contain.text", "Cleared");
    animalApi("FT_ANIMAL_QUARANTINE_ASSESSED").then((response) => {
      expect(response.body?.animal?.quarantineClearance).to.equal("Cleared");
      const record = response.body?.animal?.medicalRecords?.find(({ id }) => id === medicalRecordId);
      expect(record).to.include({ type: "Quarantine Clearance", clearance: "Cleared" });
    });
  });
});
