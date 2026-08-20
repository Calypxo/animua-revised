const {
  apiRequest,
  getAuditLogs,
  registerMutation,
  useIntegrationBaseline,
} = require("../../../support/integration");

const SUCCESS_ANIMAL = "FT_ANIMAL_QUARANTINE_EMPTY";
const FAILURE_ANIMAL = "FT_ANIMAL_MEDICAL_HISTORY";
const MEDICINE_ID = "FT_TEST_MEDICINE_01";
const UNRELATED_ITEM = "FT_TEST_LOW";
const QUANTITY_USED = 3;

function treatmentBody(quantity) {
  return {
    type: "Treatment",
    date: new Date().toISOString().slice(0, 10),
    diagnosis: "IT-007 controlled diagnosis",
    treatment: "IT-007 controlled antibiotic treatment",
    notes: "IT-007 atomic integration verification",
    inventoryItemId: MEDICINE_ID,
    quantityUsed: quantity,
  };
}

describe("IT-007 — Medical Treatment and Inventory Atomicity", () => {
  const context = useIntegrationBaseline({
    verifyRestored({ tokens }) {
      return apiRequest({ path: `inventory/${MEDICINE_ID}`, token: tokens.Admin })
        .then((response) => {
          expect(response.body?.item?.currentStock).to.equal(100);
          return apiRequest({ path: `animals/${SUCCESS_ANIMAL}`, token: tokens.Admin });
        })
        .then((response) => {
          expect(response.body?.animal?.medicalRecords || []).to.have.length(0);
          return apiRequest({
            path: `inventory/${MEDICINE_ID}/transactions`,
            token: tokens.Admin,
          });
        })
        .then((response) => {
          expect(response.body?.transactions || []).to.have.length(0);
        });
    },
  });

  it("commits treatment, stock, transaction, and audits together and rolls back excessive use", () => {
    let startingMedicine;
    let startingSuccessAnimal;
    let startingFailureAnimal;
    let unrelatedBefore;
    let successResponse;
    let failureResponse;
    let successAnimalAfter;
    let failureAnimalAfter;
    let medicineAfter;
    let unrelatedAfter;
    let transactionsAfter;
    let audits;

    apiRequest({ path: `inventory/${MEDICINE_ID}`, token: context.tokens.Admin }).then(
      (response) => {
        startingMedicine = response.body.item;
        expect(startingMedicine.currentStock).to.equal(100);
      },
    );
    apiRequest({ path: `animals/${SUCCESS_ANIMAL}`, token: context.tokens.Admin }).then(
      (response) => {
        startingSuccessAnimal = response.body.animal;
      },
    );
    apiRequest({ path: `animals/${FAILURE_ANIMAL}`, token: context.tokens.Admin }).then(
      (response) => {
        startingFailureAnimal = response.body.animal;
      },
    );
    apiRequest({ path: `inventory/${UNRELATED_ITEM}`, token: context.tokens.Admin }).then(
      (response) => {
        unrelatedBefore = response.body.item;
      },
    );

    apiRequest({
      method: "POST",
      path: `animals/${SUCCESS_ANIMAL}/medical`,
      token: context.tokens.Admin,
      body: treatmentBody(QUANTITY_USED),
    }).then((response) => {
      successResponse = response;
      if (response.status === 201 && response.body?.id) {
        return registerMutation({
          kind: "medicalInventory",
          primaryId: SUCCESS_ANIMAL,
          inventoryItemId: MEDICINE_ID,
          medicalRecordId: response.body.id,
          quantity: QUANTITY_USED,
        });
      }
      return undefined;
    });

    cy.then(() => {
      const excessiveQuantity = Number(startingMedicine.currentStock) + 1;
      return apiRequest({
        method: "POST",
        path: `animals/${FAILURE_ANIMAL}/medical`,
        token: context.tokens.Admin,
        body: treatmentBody(excessiveQuantity),
      }).then((response) => {
        failureResponse = response;
        if (response.status === 201 && response.body?.id) {
          return registerMutation({
            kind: "medicalInventory",
            primaryId: FAILURE_ANIMAL,
            inventoryItemId: MEDICINE_ID,
            medicalRecordId: response.body.id,
            quantity: excessiveQuantity,
          });
        }
        return undefined;
      });
    });

    apiRequest({ path: `animals/${SUCCESS_ANIMAL}`, token: context.tokens.Admin }).then(
      (response) => {
        successAnimalAfter = response.body.animal;
      },
    );
    apiRequest({ path: `animals/${FAILURE_ANIMAL}`, token: context.tokens.Admin }).then(
      (response) => {
        failureAnimalAfter = response.body.animal;
      },
    );
    apiRequest({ path: `inventory/${MEDICINE_ID}`, token: context.tokens.Admin }).then(
      (response) => {
        medicineAfter = response.body.item;
      },
    );
    apiRequest({ path: `inventory/${UNRELATED_ITEM}`, token: context.tokens.Admin }).then(
      (response) => {
        unrelatedAfter = response.body.item;
      },
    );
    apiRequest({
      path: `inventory/${MEDICINE_ID}/transactions`,
      token: context.tokens.Admin,
    }).then((response) => {
      transactionsAfter = response.body.transactions || [];
    });
    getAuditLogs(context.tokens.Admin).then((logs) => {
      audits = logs;
    });

    cy.then(() => {
      const medicalRecordId = successResponse?.body?.id;
      const addedRecords = successAnimalAfter.medicalRecords.filter(
        (record) => record.id === medicalRecordId,
      );
      const matchingTransactions = transactionsAfter.filter(
        (transaction) => transaction.medicalRecordId === medicalRecordId,
      );
      const animalAudits = audits.filter(
        (log) =>
          log.rawAction === "animal.medical_record_added" &&
          log.record === SUCCESS_ANIMAL &&
          log.after?.medicalRecordId === medicalRecordId,
      );
      const inventoryAudits = audits.filter(
        (log) =>
          log.rawAction === "inventory.medical_stock_used" &&
          log.record === MEDICINE_ID &&
          log.after?.medicalRecordId === medicalRecordId,
      );
      const failedAnimalTransactions = transactionsAfter.filter(
        (transaction) => transaction.animalId === FAILURE_ANIMAL,
      );
      const falseFailureAudits = audits.filter(
        (log) =>
          ["animal.medical_record_added", "inventory.medical_stock_used"].includes(
            log.rawAction,
          ) &&
          (log.record === FAILURE_ANIMAL || log.after?.animalId === FAILURE_ANIMAL),
      );

      expect(successResponse?.status).to.equal(201);
      expect(successResponse?.body?.inventory).to.include({
        itemId: MEDICINE_ID,
        quantityUsed: QUANTITY_USED,
        newStock: startingMedicine.currentStock - QUANTITY_USED,
      });
      expect(addedRecords).to.have.length(1);
      expect(addedRecords[0]).to.include({
        inventoryItemId: MEDICINE_ID,
        quantityUsed: QUANTITY_USED,
        diagnosis: "IT-007 controlled diagnosis",
        treatment: "IT-007 controlled antibiotic treatment",
      });
      expect(successAnimalAfter.medicalRecords).to.have.length(
        startingSuccessAnimal.medicalRecords.length + 1,
      );
      expect(medicineAfter.currentStock).to.equal(
        startingMedicine.currentStock - QUANTITY_USED,
      );
      expect(matchingTransactions).to.have.length(1);
      expect(matchingTransactions[0]).to.include({
        type: "out",
        qty: QUANTITY_USED,
        animalId: SUCCESS_ANIMAL,
        medicalRecordId,
        procedure: "Treatment",
      });
      expect(animalAudits).to.have.length(1);
      expect(inventoryAudits).to.have.length(1);
      expect(inventoryAudits[0].after).to.include({
        animalId: SUCCESS_ANIMAL,
        medicalRecordId,
        quantityUsed: QUANTITY_USED,
      });

      expect(failureResponse?.status).to.equal(409);
      expect(failureResponse?.body?.message).to.include(
        `only has ${startingMedicine.currentStock - QUANTITY_USED}`,
      );
      expect(failureAnimalAfter.medicalRecords).to.deep.equal(
        startingFailureAnimal.medicalRecords,
      );
      expect(medicineAfter.currentStock).to.equal(
        startingMedicine.currentStock - QUANTITY_USED,
      );
      expect(failedAnimalTransactions).to.have.length(0);
      expect(falseFailureAudits).to.have.length(0);
      expect(unrelatedAfter.currentStock).to.equal(unrelatedBefore.currentStock);
    });
  });
});
