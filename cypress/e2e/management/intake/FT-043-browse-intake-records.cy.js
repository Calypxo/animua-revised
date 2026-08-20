describe("FT-043 - Browse Intake Records", () => {
  it("shows seeded intake states and opens record details", () => {
    cy.loginAdmin();
    cy.intercept(
      { method: "GET", url: "**/api/intake", middleware: true },
      (request) => {
        delete request.headers["if-none-match"];
        delete request.headers["if-modified-since"];
      },
    ).as("intake");

    cy.visitManagementPage("/pages/intakeList.html");
    cy.wait("@intake", { timeout: 30000 }).then(({ response }) => {
      expect(response?.statusCode).to.equal(200);
      const records = response?.body?.records || [];
      [
        ["FT_INTAKE_RESCUE_DRAFT", "Draft"],
        ["FT_INTAKE_BARANGAY_DRAFT", "Draft"],
        ["FT_INTAKE_PENDING", "Pending"],
        ["FT_INTAKE_APPROVE_CANDIDATE", "Pending"],
        ["FT_INTAKE_REJECT_CANDIDATE", "Pending"],
        ["FT_INTAKE_APPROVED", "Approved"],
        ["FT_INTAKE_CONVERT_CANDIDATE", "Approved"],
        ["FT_INTAKE_CONVERTED", "Converted"],
      ].forEach(([id, status]) => {
        expect(records.find((record) => record.id === id)).to.include({ id, status });
      });
    });
    cy.get("#searchIntake").type("FT_INTAKE_PENDING");
    cy.get('tr[data-id="FT_INTAKE_PENDING"]').should("be.visible").click();
    cy.get("#viewModalBackdrop").should("have.class", "open");
    cy.get("#viewModalSubtitle").should("contain.text", "FT_INTAKE_PENDING");
    cy.get("#viewModalBody")
      .should("contain.text", "Animal Information")
      .and("contain.text", "Intake Details")
      .and("contain.text", "Pending");
  });
});
