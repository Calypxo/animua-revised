import ExcelJS from "exceljs";
import { reportDate, reportMetadata, reportFilename, reportText } from "./buildReportData.js";
import { REPORT_STYLE as style } from "./reportStyles.js";
import { downloadReport } from "./downloadReport.js";

const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const border = { style: "thin", color: { argb: style.border } };
const formats = { date: style.dateFormat, number: style.numberFormat, percent: style.percentFormat };

function rowHeight(values, widths, fontSize = 11) {
  const lines = values.map((value, index) => String(value ?? "").split("\n")
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / Math.max(6, widths[index] - 3))), 0));
  return Math.min(409, Math.max(24, Math.max(...lines) * (fontSize + 4) + 10));
}

function mergedRow(sheet, value, lastColumn, { color = style.ink, background, size = 11, bold = false } = {}) {
  const row = sheet.addRow([value]);
  sheet.mergeCells(row.number, 1, row.number, lastColumn);
  row.getCell(1).font = { name: "Calibri", size, bold, color: { argb: color } };
  row.getCell(1).alignment = { vertical: "middle", wrapText: true };
  if (background) row.getCell(1).fill = fill(background);
  row.height = rowHeight([value], [sheet.columns.slice(0, lastColumn).reduce((sum, column) => sum + column.width, 0)], size);
  return row;
}

function reportHeader(sheet, report, count) {
  mergedRow(sheet, "ANIMUA", count, { size: 22, bold: true, color: style.white, background: style.brand });
  mergedRow(sheet, style.systemName, count, { color: style.muted });
  mergedRow(sheet, report.title.toUpperCase(), count, { size: 16, bold: true, color: style.brand });
  sheet.addRow([]).height = 8;
  reportMetadata(report).forEach(([label, value]) => mergedRow(sheet, `${label}: ${value}`, count));
  sheet.addRow([]).height = 10;
}

function section(sheet, label, count) {
  mergedRow(sheet, label.toUpperCase(), count, { bold: true, color: style.brand, background: style.pale });
}

function tableHeader(sheet, labels) {
  const row = sheet.addRow(labels);
  row.eachCell((cell) => {
    cell.fill = fill(style.brand);
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: style.white } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = { top: border, bottom: border, left: border, right: border };
  });
  row.height = rowHeight(labels, sheet.columns.map((column) => column.width));
  return row;
}

function dataRow(sheet, values, types, index) {
  const row = sheet.addRow(values);
  row.eachCell({ includeEmpty: true }, (cell, column) => {
    const type = types[column - 1];
    cell.font = { name: "Calibri", size: 11, color: { argb: style.ink } };
    cell.fill = fill(index % 2 ? style.pale : style.white);
    cell.border = { top: border, bottom: border, left: border, right: border };
    cell.alignment = { vertical: "top", wrapText: true, horizontal: ["number", "percent"].includes(type) ? "right" : "left" };
    if (formats[type]) cell.numFmt = formats[type];
  });
  row.height = rowHeight(values.map((value) => value instanceof Date ? "Sep 23, 2026" : value), sheet.columns.map((column) => column.width));
  return row;
}

function createSheet(workbook, name, widths, orientation) {
  const sheet = workbook.addWorksheet(name, {
    properties: { defaultRowHeight: 24 },
    pageSetup: { paperSize: 9, orientation, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.15, footer: 0.2 } },
    headerFooter: { oddFooter: `&L${style.footer}&RPage &P of &N` },
  });
  sheet.columns = widths.map((width) => ({ width }));
  sheet.views = [{ showGridLines: false }];
  return sheet;
}

function cellValue(value, type) {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "date") return reportDate(value) || reportText(value);
  if (type === "number" && Number.isFinite(Number(value))) return Number(value);
  // Text stays text, including phone numbers, leading zeros, and strings starting with '='.
  return String(value);
}

export function createReportWorkbook(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = report.generatedBy || "ANIMUA";
  workbook.title = report.title;
  workbook.subject = reportMetadata(report)[0][1];
  workbook.created = new Date(report.generatedAt);
  const summary = createSheet(workbook, "Report Summary", [48, 28, 20], "portrait");
  reportHeader(summary, report, 3);
  section(summary, "Report summary", 3);
  tableHeader(summary, ["Metric", "Value", ""]);
  report.summary.forEach((metric, index) => dataRow(summary, [metric.label, metric.value, ""], ["text", metric.type, "text"], index));
  if (report.breakdown.length) {
    summary.addRow([]).height = 10;
    section(summary, report.breakdownLabel, 3);
    tableHeader(summary, [report.breakdownLabel, "Records", "Share"]);
    report.breakdown.forEach(({ label, count, share }, index) => dataRow(summary, [label, count, share], ["text", "number", "percent"], index));
    const total = dataRow(summary, ["Total", report.records.length, 1], ["text", "number", "percent"], 0);
    total.font = { name: "Calibri", size: 11, bold: true, color: { argb: style.brand } };
  }
  const count = report.columns.length;
  const details = createSheet(workbook, "Detailed Records", report.columns.map(({ width }) => width), report.orientation);
  reportHeader(details, report, count);
  section(details, `Detailed records (${report.records.length})`, count);
  const header = tableHeader(details, report.columns.map(({ label }) => label));
  report.records.forEach((record, index) => dataRow(details,
    report.columns.map(({ key, type }) => cellValue(record[key], type)), report.columns.map(({ type }) => type), index));
  details.autoFilter = { from: { row: header.number, column: 1 }, to: { row: header.number + report.records.length, column: count } };
  details.views = [{ state: "frozen", ySplit: header.number, topLeftCell: `A${header.number + 1}`, activeCell: `A${header.number + 1}`, showGridLines: false }];
  details.pageSetup.printTitlesRow = `${header.number}:${header.number}`;
  if (!report.records.length) mergedRow(details, "No records match the selected filters.", count, { color: style.muted });
  return workbook;
}

export async function exportReportToExcel(report) {
  const buffer = await createReportWorkbook(report).xlsx.writeBuffer();
  downloadReport(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), reportFilename(report, "xlsx"));
}
