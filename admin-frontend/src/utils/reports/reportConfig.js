import { reportText as text } from "./buildReportData.js";

export const REPORT_CONFIG = {
  intake: { label: "Animal Intake", description: "Incoming animals and intake conversion", icon: "bi-box-arrow-in-down", tone: "amber", dimension: "status", dimensionLabel: "Intake status", columns: [["date", "Intake Date"], ["id", "Intake ID"], ["animal", "Description"], ["source", "Source"], ["species", "Species"], ["status", "Intake Status"], ["conversion", "Conversion"], ["location", "Location"]] },
  barangay: { label: "Barangay Stray Intake", description: "Barangay impounds and stray-animal origins", icon: "bi-geo-alt-fill", tone: "teal", dimension: "barangay", dimensionLabel: "Barangay origin", columns: [["date", "Intake Date"], ["id", "Intake ID"], ["barangay", "Barangay"], ["animal", "Description"], ["species", "Species"], ["condition", "Initial Condition"], ["status", "Intake Status"], ["location", "Pickup Location"], ["officer", "Barangay Officer"]] },
  status: { label: "Animal Status", description: "Care stages and adoption readiness", icon: "bi-heart-pulse-fill", tone: "blue", dimension: "status", dimensionLabel: "Care stage", columns: [["date", "Intake Date"], ["id", "Animal ID"], ["animal", "Description"], ["species", "Species"], ["status", "Current Status"], ["clearance", "Clearance"], ["assessment", "Behavioral Assessment"]] },
  adoption: { label: "Adoption", description: "Applications, approvals, and placements", icon: "bi-balloon-heart-fill", tone: "rose", dimension: "status", dimensionLabel: "Application status", columns: [["date", "Submitted"], ["id", "Application ID"], ["animalId", "Animal ID"], ["animal", "Shelter Description"], ["applicant", "Applicant"], ["contact", "Contact"], ["source", "Source"], ["status", "Status"], ["adoptionDate", "Adoption Date"], ["adoptedName", "Adopter-Given Name"]] },
  medical: { label: "Medical & Quarantine", description: "Clinical activity and animal clearance", icon: "bi-clipboard2-pulse-fill", tone: "green", dimension: "type", dimensionLabel: "Clinical activity", columns: [["date", "Date"], ["animalId", "Animal ID"], ["animal", "Description"], ["type", "Record Type"], ["veterinarian", "Veterinarian"], ["diagnosis", "Diagnosis"], ["treatment", "Treatment"], ["inventoryItem", "Inventory Used"], ["quantityUsed", "Qty"], ["clearance", "Clearance"]] },
  inventory: { label: "Inventory Usage", description: "Consumed stock and remaining supply", icon: "bi-box-seam-fill", tone: "stone", dimension: "stockStatus", dimensionLabel: "Stock condition", columns: [["date", "Usage Date"], ["inventoryItem", "Item"], ["quantityUsed", "Qty Used"], ["unit", "Unit"], ["remainingStock", "Remaining"], ["stockStatus", "Stock Status"], ["animalId", "Animal ID"], ["animal", "Description"], ["type", "Procedure"], ["veterinarian", "Veterinarian"]] },
  surrender: { label: "Surrender Requests", description: "Owner requests, urgency, and outcomes", icon: "bi-file-earmark-text-fill", tone: "teal", dimension: "status", dimensionLabel: "Request status", columns: [["date", "Submitted"], ["id", "Request ID"], ["owner", "Owner"], ["barangay", "Barangay"], ["animal", "Animal Description"], ["species", "Species"], ["category", "NLP Category"], ["urgency", "Urgency"], ["status", "Status"]] },
};

function countWhere(list, key, matcher) {
  return list.filter((row) => matcher.test(String(row[key] || ""))).length;
}

export function summaryCards(active, list) {
  const config = REPORT_CONFIG[active];
  const cards = [{ label: "Visible records", value: list.length, icon: "bi-list-check", tone: config.tone }];
  if (active === "intake") {
    const converted = list.filter((row) => row.conversion === "Converted").length;
    cards.push({ label: "Converted to profile", value: converted, icon: "bi-arrow-repeat", tone: "green" }, { label: "Conversion rate", value: `${list.length ? Math.round((converted / list.length) * 100) : 0}%`, icon: "bi-percent", tone: "blue" });
  } else if (active === "status") {
    cards.push({ label: "Adoption ready", value: countWhere(list, "status", /^ready$/i), icon: "bi-house-heart", tone: "green" }, { label: "In quarantine", value: countWhere(list, "status", /quarantine/i), icon: "bi-shield-plus", tone: "rose" });
  } else if (active === "adoption") {
    const finalized = countWhere(list, "status", /finalized|adopted/i);
    cards.push({ label: "Finalized placements", value: finalized, icon: "bi-balloon-heart", tone: "green" }, { label: "Placement share", value: `${list.length ? Math.round((finalized / list.length) * 100) : 0}%`, icon: "bi-percent", tone: "blue" });
  } else if (active === "medical") {
    cards.push({ label: "Cleared records", value: countWhere(list, "clearance", /clear|approved/i), icon: "bi-shield-check", tone: "green" }, { label: "Animals treated", value: new Set(list.map((row) => row.animalId).filter(Boolean)).size, icon: "bi-heart-pulse", tone: "blue" });
  } else if (active === "inventory") {
    cards.push({ label: "Total quantity used", value: list.reduce((sum, row) => sum + Number(row.quantityUsed || 0), 0), icon: "bi-box-arrow-up", tone: "amber" }, { label: "Critical stock links", value: countWhere(list, "stockStatus", /critical/i), icon: "bi-exclamation-triangle", tone: "rose" });
  } else if (active === "surrender") {
    cards.push({ label: "Urgent requests", value: countWhere(list, "urgency", /urgent|high|critical/i), icon: "bi-exclamation-diamond", tone: "rose" }, { label: "Pending review", value: countWhere(list, "status", /pending|review/i), icon: "bi-hourglass-split", tone: "amber" });
  } else if (active === "barangay") {
    const groups = dimensionCounts(active, list);
    cards.push({ label: "Barangays represented", value: groups.length, icon: "bi-pin-map", tone: "teal" }, { label: groups[0] ? `Highest: ${groups[0][0]}` : "Highest barangay", value: groups[0]?.[1] || 0, icon: "bi-geo-alt-fill", tone: "rose" });
  }
  const allCells = list.length * config.columns.length;
  const completed = list.reduce((total, row) => total + config.columns.filter(([key]) => text(row[key]) !== "—").length, 0);
  cards.push({ label: "Data completeness", value: `${allCells ? Math.round((completed / allCells) * 100) : 0}%`, icon: "bi-database-check", tone: "stone" });
  return cards.slice(0, 4);
}

export function dimensionCounts(active, list) {
  const config = REPORT_CONFIG[active];
  const counts = new Map();
  list.forEach((row) => {
    const label = text(row[config.dimension]);
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}

