import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ExcelJS from "exceljs";
import { buildReportData, reportDate, reportFilename, formatReportingPeriod } from "../src/utils/reports/buildReportData.js";
import { REPORT_CONFIG, summaryCards, dimensionCounts } from "../src/utils/reports/reportConfig.js";
import { createReportWorkbook } from "../src/utils/reports/excelExporter.js";
import { createReportPdf, createReportPdfDefinition } from "../src/utils/reports/pdfExporter.js";

const generatedAt = "2026-09-23T06:30:00Z";
const logo = `data:image/png;base64,${(await readFile(new URL("../public/favicon.png", import.meta.url))).toString("base64")}`;
const outputDir = process.env.REPORT_QA_DIR;

// Synthetic fixtures only: these never enter the application or its database.
function fixture(index = 0) {
  return {
    date: "2026-09-15", adoptionDate: "2026-09-23", id: `QA-${String(index).padStart(4, "0")}`,
    animalId: `ANIMAL-${index}`, animal: "Brown and white dog with distinctive markings",
    source: "Rescue", species: "Dog", status: "Pending", conversion: "Converted",
    location: "Near the barangay hall, Balibago", barangay: "Balibago", condition: "Stable",
    officer: "Officer Test", clearance: "Approved", assessment: "Complete", applicant: "Applicant Test",
    contact: "09123456789", adoptedName: "Milo", type: "Treatment", veterinarian: "Dr. Test",
    diagnosis: "Minor skin irritation", treatment: "Daily care and observation", inventoryItem: "Medical supply",
    quantityUsed: 1.25, unit: "ml", remainingStock: 0, stockStatus: "Critical",
    owner: "Owner Test", category: "Housing", urgency: "High",
  };
}

function makeReport(reportType, records, options = {}) {
  return buildReportData({
    reportType, config: REPORT_CONFIG[reportType], records,
    summary: summaryCards(reportType, records), breakdown: dimensionCounts(reportType, records),
    dateFrom: "2026-09-01", dateTo: "2026-09-30", generatedAt, generatedBy: "QA Administrator",
    filters: [{ label: "Barangay", value: "Balibago" }, { label: "Search", value: "dog" }], ...options,
  });
}

async function save(name, data) {
  if (!outputDir) return;
  await mkdir(outputDir, { recursive: true });
  await writeFile(resolve(outputDir, name), data);
}

test("report snapshot preserves only supplied filtered records, without mutating source data", () => {
  const source = [fixture(1), fixture(2)];
  const report = makeReport("intake", source.slice(1));
  assert.equal(report.records.length, 1);
  assert.equal(report.records[0].id, "QA-0002");
  assert.equal(report.summary[0].value, 1);
  assert.deepEqual(report.breakdown, [{ label: "Pending", count: 1, share: 1 }]);
  assert.equal(report.summary.find(({ label }) => label === "Conversion rate").value, 1);
  source[1].animal = "Changed after export started";
  assert.equal(report.records[0].animal, fixture().animal);
  assert.equal(report.filters[1].value, "dog");
});

test("existing report-specific summary calculations are preserved", () => {
  const records = [fixture(), { ...fixture(1), status: "Ready", conversion: "Not converted", clearance: "Pending", stockStatus: "OK", quantityUsed: 2, urgency: "Low", barangay: "Pandan" }];
  const values = (type) => summaryCards(type, records).slice(0, 3).map(({ value }) => value);
  assert.deepEqual(values("intake"), [2, 1, "50%"]);
  assert.deepEqual(values("status"), [2, 1, 0]);
  assert.deepEqual(values("medical"), [2, 1, 2]);
  assert.deepEqual(values("inventory"), [2, 3.25, 1]);
  assert.deepEqual(values("surrender"), [2, 1, 1]);
  assert.deepEqual(values("barangay"), [2, 2, 1]);
  records[1].status = "Finalized";
  assert.deepEqual(values("adoption"), [2, 1, "50%"]);
});

test("date-only values and filenames support ranges, open periods and all records", () => {
  assert.equal(reportDate("2026-09-01").toISOString(), "2026-09-01T00:00:00.000Z");
  assert.equal(reportDate("2026-02-31"), null);
  assert.equal(reportDate("not a date"), null);
  const report = makeReport("adoption", []);
  assert.equal(reportFilename(report, "pdf"), "ANIMUA_Adoption_Report_2026-09-01_to_2026-09-30.pdf");
  assert.equal(reportFilename({ ...report, title: 'Bad:/\\*?"<>| Report' }, "xlsx"), "ANIMUA_Bad_Report_2026-09-01_to_2026-09-30.xlsx");
  assert.match(reportFilename({ ...report, dateFrom: "", dateTo: "" }, "pdf"), /2026-09-23\.pdf$/);
  assert.match(formatReportingPeriod("", "2026-09-30"), /^Through/);
  assert.match(formatReportingPeriod("2026-09-01", ""), /onward$/);
});

for (const type of Object.keys(REPORT_CONFIG)) {
  test(`${type}: real Excel round-trip preserves data types, styles, filters, frozen headers and all rows`, async () => {
    const records = Array.from({ length: 18 }, (_, index) => fixture(index));
    records[0].animal = "=HYPERLINK(\"https://example.invalid\")";
    const report = makeReport(type, records);
    const buffer = await createReportWorkbook(report).xlsx.writeBuffer();
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(buffer);
    assert.deepEqual(loaded.worksheets.map(({ name }) => name), ["Report Summary", "Detailed Records"]);
    const sheet = loaded.getWorksheet("Detailed Records");
    const header = sheet.views[0].ySplit;
    assert.equal(sheet.rowCount - header, 18);
    assert.equal(sheet.views[0].state, "frozen");
    assert.equal(sheet.autoFilter, `A${header}:${sheet.getColumn(report.columns.length).letter}${header + 18}`);
    assert.equal(sheet.getRow(header).getCell(1).fill.fgColor.argb, "780116");
    assert.equal(sheet.getCell("A1").isMerged, true);
    assert.equal(sheet.getRow(header + 1).getCell(1).value.toISOString(), "2026-09-15T00:00:00.000Z");
    report.columns.forEach(({ key, type: fieldType }, index) => {
      const cell = sheet.getRow(header + 1).getCell(index + 1);
      assert.equal(cell.alignment.wrapText, true);
      assert.ok(sheet.getColumn(index + 1).width >= 12);
      if (fieldType === "number") assert.equal(cell.value, records[0][key]);
      if (key === "contact") assert.equal(cell.value, "09123456789");
      if (key === "animal") { assert.equal(cell.type, ExcelJS.ValueType.String); assert.equal(cell.value, records[0].animal); }
    });
    assert.equal(loaded.getWorksheet("Report Summary").getCell("B12").value, 18);
    await save(`${type}.xlsx`, buffer);
  });

  test(`${type}: empty Excel and PDF still contain a useful report document`, async () => {
    const report = makeReport(type, []);
    const workbook = createReportWorkbook(report);
    const details = workbook.getWorksheet("Detailed Records");
    assert.equal(details.lastRow.getCell(1).value, "No records match the selected filters.");
    const buffer = await createReportPdf(report, logo).getBuffer();
    assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
    assert.equal((buffer.toString("latin1").match(/\/Type \/Page\b/g) || []).length, 1);
    await save(`${type}-empty.pdf`, buffer);
  });

  test(`${type}: PDF handles few records, long text, and repeated pages`, async () => {
    const few = makeReport(type, [fixture()]);
    const fewBuffer = await createReportPdf(few, logo).getBuffer();
    await save(`${type}-few.pdf`, fewBuffer);
    const records = Array.from({ length: 65 }, (_, index) => fixture(index));
    records[3].animal = "Long descriptive text including observations and follow-up notes. ".repeat(14);
    records[4].animal = "UNBROKEN".repeat(50);
    const report = makeReport(type, records);
    const definition = createReportPdfDefinition(report, logo);
    assert.equal(definition.pageOrientation, type === "status" ? "portrait" : "landscape");
    assert.equal(definition.content.at(-1).table.headerRows, 2);
    const buffer = await createReportPdf(report, logo).getBuffer();
    assert.ok((buffer.toString("latin1").match(/\/Type \/Page\b/g) || []).length >= 3);
    await save(`${type}-many.pdf`, buffer);
    await save(`${type}-long.xlsx`, await createReportWorkbook(report).xlsx.writeBuffer());
  });
}

test("PDF retains text spanning more than one page within a single table cell", async () => {
  const record = { ...fixture(), treatment: "Treatment follow-up and observation details. ".repeat(400) + " END-OF-LONG-CELL" };
  const buffer = await createReportPdf(makeReport("medical", [record]), logo).getBuffer();
  assert.ok((buffer.toString("latin1").match(/\/Type \/Page\b/g) || []).length >= 3);
  await save("medical-tall-row.pdf", buffer);
});
