const { resetAndVerifyBaseline } = require("../../../support/integration");

describe("FT-040 - View Adoption Pickup Reschedule History", () => {
  after(() => resetAndVerifyBaseline());

  it("automatically applies a legacy pending reschedule and shows its usage to admin", () => {
    cy.loginAdmin();
    cy.intercept(
      { method: "GET", url: "**/api/adoptions", middleware: true },
      (request) => {
        delete request.headers["if-none-match"];
        delete request.headers["if-modified-since"];
      },
    ).as("adoptions");
    cy.visitManagementPage(
      "/pages/adoptionApplications.html?id=FT_ADOPTION_RESCHEDULE_PENDING",
    );
    cy.wait("@adoptions", { timeout: 30000 }).then(({ response }) => {
      const application = response?.body?.adoptions?.find(
        ({ id }) => id === "FT_ADOPTION_RESCHEDULE_PENDING",
      );
      expect(application?.deadlineStatus).to.equal("Appointment Scheduled");
      expect(application?.pickupRescheduleRequest).to.equal(null);
      expect(application?.pickupSchedule?.rescheduleCount).to.equal(1);
      expect(application?.pickupSchedule?.rescheduleHistory).to.have.length(1);
    });
    cy.get("#aaDrawerInner")
      .should("contain.text", "Appointment Scheduled")
      .and("contain.text", "Reschedules Used")
      .and("contain.text", "1 of 2")
      .and("contain.text", "User rescheduled this pickup 1 of 2 times")
      .and("not.contain.text", "Pickup reschedule awaiting review");
    cy.get("#drawerApproveRescheduleBtn").should("not.exist");
  });
});
