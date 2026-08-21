const {
  apiRequest,
  resetAndVerifyBaseline,
} = require("../../../support/integration");

describe("FT-042 - Finalize Approved Adoption", () => {
  after(() => resetAndVerifyBaseline());

  it("rejects the blocked application and finalizes only the eligible adoption", () => {
    cy.loginAdmin();
    cy.intercept(
      { method: "GET", url: "**/api/adoptions", middleware: true },
      (request) => {
        delete request.headers["if-none-match"];
        delete request.headers["if-modified-since"];
      },
    ).as("adoptions");
    cy.intercept(
      "PATCH",
      "**/api/adoptions/FT_ADOPTION_FINALIZE_BLOCKED/finalize",
    ).as("blockedFinalize");
    cy.intercept(
      "PATCH",
      "**/api/adoptions/FT_ADOPTION_FINALIZE_ELIGIBLE/finalize",
    ).as("eligibleFinalize");

    cy.visitManagementPage(
      "/pages/adoptionApplications.html?id=FT_ADOPTION_FINALIZE_BLOCKED",
    );
    cy.wait("@adoptions", { timeout: 30000 });
    cy.get("#drawerFinalizeBtn").should("be.visible").click();
    cy.get("#fAdoptedName").type("FT Blocked Name");
    cy.get("#finalizeConfirmBtn").click();
    cy.wait("@blockedFinalize", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(400);
      expect(response?.body?.message).to.equal(
        "Shelter arrival must be confirmed before the adoption can be finalized.",
      );
    });
    cy.get("#toastMsg").should(
      "contain.text",
      "Shelter arrival must be confirmed",
    );

    cy.visitManagementPage(
      "/pages/adoptionApplications.html?id=FT_ADOPTION_FINALIZE_ELIGIBLE",
    );
    cy.wait("@adoptions", { timeout: 30000 });
    cy.get("#aaDrawerInner")
      .should("contain.text", "Arrival")
      .and("contain.text", "Confirmed");
    cy.get("#drawerFinalizeBtn").should("be.visible").and("be.enabled").click();
    cy.get("#fAdoptedName").type("FT Forty Two");
    cy.get("#finalizeConfirmBtn").click();
    cy.wait("@eligibleFinalize", { timeout: 30000 })
      .its("response.statusCode")
      .should("eq", 200);
    cy.wait("@adoptions", { timeout: 30000 }).then(({ response }) => {
      const eligible = response?.body?.adoptions?.find(
        ({ id }) => id === "FT_ADOPTION_FINALIZE_ELIGIBLE",
      );
      const blocked = response?.body?.adoptions?.find(
        ({ id }) => id === "FT_ADOPTION_FINALIZE_BLOCKED",
      );
      expect(eligible).to.include({
        status: "Finalized",
        adoptedName: "FT Forty Two",
        deadlineStatus: "Completed",
      });
      expect(eligible?.animal).to.include({
        id: "FT_ANIMAL_READY_FINALIZE",
        status: "Adopted",
      });
      expect(blocked?.status).to.equal("Approved");
    });
    cy.task("registerFtGeneratedRecords", {
      kind: "adoptionFinalization",
      primaryId: "FT_ADOPTION_FINALIZE_ELIGIBLE",
    }).then(({ registeredPaths }) => {
      expect(registeredPaths.filter((path) => path.startsWith("notifications/"))).to.have.length(1);
      expect(registeredPaths.filter((path) => path.startsWith("auditLogs/"))).to.have.length(2);
    });
    cy.getCookie("animua_session").then((cookie) =>
      apiRequest({
        path: "animals/FT_ANIMAL_READY_FINALIZE",
        token: cookie?.value,
      }),
    ).then((response) => {
      expect(response.status).to.equal(200);
      expect(response.body?.animal).to.include({
        id: "FT_ANIMAL_READY_FINALIZE",
        status: "Adopted",
        currentStage: "adopted",
        visibleToPublic: false,
        adoptionApplicationId: "FT_ADOPTION_FINALIZE_ELIGIBLE",
        adoptedName: "FT Forty Two",
      });
    });
  });
});
