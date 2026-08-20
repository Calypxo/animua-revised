const {
  apiRequest,
  getAuditLogs,
  registerMutation,
  useIntegrationBaseline,
} = require("../../../support/integration");

const STOCK_IN_ITEM = "FT_TEST_BATCH_IN_01";
const STOCK_OUT_ITEM = "FT_TEST_BATCH_OUT_01";
const INVALID_OUT_ITEM = "FT_TEST_BATCH_OUT_02";
const UNRELATED_ITEM = "FT_TEST_ITEM_MUTABLE";

function movementBody(type, qty) {
  return {
    qty,
    date: new Date().toISOString().slice(0, 10),
    supplier: type === "in" ? "IT-008 Controlled Supplier" : "",
    procedure: type === "out" ? "IT-008 Controlled Use" : "",
    notes: `IT-008 controlled stock-${type}`,
    batchId: `IT-008-${type.toUpperCase()}`,
  };
}

describe("IT-008 — Inventory Movement History", () => {
  const context = useIntegrationBaseline({
    verifyRestored({ tokens }) {
      const expected = [
        [STOCK_IN_ITEM, 20],
        [STOCK_OUT_ITEM, 30],
        [INVALID_OUT_ITEM, 30],
      ];
      return cy.wrap(expected).each(([itemId, stock]) => {
        apiRequest({ path: `inventory/${itemId}`, token: tokens.Admin })
          .its("body.item.currentStock")
          .should("eq", stock);
        apiRequest({ path: `inventory/${itemId}/transactions`, token: tokens.Admin })
          .its("body.transactions")
          .should("have.length", 0);
      });
    },
  });

  it("persists valid stock-in/out history and rejects excessive stock-out without side effects", () => {
    const starting = {};
    const responses = {};
    const afterItems = {};
    const transactionLists = {};
    let unrelatedBefore;
    let unrelatedAfter;
    let audits;

    [STOCK_IN_ITEM, STOCK_OUT_ITEM, INVALID_OUT_ITEM].forEach((itemId) => {
      apiRequest({ path: `inventory/${itemId}`, token: context.tokens.Admin }).then(
        (response) => {
          starting[itemId] = response.body.item;
        },
      );
    });
    apiRequest({ path: `inventory/${UNRELATED_ITEM}`, token: context.tokens.Admin }).then(
      (response) => {
        unrelatedBefore = response.body.item;
      },
    );

    const performAndRegister = (itemId, type, qty) =>
      apiRequest({
        method: "POST",
        path: `inventory/${itemId}/stock-${type}`,
        token: context.tokens.Admin,
        body: movementBody(type, qty),
      }).then((response) => {
        responses[itemId] = response;
        return registerMutation({
          kind: "inventoryMovement",
          primaryId: itemId,
          movementType: type,
          transactionId: response.body?.transaction?.id || "",
          quantity: qty,
          responseStatus: response.status,
        });
      });

    cy.then(() => performAndRegister(STOCK_IN_ITEM, "in", 7));
    cy.then(() => performAndRegister(STOCK_OUT_ITEM, "out", 6));
    cy.then(() => performAndRegister(INVALID_OUT_ITEM, "out", 31));

    [STOCK_IN_ITEM, STOCK_OUT_ITEM, INVALID_OUT_ITEM].forEach((itemId) => {
      apiRequest({ path: `inventory/${itemId}`, token: context.tokens.Admin }).then(
        (response) => {
          afterItems[itemId] = response.body.item;
        },
      );
      apiRequest({ path: `inventory/${itemId}/transactions`, token: context.tokens.Admin }).then(
        (response) => {
          transactionLists[itemId] = response.body.transactions || [];
        },
      );
    });
    apiRequest({ path: `inventory/${UNRELATED_ITEM}`, token: context.tokens.Admin }).then(
      (response) => {
        unrelatedAfter = response.body.item;
      },
    );
    getAuditLogs(context.tokens.Admin).then((logs) => {
      audits = logs;
    });

    cy.then(() => {
      const inTransaction = responses[STOCK_IN_ITEM]?.body?.transaction;
      const outTransaction = responses[STOCK_OUT_ITEM]?.body?.transaction;
      const auditFor = (itemId, action) =>
        audits.filter((log) => log.record === itemId && log.rawAction === action);

      expect(responses[STOCK_IN_ITEM]?.status).to.equal(201);
      expect(afterItems[STOCK_IN_ITEM].currentStock).to.equal(
        starting[STOCK_IN_ITEM].currentStock + 7,
      );
      expect(transactionLists[STOCK_IN_ITEM]).to.have.length(1);
      expect(transactionLists[STOCK_IN_ITEM][0]).to.include({
        id: inTransaction.id,
        type: "in",
        qty: 7,
        supplier: "IT-008 Controlled Supplier",
        batchId: "IT-008-IN",
        staffEmail: context.emails.Admin,
      });
      expect(auditFor(STOCK_IN_ITEM, "inventory.stock_in")).to.have.length(1);
      expect(auditFor(STOCK_IN_ITEM, "inventory.stock_in")[0].status).to.equal("Success");

      expect(responses[STOCK_OUT_ITEM]?.status).to.equal(201);
      expect(afterItems[STOCK_OUT_ITEM].currentStock).to.equal(
        starting[STOCK_OUT_ITEM].currentStock - 6,
      );
      expect(transactionLists[STOCK_OUT_ITEM]).to.have.length(1);
      expect(transactionLists[STOCK_OUT_ITEM][0]).to.include({
        id: outTransaction.id,
        type: "out",
        qty: 6,
        procedure: "IT-008 Controlled Use",
        batchId: "IT-008-OUT",
        staffEmail: context.emails.Admin,
      });
      expect(auditFor(STOCK_OUT_ITEM, "inventory.stock_out")).to.have.length(1);
      expect(auditFor(STOCK_OUT_ITEM, "inventory.stock_out")[0].status).to.equal("Success");

      expect(responses[INVALID_OUT_ITEM]?.status).to.equal(409);
      expect(responses[INVALID_OUT_ITEM]?.body?.message).to.equal(
        `Only ${starting[INVALID_OUT_ITEM].currentStock} unit(s) are available.`,
      );
      expect(afterItems[INVALID_OUT_ITEM].currentStock).to.equal(
        starting[INVALID_OUT_ITEM].currentStock,
      );
      expect(transactionLists[INVALID_OUT_ITEM]).to.have.length(0);
      expect(auditFor(INVALID_OUT_ITEM, "inventory.stock_out")).to.have.length(1);
      expect(auditFor(INVALID_OUT_ITEM, "inventory.stock_out")[0].status).to.equal("Failed");
      expect(
        auditFor(INVALID_OUT_ITEM, "inventory.stock_out").filter(
          (audit) => audit.status === "Success",
        ),
      ).to.have.length(0);
      expect(unrelatedAfter.currentStock).to.equal(unrelatedBefore.currentStock);
    });
  });
});
