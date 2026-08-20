const { resetAndVerifyBaseline } = require("../../../support/integration");

describe("FT-040 - Review Adoption Pickup Reschedule", () => {
  after(() => resetAndVerifyBaseline());

  it("approves the controlled pending pickup reschedule", () => {
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
      "**/api/adoptions/FT_ADOPTION_RESCHEDULE_PENDING/reschedule/approve",
    ).as("approveReschedule");

    cy.visitManagementPage(
      "/pages/adoptionApplications.html?id=FT_ADOPTION_RESCHEDULE_PENDING",
    );
    cy.wait("@adoptions", { timeout: 30000 }).then(({ response }) => {
      const application = response?.body?.adoptions?.find(
        ({ id }) => id === "FT_ADOPTION_RESCHEDULE_PENDING",
      );
      expect(application?.deadlineStatus).to.equal("Reschedule Pending");
      expect(application?.pickupRescheduleRequest?.status).to.equal("Pending");
    });
    cy.get("#aaDrawerInner")
      .should("contain.text", "Pickup reschedule awaiting review")
      .and("contain.text", "Reschedule Pending");
    cy.get("#drawerApproveRescheduleBtn").click();
    cy.get(".swal2-title").should("have.text", "Approve pickup schedule");
    cy.get(".swal2-confirm").click();
    cy.wait("@approveReschedule", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.pickupSchedule?.rescheduledAt).to.be.a("string").and.not.be.empty;
    });
    cy.wait("@adoptions", { timeout: 30000 }).then(({ response }) => {
      const application = response?.body?.adoptions?.find(
        ({ id }) => id === "FT_ADOPTION_RESCHEDULE_PENDING",
      );
      expect(application?.deadlineStatus).to.equal("Appointment Scheduled");
      expect(application?.pickupRescheduleRequest?.status).to.equal("Approved");
      expect(application?.pickupSchedule?.date).to.equal(
        application?.pickupRescheduleRequest?.date,
      );
    });
    cy.get("#aaDrawerInner")
      .should("contain.text", "Appointment Scheduled")
      .and("not.contain.text", "Pickup reschedule awaiting review");
  });
});
