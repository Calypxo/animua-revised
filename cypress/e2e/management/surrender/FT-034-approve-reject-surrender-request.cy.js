describe("FT-034 — Approve or Reject Surrender Request", () => {
  it("approves and rejects separate seeded candidates through the real workflow", () => {
    cy.loginAdmin();
    cy.intercept(
      { method: "GET", url: "**/api/surrenders", middleware: true },
      (request) => {
        delete request.headers["if-none-match"];
        delete request.headers["if-modified-since"];
      },
    ).as("surrenders");
    cy.intercept("PATCH", "**/api/surrenders/*/status").as("statusUpdate");

    cy.visitManagementPage("/pages/surrenders.html?id=FT_SURRENDER_APPROVE_CANDIDATE");
    cy.wait("@surrenders", { timeout: 30000 }).then(({ response }) => {
      const candidate = response?.body?.requests?.find(
        ({ id }) => id === "FT_SURRENDER_APPROVE_CANDIDATE",
      );
      expect(response?.statusCode).to.equal(200);
      expect(candidate?.status).to.equal("Pending");
    });
    cy.get("#srDrawer")
      .should("have.attr", "aria-hidden", "false");
    cy.get("#srDrawerInner")
      .should("contain.text", "FT_SURRENDER_APPROVE_CANDIDATE")
      .and("contain.text", "Pending");
    cy.get("#drawerApproveBtn").should("be.visible").and("be.enabled").click();
    cy.get("#approveNotes").type("FT-034 approved after deterministic management review.");
    cy.get("#approveConfirmBtn").click();
    cy.wait("@statusUpdate", { timeout: 30000 }).then(({ request, response }) => {
      expect(request.body.status).to.equal("Approved");
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.request?.status).to.equal("Approved");
    });
    cy.wait("@surrenders", { timeout: 30000 }).then(({ response }) => {
      const candidate = response?.body?.requests?.find(
        ({ id }) => id === "FT_SURRENDER_APPROVE_CANDIDATE",
      );
      expect(response?.statusCode).to.equal(200);
      expect(candidate?.status).to.equal("Approved");
    });
    cy.task("registerFtGeneratedRecords", {
      kind: "surrenderDecision",
      primaryId: "FT_SURRENDER_APPROVE_CANDIDATE",
    });
    cy.get("#srDrawerInner").should("contain.text", "Approved");

    cy.visitManagementPage("/pages/surrenders.html?id=FT_SURRENDER_REJECT_CANDIDATE");
    cy.wait("@surrenders", { timeout: 30000 }).then(({ response }) => {
      const candidate = response?.body?.requests?.find(
        ({ id }) => id === "FT_SURRENDER_REJECT_CANDIDATE",
      );
      expect(response?.statusCode).to.equal(200);
      expect(candidate?.status).to.equal("Pending");
    });
    cy.get("#srDrawer")
      .should("have.attr", "aria-hidden", "false");
    cy.get("#srDrawerInner")
      .should("contain.text", "FT_SURRENDER_REJECT_CANDIDATE")
      .and("contain.text", "Pending");
    cy.get("#drawerRejectBtn").should("be.visible").and("be.enabled").click();
    cy.get("#rejectReason").type("FT-034 rejection reason recorded through management review.");
    cy.get("#rejectConfirmBtn").click();
    cy.wait("@statusUpdate", { timeout: 30000 }).then(({ request, response }) => {
      expect(request.body.status).to.equal("Rejected");
      expect(request.body.rejectedReason).to.contain("FT-034 rejection reason");
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.request?.status).to.equal("Rejected");
    });
    cy.task("registerFtGeneratedRecords", {
      kind: "surrenderDecision",
      primaryId: "FT_SURRENDER_REJECT_CANDIDATE",
    });
    cy.get("#srDrawerInner")
      .should("contain.text", "Rejected")
      .and("contain.text", "FT-034 rejection reason");
  });
});
