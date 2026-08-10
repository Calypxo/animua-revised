const CLEARANCE_VALUES = new Set(["Pending", "Hold", "Cleared"]);

export function shouldShowAddMedical(status, canAddMedical) {
  return status === "Quarantine" && Boolean(canAddMedical);
}

export function buildQuarantineDecisionPayload(existing, clearance, date) {
  if (!CLEARANCE_VALUES.has(clearance)) {
    throw new Error("Invalid quarantine decision.");
  }
  return {
    type: "Quarantine Clearance",
    date,
    diagnosis: existing?.diagnosis || "Quarantine readiness reviewed.",
    treatment: existing?.treatment || "",
    notes: existing?.notes || "Decision recorded from the care readiness panel.",
    clearance,
    weight: existing?.weight || null,
    inventoryItemId: existing?.inventoryItemId || "",
    quantityUsed: Number(existing?.quantityUsed || 0),
  };
}
