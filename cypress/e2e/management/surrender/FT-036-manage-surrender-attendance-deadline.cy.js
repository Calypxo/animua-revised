describe("FT-036 — Manage Surrender Attendance Deadline", () => {
  it("records a seeded scheduled surrender as a no-show and exposes the expiry state", () => {
    cy.intercept("GET", "**/api/protected").as("managementSession");
    cy.loginAdmin();
    cy.wait("@managementSession", { timeout: 30000 })
      .its("response.statusCode")
      .should("eq", 200);
    cy.intercept(
      { method: "GET", url: "**/api/surrenders", middleware: true },
      (request) => {
        delete request.headers["if-none-match"];
        delete request.headers["if-modified-since"];
      },
    ).as("surrenders");
    cy.intercept("PATCH", "**/api/surrenders/FT_SURRENDER_SCHEDULED/no-show").as("markNoShow");
    cy.visitManagementPage("/pages/surrenders.html?id=FT_SURRENDER_SCHEDULED");
    cy.wait("@surrenders", { timeout: 30000 }).then(({ response }) => {
      const scheduled = response?.body?.requests?.find(
        ({ id }) => id === "FT_SURRENDER_SCHEDULED",
      );
      expect(response?.statusCode).to.equal(200);
      expect(scheduled?.status).to.equal("Approved");
      expect(scheduled?.deadlineStatus).to.equal("Appointment Scheduled");
      expect(scheduled?.arrivalConfirmedAt).to.equal(null);
    });
    cy.get("#srDrawer").should("have.attr", "aria-hidden", "false");
    cy.get("#srDrawerInner")
      .should("contain.text", "FT_SURRENDER_SCHEDULED")
      .should("contain.text", "Attendance Deadline")
      .and("contain.text", "Appointment Scheduled")
      .and("contain.text", "Not confirmed");
    cy.get("#drawerNoShowBtn").should("be.visible").and("be.enabled").click();
    cy.get("#workflowModalBackdrop").should("have.class", "open");
    cy.get("#workflowModalTitle").should("be.visible").and("have.text", "Mark as No Show");
    cy.get("#workflowReason").clear().type("FT-036 owner missed the scheduled shelter appointment.");
    cy.get("#workflowConfirmBtn").click();
    cy.wait("@markNoShow", { timeout: 30000 }).then(({ request, response }) => {
      expect(request.body.reason).to.contain("FT-036 owner missed");
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.request?.status).to.equal("Expired");
      expect(response?.body?.request?.deadlineStatus).to.equal("Expired — No Show");
      expect(response?.body?.request?.noShowRisk).to.equal(true);
    });
    cy.wait("@surrenders", { timeout: 30000 }).then(({ response }) => {
      const expired = response?.body?.requests?.find(
        ({ id }) => id === "FT_SURRENDER_SCHEDULED",
      );
      expect(response?.statusCode).to.equal(200);
      expect(expired?.status).to.equal("Expired");
      expect(expired?.deadlineStatus).to.equal("Expired — No Show");
      expect(expired?.noShowRisk).to.equal(true);
    });
    cy.get("#srDrawerInner")
      .should("contain.text", "Expired")
      .and("contain.text", "FT-036 owner missed the scheduled shelter appointment.");
  });
});
