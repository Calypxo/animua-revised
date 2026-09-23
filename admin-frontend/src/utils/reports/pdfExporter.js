import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
import { formatReportValue, reportMetadata, reportFilename } from "./buildReportData.js";
import { REPORT_STYLE as style } from "./reportStyles.js";
import { downloadReport } from "./downloadReport.js";

pdfMake.addVirtualFileSystem(pdfFonts);
const color = (name) => `#${style[name]}`;
// Allow long IDs, email addresses, and other unbroken values to wrap within fixed columns.
const wrapText = (value) => String(value).replace(/[^\s\u200b]{21,}/gu, (word) => word.replace(/(.{10})(?=.)/gu, "$1\u200b"));

function table(body, widths, { fontSize = 9, headerRows = 1 } = {}) {
  return {
    fontSize,
    table: { headerRows, widths, body },
    layout: {
      hLineWidth: (line) => headerRows === 2 && line <= 1 ? 0 : 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => color("border"),
      vLineColor: () => color("border"),
      paddingLeft: () => 5,
      paddingRight: () => 5,
      paddingTop: () => 6,
      paddingBottom: () => 6,
      fillColor: (row) => row < headerRows ? color("brand") : row % 2 === 0 ? color("pale") : color("white"),
    },
  };
}

const heading = (text) => ({ text: text.toUpperCase(), style: "section", headlineLevel: 1 });
const headerCell = (text) => ({ text: wrapText(text), color: color("white"), bold: true });
const cell = (value, type) => ({ text: wrapText(formatReportValue(value, type)), alignment: ["number", "percent"].includes(type) ? "right" : "left" });

export function createReportPdfDefinition(report, logo) {
  const pageWidth = report.orientation === "landscape" ? 841.89 : 595.28;
  const contentWidth = pageWidth - 72;
  const weight = report.columns.reduce((sum, column) => sum + column.weight, 0);
  // Subtract the table's padding and border widths so its right edge stays inside the margin.
  const availableWidth = contentWidth - report.columns.length * 10 - (report.columns.length + 1) * 0.5;
  const widths = report.columns.map((column) => availableWidth * column.weight / weight);
  const body = [
    [{ text: `DETAILED RECORDS (${report.records.length})`, colSpan: report.columns.length, fontSize: 11, bold: true, color: color("brand"), fillColor: color("white"), border: [false, false, false, false], margin: [0, 8, 0, 4] }, ...report.columns.slice(1).map(() => ({}))],
    report.columns.map(({ label }) => headerCell(label)),
  ];
  report.records.forEach((record) => body.push(report.columns.map(({ key, type }) => cell(record[key], type))));
  if (!report.records.length) body.push([
    { text: "No records match the selected filters.", colSpan: report.columns.length, color: color("muted"), margin: [0, 8] },
    ...report.columns.slice(1).map(() => ({})),
  ]);
  const content = [
    {
      columns: [
        ...(logo ? [{ image: logo, width: 44, margin: [0, 0, 12, 0] }] : []),
        { width: "*", stack: [
          { text: "ANIMUA", fontSize: 23, bold: true, color: color("brand") },
          { text: style.systemName, color: color("muted"), fontSize: 10, margin: [0, 3, 0, 0] },
        ] },
      ],
      columnGap: 12,
      margin: [0, 0, 0, 14],
    },
    { text: report.title.toUpperCase(), fontSize: 17, bold: true, margin: [0, 0, 0, 12] },
    ...reportMetadata(report).map(([label, value]) => ({
      text: [{ text: `${label}: `, bold: true }, { text: wrapText(value) }], margin: [0, 0, 0, 5],
    })),
  ];
  const summaryBlock = [heading("Report summary"),
    table([
      [headerCell("Metric"), headerCell("Value")],
      ...report.summary.map(({ label, value, type }) => [{ text: wrapText(label) }, cell(value, type)]),
    ], ["*", 100]),
  ];
  const breakdownBlock = report.breakdown.length ? [heading(report.breakdownLabel),
    table([
      [headerCell(report.breakdownLabel), headerCell("Records"), headerCell("Share")],
      ...report.breakdown.map(({ label, count, share }) => [{ text: wrapText(label) }, cell(count, "number"), cell(share, "percent")]),
      [{ text: "Total", bold: true }, { ...cell(report.records.length, "number"), bold: true }, { text: "100%", alignment: "right", bold: true }],
    ], ["*", 70, 70]),
  ] : [];
  if (report.orientation === "landscape" && report.breakdown.length > 0 && report.breakdown.length <= 6) {
    content.push({ columns: [{ width: "*", stack: summaryBlock }, { width: "*", stack: breakdownBlock }], columnGap: 20, margin: [0, 0, 0, 8] });
  } else {
    content.push(...summaryBlock, ...breakdownBlock);
  }
  content.push(table(body, widths, { fontSize: 8.5, headerRows: 2 }));

  return {
    info: { title: report.title, author: report.generatedBy || "ANIMUA", subject: reportMetadata(report)[0][1], creator: "ANIMUA Management System" },
    pageSize: "A4",
    pageOrientation: report.orientation,
    pageMargins: [36, 44, 36, 44],
    defaultStyle: { font: "Roboto", fontSize: 9, color: color("ink"), lineHeight: 1.15 },
    styles: { section: { fontSize: 11, bold: true, color: color("brand"), margin: [0, 16, 0, 8] } },
    header: (page) => page > 1 ? {
      columns: [{ text: "ANIMUA", bold: true, color: color("brand"), width: 60 }, { text: report.title, alignment: "right" }],
      margin: [36, 18, 36, 0], fontSize: 8,
    } : null,
    footer: (page, pages) => ({
      stack: [
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: contentWidth, y2: 0, lineWidth: 0.5, lineColor: color("border") }] },
        { columns: [{ text: style.footer }, { text: `Page ${page} of ${pages}`, alignment: "right", width: 90 }], margin: [0, 7, 0, 0] },
      ],
      margin: [36, 12, 36, 0], fontSize: 8, color: color("muted"),
    }),
    pageBreakBefore: (node, container) => node.headlineLevel === 1 && container.getFollowingNodesOnPage().length === 0,
    content,
  };
}

export function createReportPdf(report, logo) {
  return pdfMake.createPdf(createReportPdfDefinition(report, logo));
}

async function loadReportLogo() {
  try {
    const response = await fetch("/favicon.png");
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    // The optional logo must not prevent exporting the report's data.
    return undefined;
  }
}

export async function exportReportToPDF(report) {
  const logo = await loadReportLogo();
  const blob = await createReportPdf(report, logo).getBlob();
  downloadReport(blob, reportFilename(report, "pdf"));
}
