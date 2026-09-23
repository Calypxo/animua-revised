const path = require("path");
const {
  loginAndOpenReports,
  resetAndVerifyBaseline,
} = require("../../../support/batch10-functionality");

describe("FT-075 - Export Excel and PDF Management Reports", () => {
  after(() => resetAndVerifyBaseline());

  it("downloads dedicated Excel and PDF reports without invoking browser print", () => {
    loginAndOpenReports();
    cy.get('[data-period="all"]').click();
    cy.wait("@reportListAdmin", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
    cy.get('[data-report="intake"]').click();
    cy.get("#reportBody").should("contain.text", "FT_INTAKE_PENDING");
    cy.window().then((window) => cy.stub(window, "print").as("printReport"));
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const baseName = `ANIMUA_Animal_Intake_Report_${local}`;
    cy.get("#btnPrint").click();
    cy.readFile(path.join(Cypress.config("downloadsFolder"), `${baseName}.pdf`), null, { timeout: 30000 })
      .then((buffer) => {
        expect(buffer.length).to.be.greaterThan(1000);
        expect(buffer.subarray(0, 5).toString()).to.equal("%PDF-");
      });
    cy.get("@printReport").should("not.have.been.called");
    cy.get("#reportBody .is-error").should("not.exist");
    const fileName = `${baseName}.xlsx`;
    cy.get("#btnExcel").should("not.be.disabled");
    cy.get("#btnExcel").click();
    cy.readFile(path.join(Cypress.config("downloadsFolder"), fileName), null, { timeout: 30000 })
      .then((buffer) => {
        expect(buffer.length).to.be.greaterThan(1000);
        expect(buffer[0]).to.equal(0x50);
        expect(buffer[1]).to.equal(0x4b);
      });
    cy.task("inspectFtReportDownload", { fileName }).then((result) => {
      expect(result).to.include({
        fileName,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      expect(result.size).to.be.greaterThan(1000);
      expect(result.entries).to.include("xl/workbook.xml");
      expect(result.content).to.include("Animal Intake");
      expect(result.content).to.include("FT_INTAKE_PENDING");
    });
  });
});
