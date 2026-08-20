describe("FT-035 — Review Surrender Reschedule Request", () => {
  it("approves the seeded pending drop-off reschedule request", () => {
    cy.loginAdmin();
    cy.intercept("PATCH", "**/api/surrenders/FT_SURRENDER_RESCHEDULE_PENDING/reschedule/approve").as("approveReschedule");
    cy.visitManagementPage("/pages/surrenders.html?id=FT_SURRENDER_RESCHEDULE_PENDING");
    cy.get("#srDrawerInner", { timeout: 30000 })
      .should("contain.text", "Drop-off reschedule awaiting review")
      .and("contain.text", "Reschedule Pending");
    cy.get("#drawerApproveRescheduleBtn").click();
    cy.get("#workflowModalTitle").should("have.text", "Approve New Drop-off Date");
    cy.get("#workflowConfirmBtn").click();
    cy.wait("@approveReschedule", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      expect(response?.body?.request?.surrenderRescheduleRequest?.status).to.equal("Approved");
      expect(response?.body?.request?.deadlineStatus).to.equal("Appointment Scheduled");
      expect(response?.body?.request?.surrenderAppointment?.date).to.equal(
        response?.body?.request?.surrenderRescheduleRequest?.date,
      );
    });
    cy.get("#srDrawerInner")
      .should("contain.text", "Appointment Scheduled")
      .and("not.contain.text", "Drop-off reschedule awaiting review");
  });
});
