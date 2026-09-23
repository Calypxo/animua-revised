const path = require("path");

// Isolated API fixtures: no login credentials or database writes are needed.
const intake = Array.from({ length: 28 }, (_, index) => ({
  id: `EXPORT-QA-${String(index).padStart(3, "0")}`,
  date: "2026-09-15", animal: "Brown dog", species: "Dog", source: "Rescue", status: "Pending",
  conversion: "Converted", barangay: index === 27 ? "Pandan" : "Balibago", location: "Near the barangay hall",
}));
const payload = {
  available: ["intake", "status"], generatedAt: "2026-09-23T06:30:00Z",
  reports: { intake, status: [{ date: "2026-09-15", id: "STATUS-QA-001", animal: "White cat", species: "Cat", status: "Ready", clearance: "Approved", assessment: "Complete", barangay: "Balibago" }] },
};

function openReports() {
  cy.intercept("**/api/**", { body: { notifications: [], items: [], unreadCount: 0 } });
  cy.intercept("GET", "**/api/protected", { body: { user: { id: "export-qa", role: "Admin", fullName: "Export QA Administrator" } } });
  cy.intercept("GET", "**/api/reports*", { body: payload }).as("reportData");
  cy.visit(`${Cypress.env("managementBaseUrl")}/pages/reports.html`, {
    onBeforeLoad(win) { cy.stub(win, "print").as("browserPrint"); },
  });
  cy.wait("@reportData");
  cy.get("#btnPrint").should("contain.text", "Export PDF").and("not.be.disabled");
  cy.get("#dateFrom").invoke("val", "2026-09-01").trigger("change");
  cy.get("#dateTo").invoke("val", "2026-09-30").trigger("change");
  cy.get("#btnApply").click();
  cy.wait("@reportData");
}

function excelDownload(title = "Animal_Intake") {
  const fileName = `ANIMUA_${title}_Report_2026-09-01_to_2026-09-30.xlsx`;
  cy.get("#btnExcel").should("not.be.disabled").click();
  cy.readFile(path.join(Cypress.config("downloadsFolder"), fileName), null, { timeout: 30000 });
  return cy.task("inspectFtReportDownload", { fileName });
}

describe("Report export regression with isolated data", () => {
  it("exports every filtered row across pagination and downloads a PDF without printing the UI", () => {
    openReports();
    cy.get("#barangayFilter").select("Balibago");
    cy.get("#reportSearch").type("Brown");
    cy.get("#reportPagination [aria-label='Page 2']").click();
    cy.get("#reportBody").should("not.contain.text", "EXPORT-QA-000");
    excelDownload().then(({ content }) => {
      expect(content).to.include("EXPORT-QA-000").and.include("EXPORT-QA-026");
      expect(content).not.to.include("EXPORT-QA-027");
      expect(content).to.include("Barangay: Balibago; Search: Brown");
      expect(content).to.include("Export QA Administrator");
    });
    cy.get("#btnPrint").should("not.be.disabled").click();
    cy.get("#btnExcel").should("be.disabled");
    cy.readFile(path.join(Cypress.config("downloadsFolder"), "ANIMUA_Animal_Intake_Report_2026-09-01_to_2026-09-30.pdf"), null, { timeout: 30000 })
      .then((buffer) => expect(buffer.subarray(0, 5).toString()).to.eq("%PDF-"));
    cy.get("#btnPrint").should("not.be.disabled");
    cy.get("@browserPrint").should("not.have.been.called");
    cy.get("#reportTableFooter").should("contain.text", "Showing 13");
  });

  it("exports a different report and an empty filtered result", () => {
    openReports();
    cy.get('[data-report="status"]').click();
    cy.get("#reportSearch").type("does-not-match");
    cy.get("#reportBody").should("contain.text", "No matching report records");
    excelDownload("Animal_Status").then(({ content }) => {
      expect(content).to.include("No records match the selected filters.");
      expect(content).not.to.include("STATUS-QA-001");
      expect(content).to.include("Adoption ready");
    });
  });

  it("prevents exports for pending or failed date filters and recovers after reapplying", () => {
    openReports();
    cy.get("#dateFrom").invoke("val", "2026-09-02").trigger("change");
    cy.get("#btnExcel").should("be.disabled");
    cy.get("#btnPrint").should("be.disabled");
    cy.intercept("GET", "**/api/reports*", { statusCode: 500, body: { message: "QA load failure" } }).as("failedReports");
    cy.get("#btnApply").click();
    cy.wait("@failedReports");
    cy.get("#reportBody").should("contain.text", "Unable to load this report");
    cy.get("#btnExcel").should("be.disabled");
    cy.intercept("GET", "**/api/reports*", { body: payload }).as("recoveredReports");
    cy.get("#btnApply").click();
    cy.wait("@recoveredReports");
    cy.get("#btnExcel").should("not.be.disabled");
  });

  it("shows a friendly export error and restores the buttons without clearing records", () => {
    openReports();
    cy.window().then((win) => cy.stub(win.URL, "createObjectURL").throws(new Error("QA download failure")).as("failedDownload"));
    cy.get("#btnExcel").click();
    cy.get(".swal2-title", { timeout: 30000 }).should("contain.text", "Excel export failed");
    cy.get(".swal2-confirm").click();
    cy.get("#btnExcel").should("not.be.disabled");
    cy.get("#reportBody").should("contain.text", "EXPORT-QA-000");
    cy.get("@failedDownload").should("have.been.calledOnce");
  });
});
