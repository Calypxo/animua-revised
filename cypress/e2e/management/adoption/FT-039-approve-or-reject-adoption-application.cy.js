const { resetAndVerifyBaseline } = require("../../../support/integration");

describe("FT-039 - Approve or Reject Adoption Application", () => {
  after(() => resetAndVerifyBaseline());

  it("approves and rejects the controlled candidates through management UI", () => {
    cy.intercept("GET", "**/api/protected").as("managementSession");
    cy.loginAdmin();
    cy.wait("@managementSession", { timeout: 30000 })
      .its("response.statusCode")
      .should("eq", 200);
    cy.intercept(
      { method: "GET", url: "**/api/adoptions", middleware: true },
      (request) => {
        delete request.headers["if-none-match"];
        delete request.headers["if-modified-since"];
      },
    ).as("adoptions");
    cy.intercept(
      "PATCH",
      "**/api/adoptions/FT_ADOPTION_APPROVE_CANDIDATE/approve",
    ).as("approveAdoption");
    cy.intercept(
      "PATCH",
      "**/api/adoptions/FT_ADOPTION_REJECT_CANDIDATE/reject",
    ).as("rejectAdoption");

    cy.visitManagementPage(
      "/pages/adoptionApplications.html?id=FT_ADOPTION_APPROVE_CANDIDATE",
    );
    cy.wait("@adoptions", { timeout: 30000 }).then(({ response }) => {
      const candidate = response?.body?.adoptions?.find(
        ({ id }) => id === "FT_ADOPTION_APPROVE_CANDIDATE",
      );
      expect(candidate?.status).to.equal("Pending");
    });
    cy.get("#drawerApproveBtn").should("be.visible").and("be.enabled").click();
    cy.wait("@approveAdoption", { timeout: 30000 })
      .its("response.statusCode")
      .should("eq", 200);
    cy.wait("@adoptions", { timeout: 30000 }).then(({ response }) => {
      const candidate = response?.body?.adoptions?.find(
        ({ id }) => id === "FT_ADOPTION_APPROVE_CANDIDATE",
      );
      expect(candidate).to.include({
        status: "Approved",
        deadlineStatus: "Awaiting Appointment",
      });
    });
    cy.task("registerFtGeneratedRecords", {
      kind: "adoptionDecision",
      primaryId: "FT_ADOPTION_APPROVE_CANDIDATE",
    }).then(({ registeredPaths }) => {
      expect(registeredPaths.filter((path) => path.startsWith("auditLogs/"))).to.have.length(1);
      expect(registeredPaths.filter((path) => path.startsWith("notifications/"))).to.have.length(1);
    });

    cy.visitManagementPage(
      "/pages/adoptionApplications.html?id=FT_ADOPTION_REJECT_CANDIDATE",
    );
    cy.wait("@adoptions", { timeout: 30000 }).then(({ response }) => {
      const candidate = response?.body?.adoptions?.find(
        ({ id }) => id === "FT_ADOPTION_REJECT_CANDIDATE",
      );
      expect(candidate?.status).to.equal("Pending");
    });
    cy.get("#drawerRejectBtn").should("be.visible").and("be.enabled").click();
    cy.get("#rejectReason").type(
      "FT-039 rejected after deterministic adoption review.",
    );
    cy.get("#rejectConfirmBtn").click();
    cy.wait("@rejectAdoption", { timeout: 30000 }).then(({ request, response }) => {
      expect(request.body.reason).to.contain("FT-039 rejected");
      expect(response?.statusCode).to.equal(200);
    });
    cy.wait("@adoptions", { timeout: 30000 }).then(({ response }) => {
      const candidate = response?.body?.adoptions?.find(
        ({ id }) => id === "FT_ADOPTION_REJECT_CANDIDATE",
      );
      expect(candidate).to.include({
        status: "Rejected",
        rejectedReason: "FT-039 rejected after deterministic adoption review.",
      });
    });
    cy.task("registerFtGeneratedRecords", {
      kind: "adoptionDecision",
      primaryId: "FT_ADOPTION_REJECT_CANDIDATE",
    }).then(({ registeredPaths }) => {
      expect(registeredPaths.filter((path) => path.startsWith("auditLogs/"))).to.have.length(1);
      expect(registeredPaths.filter((path) => path.startsWith("notifications/"))).to.have.length(1);
    });
  });
});
