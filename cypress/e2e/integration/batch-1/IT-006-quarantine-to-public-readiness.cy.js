const {
  apiRequest,
  getAuditLogs,
  registerMutation,
  useIntegrationBaseline,
} = require("../../../support/integration");

const READY_FIXTURE = "FT_ANIMAL_QUARANTINE_CLEARED";
const BLOCKED_FIXTURE = "FT_ANIMAL_QUARANTINE_ASSESSED";

describe("IT-006 — Quarantine-to-Public Readiness", () => {
  const context = useIntegrationBaseline({
    verifyRestored({ tokens }) {
      return apiRequest({ path: `animals/${READY_FIXTURE}`, token: tokens.Admin })
        .then((response) => {
          expect(response.body?.animal).to.include({ status: "Quarantine" });
          return apiRequest({ path: `animals/${BLOCKED_FIXTURE}`, token: tokens.Admin });
        })
        .then((response) => {
          expect(response.body?.animal).to.include({
            status: "Quarantine",
            quarantineClearance: "Pending",
          });
          return apiRequest({ path: `public/pets/${READY_FIXTURE}` });
        })
        .its("status")
        .should("eq", 404);
    },
  });

  it("publishes only the quarantine animal satisfying clearance and assessment prerequisites", () => {
    let readyResponse;
    let blockedResponse;
    let readyAnimal;
    let blockedAnimal;
    let publicReadyResponse;
    let publicBlockedResponse;
    let readinessAudits;
    let blockedAudits;

    apiRequest({
      method: "PATCH",
      path: `animals/${READY_FIXTURE}/mark-ready`,
      token: context.tokens.Admin,
    }).then((response) => {
      readyResponse = response;
      if (response.status === 200) {
        return registerMutation({ kind: "animalReadiness", primaryId: READY_FIXTURE });
      }
      return undefined;
    });

    apiRequest({
      method: "PATCH",
      path: `animals/${BLOCKED_FIXTURE}/mark-ready`,
      token: context.tokens.Admin,
    }).then((response) => {
      blockedResponse = response;
      if (response.status === 200) {
        return registerMutation({ kind: "animalReadiness", primaryId: BLOCKED_FIXTURE });
      }
      return undefined;
    });

    apiRequest({ path: `animals/${READY_FIXTURE}`, token: context.tokens.Admin }).then(
      (response) => {
        readyAnimal = response.body?.animal;
      },
    );
    apiRequest({ path: `animals/${BLOCKED_FIXTURE}`, token: context.tokens.Admin }).then(
      (response) => {
        blockedAnimal = response.body?.animal;
      },
    );
    apiRequest({ path: `public/pets/${READY_FIXTURE}` }).then((response) => {
      publicReadyResponse = response;
    });
    apiRequest({ path: `public/pets/${BLOCKED_FIXTURE}` }).then((response) => {
      publicBlockedResponse = response;
    });
    getAuditLogs(context.tokens.Admin).then((logs) => {
      readinessAudits = logs.filter(
        (log) => log.rawAction === "animal.marked_ready" && log.record === READY_FIXTURE,
      );
      blockedAudits = logs.filter(
        (log) => log.rawAction === "animal.marked_ready" && log.record === BLOCKED_FIXTURE,
      );
    });

    cy.then(() => {
      expect(readyResponse?.status).to.equal(200);
      expect(readyResponse?.body).to.include({ status: "Ready" });
      expect(readyAnimal).to.include({
        id: READY_FIXTURE,
        status: "Ready",
        currentStage: "adoption",
        quarantineStatus: "Completed",
        quarantineClearance: "Cleared",
        visibleToPublic: true,
      });
      expect(
        readyAnimal.history.filter((entry) => entry.event === "Marked ready for adoption"),
      ).to.have.length(1);
      expect(publicReadyResponse?.status).to.equal(200);
      expect(publicReadyResponse?.body?.pet).to.include({
        id: READY_FIXTURE,
        status: "Ready",
      });
      expect(readinessAudits).to.have.length(1);

      expect(blockedResponse?.status).to.equal(400);
      expect(blockedResponse?.body?.message).to.equal(
        "Animal must have cleared quarantine clearance before being marked ready.",
      );
      expect(blockedAnimal).to.include({
        id: BLOCKED_FIXTURE,
        status: "Quarantine",
        quarantineClearance: "Pending",
      });
      expect(publicBlockedResponse?.status).to.equal(404);
      expect(publicBlockedResponse?.body).not.to.have.property("pet");
      expect(blockedAudits).to.have.length(0);
    });
  });
});
