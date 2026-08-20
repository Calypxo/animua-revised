describe("FT-037 — Start Intake from Approved Surrender", () => {
  it("creates a linked intake without advancing into profiling", () => {
    cy.loginAdmin();
    cy.intercept("POST", "**/api/intake").as("createIntake");
    cy.visitManagementPage("/pages/surrenders.html?id=FT_SURRENDER_INTAKE_ELIGIBLE");
    cy.get("#srDrawerInner", { timeout: 30000 })
      .should("contain.text", "Arrival")
      .and("contain.text", "Confirmed");
    cy.get("#drawerConvertBtn").click();

    cy.location("pathname", { timeout: 30000 }).should("eq", "/pages/intakeList.html");
    cy.visitManagementPage("/pages/intakeList.html?source=surrender");
    cy.get("#intakeModalTitle", { timeout: 30000 })
      .should("be.visible")
      .and("have.text", "New Intake from Approved Surrender");
    cy.get("#fSource").should("have.value", "Approved Surrender");
    cy.get("#fSurrenderRef").should("have.value", "FT_SURRENDER_INTAKE_ELIGIBLE");
    cy.get("#fLocation").type("Angeles City Veterinary Office");
    cy.get("#btnSubmitIntake").click();

    cy.wait("@createIntake", { timeout: 30000 }).then(({ request, response }) => {
      expect(request.body).to.include({
        source: "Approved Surrender",
        surrenderRefId: "FT_SURRENDER_INTAKE_ELIGIBLE",
        status: "Pending",
      });
      expect(response?.statusCode).to.equal(201);
      const intakeId = response?.body?.id;
      expect(intakeId).to.match(/^INT-\d{4}-\d{3,}$/);
      cy.task("registerFtGeneratedRecords", {
        kind: "intakeFromSurrender",
        primaryId: intakeId,
      }).then(() => {
        expect(response?.body?.surrenderConverted).to.equal(true);
        expect(response?.body?.status).to.equal("Pending");
        expect(response?.body?.animalProfileId).to.equal(null);
      });
    });
    cy.location("pathname").should("eq", "/pages/intakeList.html");
  });
});
