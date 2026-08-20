const { resetAndVerifyBaseline } = require("../../../support/integration");

describe("FT-041 - Manage Adoption Attendance Deadline", () => {
  after(() => resetAndVerifyBaseline());

  it("marks the controlled scheduled adoption as a no-show", () => {
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
      "**/api/adoptions/FT_ADOPTION_SCHEDULED/no-show",
    ).as("markNoShow");

    cy.visitManagementPage(
      "/pages/adoptionApplications.html?id=FT_ADOPTION_SCHEDULED",
    );
    cy.wait("@adoptions", { timeout: 30000 }).then(({ response }) => {
      const application = response?.body?.adoptions?.find(
        ({ id }) => id === "FT_ADOPTION_SCHEDULED",
      );
      expect(application).to.include({
        status: "Approved",
        deadlineStatus: "Appointment Scheduled",
        arrivalConfirmedAt: null,
      });
    });
    cy.get("#aaDrawerInner")
      .should("contain.text", "Attendance Deadline")
      .and("contain.text", "Not confirmed");
    cy.get("#drawerNoShowBtn").should("be.visible").and("be.enabled").click();
    cy.get(".swal2-title").should("have.text", "Mark as no-show");
    cy.get(".swal2-textarea")
      .clear()
      .type("FT-041 adopter missed the scheduled pickup appointment.");
    cy.get(".swal2-confirm").click();
    cy.wait("@markNoShow", { timeout: 30000 }).then(({ request, response }) => {
      expect(request.body.reason).to.contain("FT-041 adopter missed");
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.request).to.include({
        status: "Expired",
        deadlineStatus: "Expired — No Show",
        noShowRisk: true,
      });
    });
    cy.wait("@adoptions", { timeout: 30000 }).then(({ response }) => {
      const application = response?.body?.adoptions?.find(
        ({ id }) => id === "FT_ADOPTION_SCHEDULED",
      );
      expect(application).to.include({
        status: "Expired",
        deadlineStatus: "Expired — No Show",
        noShowRisk: true,
      });
    });
    cy.get("#aaDrawerInner")
      .should("contain.text", "Expired")
      .and("contain.text", "FT-041 adopter missed");
  });
});
