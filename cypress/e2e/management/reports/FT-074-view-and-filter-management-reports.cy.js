const {
  loginAndOpenReports,
  resetAndVerifyBaseline,
} = require("../../../support/batch10-functionality");

describe("FT-074 - View and Filter Management Reports", () => {
  after(() => resetAndVerifyBaseline());

  it("loads a controlled intake report and restores it after filtering", () => {
    loginAndOpenReports("Staff");
    cy.get("#liveReportTabs [data-report]").should("have.length.greaterThan", 0);
    cy.get('[data-period="all"]').click();
    cy.wait("@reportListStaff", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
    cy.get('[data-report="intake"]').click();
    cy.get("#reportTitle").should("have.text", "Animal Intake report");
    cy.get("#reportBody").should("contain.text", "FT_INTAKE_PENDING");
    cy.get("#tableRecordCount").invoke("text").then((text) => {
      const originalCount = Number(text.match(/\d+/)?.[0] || 0);
      expect(originalCount).to.be.greaterThan(1);
      cy.wrap(originalCount).as("originalReportCount");
    });

    cy.get("#reportSearch").type("FT_INTAKE_PENDING");
    cy.get("#reportBody tr").should("have.length", 1)
      .and("contain.text", "FT_INTAKE_PENDING")
      .and("contain.text", "Pending");
    cy.get("#tableRecordCount").should("have.text", "1 row");

    cy.get("#btnClear").click();
    cy.wait("@reportListStaff", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
    cy.get("#reportSearch").should("have.value", "");
    cy.get("#dateFrom").should("have.value", "");
    cy.get("#dateTo").should("have.value", "");
    cy.get("@originalReportCount").then((count) => {
      cy.get("#tableRecordCount").should("have.text", `${count} rows`);
    });
    cy.get("#reportBody").should("contain.text", "FT_INTAKE_PENDING");
  });
});
