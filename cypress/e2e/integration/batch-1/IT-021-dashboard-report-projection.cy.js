const {
  apiRequest,
  registerMutation,
  resetAndVerifyBaseline,
  useIntegrationBaseline,
} = require("../../../support/integration");

const ANIMAL_ID = "FT_ANIMAL_MEDICAL_HISTORY";
const MEDICINE_ID = "FT_TEST_MEDICINE_01";
const QUANTITY_USED = 99;
const TREATMENT = "IT-021 projection treatment";

function medicalBody() {
  return {
    type: "Treatment",
    date: new Date().toISOString().slice(0, 10),
    diagnosis: "IT-021 projection diagnosis",
    treatment: TREATMENT,
    notes: "IT-021 controlled projection source",
    inventoryItemId: MEDICINE_ID,
    quantityUsed: QUANTITY_USED,
  };
}

function stableDashboardProjection(body = {}) {
  return {
    totalPets: body.totalPets,
    intake: body.intake,
    profiling: body.profiling,
    quarantine: body.quarantine,
    readyForAdoption: body.readyForAdoption,
    adopted: body.adopted,
    archived: body.archived,
    pendingAdoptions: body.pendingAdoptions,
    pendingSurrenders: body.pendingSurrenders,
  };
}

function treatmentRows(reportBody = {}) {
  return {
    medical: (reportBody.reports?.medical || []).filter(
      (row) => row.animalId === ANIMAL_ID && row.treatment === TREATMENT,
    ),
    inventory: (reportBody.reports?.inventory || []).filter(
      (row) => row.animalId === ANIMAL_ID && row.treatment === TREATMENT,
    ),
  };
}

describe("IT-021 — Dashboard and Report Projection", () => {
  const context = useIntegrationBaseline({
    verifyRestored({ tokens }) {
      return apiRequest({ path: `inventory/${MEDICINE_ID}`, token: tokens.Admin })
        .its("body.item.currentStock")
        .should("eq", 100);
    },
  });

  it("projects one controlled medical/inventory mutation and restores the original projections", () => {
    let baselineDashboard;
    let baselineReport;
    let baselineMedicine;
    let mutationResponse;
    let changedDashboard;
    let changedReport;
    let changedMedicine;
    let restoredDashboard;
    let restoredReport;
    let restoredMedicine;

    apiRequest({ path: "dashboard/stats", token: context.tokens.Admin }).then(
      (response) => {
        baselineDashboard = response.body;
      },
    );
    apiRequest({ path: "reports", token: context.tokens.Admin }).then((response) => {
      baselineReport = response.body;
      expect(treatmentRows(baselineReport).medical).to.have.length(0);
      expect(treatmentRows(baselineReport).inventory).to.have.length(0);
    });
    apiRequest({ path: `inventory/${MEDICINE_ID}`, token: context.tokens.Admin }).then(
      (response) => {
        baselineMedicine = response.body.item;
        expect(baselineMedicine.currentStock).to.equal(100);
      },
    );

    apiRequest({
      method: "POST",
      path: `animals/${ANIMAL_ID}/medical`,
      token: context.tokens.Admin,
      body: medicalBody(),
    }).then((response) => {
      mutationResponse = response;
      if (response.status === 201 && response.body?.id) {
        return registerMutation({
          kind: "medicalInventory",
          primaryId: ANIMAL_ID,
          inventoryItemId: MEDICINE_ID,
          medicalRecordId: response.body.id,
          quantity: QUANTITY_USED,
        });
      }
      return undefined;
    });

    apiRequest({ path: "dashboard/stats", token: context.tokens.Admin }).then(
      (response) => {
        changedDashboard = response.body;
      },
    );
    apiRequest({ path: "reports", token: context.tokens.Admin }).then((response) => {
      changedReport = response.body;
    });
    apiRequest({ path: `inventory/${MEDICINE_ID}`, token: context.tokens.Admin }).then(
      (response) => {
        changedMedicine = response.body.item;
      },
    );

    resetAndVerifyBaseline();

    apiRequest({ path: "dashboard/stats", token: context.tokens.Admin }).then(
      (response) => {
        restoredDashboard = response.body;
      },
    );
    apiRequest({ path: "reports", token: context.tokens.Admin }).then((response) => {
      restoredReport = response.body;
    });
    apiRequest({ path: `inventory/${MEDICINE_ID}`, token: context.tokens.Admin }).then(
      (response) => {
        restoredMedicine = response.body.item;
      },
    );

    cy.then(() => {
      const changedRows = treatmentRows(changedReport);
      const restoredRows = treatmentRows(restoredReport);
      const baselineLowIds = baselineDashboard.lowStockItems.map((item) => item.id);
      const changedMedicineAlert = changedDashboard.lowStockItems.find(
        (item) => item.id === MEDICINE_ID,
      );

      expect(mutationResponse?.status).to.equal(201);
      expect(mutationResponse?.body?.inventory).to.include({
        itemId: MEDICINE_ID,
        quantityUsed: QUANTITY_USED,
        newStock: 1,
      });
      expect(changedMedicine.currentStock).to.equal(1);
      expect(baselineLowIds).not.to.include(MEDICINE_ID);
      expect(changedDashboard.lowStockItems).to.have.length(
        baselineDashboard.lowStockItems.length + 1,
      );
      expect(changedMedicineAlert).to.include({
        id: MEDICINE_ID,
        currentStock: 1,
        level: "Critical",
      });
      expect(changedDashboard.analytics.criticalStockCount).to.equal(
        baselineDashboard.analytics.criticalStockCount + 1,
      );
      expect(stableDashboardProjection(changedDashboard)).to.deep.equal(
        stableDashboardProjection(baselineDashboard),
      );

      expect(changedRows.medical).to.have.length(1);
      expect(changedRows.medical[0]).to.include({
        animalId: ANIMAL_ID,
        treatment: TREATMENT,
        inventoryItem: baselineMedicine.itemDescription,
        quantityUsed: QUANTITY_USED,
        unit: baselineMedicine.unit,
      });
      expect(changedRows.inventory).to.have.length(1);
      expect(changedRows.inventory[0]).to.include({
        animalId: ANIMAL_ID,
        treatment: TREATMENT,
        remainingStock: 1,
        stockStatus: "Critical",
      });

      expect(restoredMedicine.currentStock).to.equal(100);
      expect(stableDashboardProjection(restoredDashboard)).to.deep.equal(
        stableDashboardProjection(baselineDashboard),
      );
      expect(restoredDashboard.lowStockItems).to.deep.equal(baselineDashboard.lowStockItems);
      expect(restoredRows.medical).to.have.length(0);
      expect(restoredRows.inventory).to.have.length(0);
    });
  });
});
