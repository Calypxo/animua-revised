describe("FT-016 — Schedule and Reschedule Adoption Pickup", () => {
  it("directly saves one reschedule and then disables the action", () => {
    cy.loginClient();
    cy.intercept("GET", "**/api/adoptions/my-applications").as("myAdoptions");
    cy.intercept("GET", "**/api/surrenders/my-requests").as("mySurrenders");
    cy.intercept(
      "PATCH",
      "**/api/adoptions/my-applications/FT_ADOPTION_APPROVED/pickup-schedule",
    ).as("savePickupSchedule");

    cy.visitPublicPage("/pages/public/my-submissions.html");
    cy.wait("@myAdoptions", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      const adoption = (response?.body?.adoptions || []).find(
        (item) => item.id === "FT_ADOPTION_APPROVED",
      );
      expect(adoption, "approved baseline adoption").to.exist;
      expect(adoption.status).to.equal("Approved");
      expect(adoption.pickupSchedule).to.equal(null);
    });
    cy.wait("@mySurrenders", { timeout: 30000 });

    cy.get('.submission-details-btn[data-submission-id="FT_ADOPTION_APPROVED"]')
      .should("be.visible")
      .click();
    cy.get(".application-detail-modal")
      .should("contain.text", "Congratulations, your application has been approved.")
      .and("contain.text", "Not scheduled yet");
    cy.contains('[data-schedule-kind="adoption"]', "Schedule Pickup").click();

    cy.get(".schedule-picker").should("be.visible");
    cy.get(".schedule-day:not([disabled])").first().click();
    cy.get('[data-time-value="09:00"]').click();
    cy.get(".schedule-picker-save").click();
    cy.wait("@savePickupSchedule", { timeout: 30000 }).then(({ request, response }) => {
      expect(request.body.date).to.match(/^\d{4}-\d{2}-\d{2}$/);
      expect(request.body.time).to.equal("09:00");
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.message).to.equal("Pickup schedule saved.");
      expect(response?.body?.pickupSchedule?.date).to.equal(request.body.date);
      expect(response?.body?.pickupSchedule?.time).to.equal("09:00");
      cy.task("registerFtGeneratedRecords", {
        kind: "adoptionPickup",
      }).its("registeredPaths").should("not.be.empty");
    });
    cy.get(".application-detail-modal")
      .should("contain.text", "Schedule Saved")
      .and("contain.text", "Appointment Scheduled")
      .and("contain.text", "9:00 AM")
      .and("contain.text", "Pickup Schedule");
    cy.get(".application-detail-modal")
      .should("contain.text", "One reschedule available");
    cy.contains('[data-schedule-kind="adoption"]', "Reschedule").click();

    cy.get(".schedule-picker").should("be.visible");
    cy.get(".schedule-day:not([disabled])").last().click();
    cy.get('[data-time-value="10:00"]').click();
    cy.get(".schedule-picker-save").click();
    cy.wait("@savePickupSchedule", { timeout: 30000 }).then(({ request, response }) => {
      expect(request.body.date).to.match(/^\d{4}-\d{2}-\d{2}$/);
      expect(request.body.time).to.equal("10:00");
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.message).to.equal(
        "Pickup rescheduled successfully. This is your final pickup schedule.",
      );
      expect(response?.body?.finalReschedule).to.equal(true);
      expect(response?.body?.reschedulesRemaining).to.equal(0);
      expect(response?.body?.pickupSchedule).to.include({
        date: request.body.date,
        time: "10:00",
        rescheduleCount: 1,
      });
      cy.task("registerFtGeneratedRecords", {
        kind: "adoptionPickup",
      }).its("registeredPaths").should("not.be.empty");
    });
    cy.get(".application-detail-modal")
      .should("contain.text", "Pickup Rescheduled")
      .and("contain.text", "used your one reschedule")
      .and("contain.text", "Reschedule limit reached")
      .and("contain.text", "10:00 AM");
    cy.get('[data-schedule-kind="adoption"]')
      .should("be.disabled")
      .and("have.class", "is-disabled");
  });
});
