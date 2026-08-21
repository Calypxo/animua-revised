const path = require("path");
const {
  loginAndOpenReports,
  resetAndVerifyBaseline,
} = require("../../../support/batch10-functionality");

describe("FT-075 - Export and Print Management Report", () => {
  after(() => resetAndVerifyBaseline());

  it("downloads the implemented Excel report and invokes the browser print action", () => {
    loginAndOpenReports();
    cy.get('[data-period="all"]').click();
    cy.wait("@reportListAdmin", { timeout: 30000 }).its("response.statusCode").should("eq", 200);
    cy.get('[data-report="intake"]').click();
    cy.get("#reportBody").should("contain.text", "FT_INTAKE_PENDING");
    cy.window().then((window) => cy.stub(window, "print").as("printReport"));
    cy.get("#btnPrint").click();
    cy.get("@printReport").should("have.been.calledOnce");
    cy.get("#reportBody .is-error").should("not.exist");

    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const fileName = `animua-intake-report-${local}.xlsx`;
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
