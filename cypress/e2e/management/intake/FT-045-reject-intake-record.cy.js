const { resetAndVerifyBaseline } = require("../../../support/integration");

describe("FT-045 - Reject Intake Record", () => {
  after(() => resetAndVerifyBaseline());

  it("rejects the controlled pending intake with the recorded reason", () => {
    cy.intercept("GET", "**/api/protected").as("managementSession");
    cy.loginAdmin();
    cy.wait("@managementSession", { timeout: 30000 })
      .its("response.statusCode")
      .should("eq", 200);
    cy.intercept(
      { method: "GET", url: "**/api/intake", middleware: true },
      (request) => {
        delete request.headers["if-none-match"];
        delete request.headers["if-modified-since"];
      },
    ).as("intake");
    cy.intercept(
      "PATCH",
      "**/api/intake/FT_INTAKE_REJECT_CANDIDATE/reject",
    ).as("rejectIntake");

    cy.visitManagementPage("/pages/intakeList.html");
    cy.wait("@intake", { timeout: 30000 }).then(({ response }) => {
      const candidate = response?.body?.records?.find(
        ({ id }) => id === "FT_INTAKE_REJECT_CANDIDATE",
      );
      expect(candidate?.status).to.equal("Pending");
    });
    cy.get("#searchIntake").type("FT_INTAKE_REJECT_CANDIDATE");
    cy.get('tr[data-id="FT_INTAKE_REJECT_CANDIDATE"]').click();
    cy.get("#vBtnReject").should("be.visible").and("be.enabled").click();
    cy.get("#rejectReason").type(
      "FT-045 rejected after deterministic intake review.",
    );
    cy.get("#confirmAction").click();
    cy.wait("@rejectIntake", { timeout: 30000 }).then(({ request, response }) => {
      expect(request.body.reason).to.contain("FT-045 rejected");
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.status).to.equal("Rejected");
    });
    cy.wait("@intake", { timeout: 30000 }).then(({ response }) => {
      const candidate = response?.body?.records?.find(
        ({ id }) => id === "FT_INTAKE_REJECT_CANDIDATE",
      );
      expect(candidate).to.include({
        status: "Rejected",
        rejectedReason: "FT-045 rejected after deterministic intake review.",
      });
    });
    cy.task("registerFtGeneratedRecords", {
      kind: "intakeRejection",
      primaryId: "FT_INTAKE_REJECT_CANDIDATE",
    }).then(({ registeredPaths }) => {
      expect(registeredPaths.filter((path) => path.startsWith("auditLogs/"))).to.have.length(1);
      expect(registeredPaths.some((path) => path.startsWith("notifications/"))).to.equal(false);
    });
  });
});
