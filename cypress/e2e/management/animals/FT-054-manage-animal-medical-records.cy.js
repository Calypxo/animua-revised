const { animalApi, loginAndOpenAnimal, registerAnimalMutation, resetAndVerifyBaseline } = require("../../../support/animal-functionality");

describe("FT-054 - Manage Animal Medical Records", () => {
  after(() => resetAndVerifyBaseline());
  it("adds a medical checkup to the controlled medical-history animal", () => {
    const today = new Date().toISOString().slice(0, 10);
    let medicalRecordId = "";
    loginAndOpenAnimal("FT_ANIMAL_MEDICAL_HISTORY");
    cy.intercept("POST", "**/api/animals/FT_ANIMAL_MEDICAL_HISTORY/medical").as("addMedical");
    cy.get('[data-tab="medical"]').click();
    cy.get("#medicalRecordsList").should("contain.text", "Routine FT examination");
    cy.get("#btnAddMedical").click();
    cy.get("#fMedType").select("Checkup");
    cy.get("#fMedDate").type(today);
    cy.get("#fMedDiagnosis").type("Batch 8 FT follow-up examination");
    cy.get("#fMedTreatment").type("Continued observation");
    cy.get("#fMedNotes").type("No inventory used");
    cy.get("#medicalModalSave").click();
    cy.wait("@addMedical", { timeout: 30000 }).then(({ request, response }) => {
      expect(response?.statusCode).to.equal(201);
      expect(request.body).to.include({ type: "Checkup", inventoryItemId: "", quantityUsed: 0 });
      medicalRecordId = response?.body?.id || "";
      expect(medicalRecordId).to.match(/^MR-\d+$/);
      registerAnimalMutation({
        kind: "animalMedical",
        primaryId: "FT_ANIMAL_MEDICAL_HISTORY",
        medicalRecordId,
      }).its("registeredPaths").should("have.length", 1);
    });
    cy.get("#medicalRecordsList").should("contain.text", "Batch 8 FT follow-up examination");
    animalApi("FT_ANIMAL_MEDICAL_HISTORY").then((response) => {
      const record = response.body?.animal?.medicalRecords?.find(({ id }) => id === medicalRecordId);
      expect(record).to.include({ type: "Checkup", diagnosis: "Batch 8 FT follow-up examination" });
    });
  });
});
