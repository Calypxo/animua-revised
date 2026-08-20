describe("FT-020 — Schedule and Reschedule Surrender Appointment", () => {
  it("schedules the seeded approved surrender and submits its reschedule request within the attendance deadline", () => {
    cy.loginClient();
    cy.intercept("GET", "**/api/adoptions/my-applications").as("myAdoptions");
    cy.intercept("GET", "**/api/surrenders/my-requests").as("mySurrenders");
    cy.intercept(
      "PATCH",
      "**/api/surrenders/my-requests/FT_SURRENDER_APPROVED/appointment",
    ).as("saveSurrenderAppointment");

    cy.visitPublicPage("/pages/public/my-submissions.html");
    cy.wait("@myAdoptions", { timeout: 30000 });
    cy.wait("@mySurrenders", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      const surrender = (response?.body?.requests || []).find(
        (item) => item.id === "FT_SURRENDER_APPROVED",
      );
      expect(surrender, "approved baseline surrender").to.exist;
      expect(surrender.status).to.equal("Approved");
      expect(surrender.surrenderAppointment).not.to.exist;
      expect(surrender.attendanceDeadlineAt).to.exist;
    });

    cy.get('.submission-details-btn[data-submission-id="FT_SURRENDER_APPROVED"]')
      .should("be.visible")
      .click();
    cy.get(".surrender-detail-modal")
      .should("contain.text", "14-day attendance deadline")
      .and("contain.text", "Not scheduled yet");
    cy.contains('[data-schedule-kind="surrender"]', "Schedule Appointment").click();
    cy.get(".schedule-picker").should("be.visible");
    cy.get(".schedule-day:not([disabled])").first().click();
    cy.get('[data-time-value="13:30"]').click();
    cy.get(".schedule-picker-save").click();

    cy.wait("@saveSurrenderAppointment", { timeout: 30000 }).then(({ request, response }) => {
      expect(request.body.date).to.match(/^\d{4}-\d{2}-\d{2}$/);
      expect(request.body.time).to.equal("13:30");
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.message).to.equal("Surrender appointment saved.");
      expect(response?.body?.surrenderAppointment).to.include({
        date: request.body.date,
        time: "13:30",
      });
      cy.task("registerFtGeneratedRecords", { kind: "surrenderAppointment" })
        .its("registeredPaths")
        .should("not.be.empty");
    });
    cy.get(".surrender-detail-modal")
      .should("contain.text", "Appointment Scheduled")
      .and("contain.text", "1:30 PM")
      .and("contain.text", "14-day attendance deadline");
    cy.contains('[data-schedule-kind="surrender"]', "Request Re-sched").click();
    cy.get(".schedule-picker").should("be.visible");
    cy.get(".schedule-day:not([disabled])").last().click();
    cy.get('[data-time-value="14:30"]').click();
    cy.get(".schedule-picker-save").click();

    cy.wait("@saveSurrenderAppointment", { timeout: 30000 }).then(({ request, response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.message).to.equal(
        "Surrender appointment reschedule request sent for staff approval.",
      );
      expect(response?.body?.requiresApproval).to.equal(true);
      expect(response?.body?.surrenderRescheduleRequest).to.include({
        date: request.body.date,
        time: "14:30",
        status: "Pending",
      });
      cy.task("registerFtGeneratedRecords", { kind: "surrenderAppointment" })
        .its("registeredPaths")
        .should("have.length.at.least", 2);
    });
    cy.get(".surrender-detail-modal")
      .should("contain.text", "Appointment reschedule request pending admin approval.")
      .and("contain.text", "2:30 PM")
      .and("contain.text", "Attendance Reminder");
  });
});
