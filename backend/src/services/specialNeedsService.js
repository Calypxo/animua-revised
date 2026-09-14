const STATUSES = new Set(["yes", "no", "unknown"]);

function getSpecialNeedsStatus(animal = {}) {
  if (STATUSES.has(animal.specialNeedsStatus)) return animal.specialNeedsStatus;
  // Only an explicit legacy boolean can be used as a confirmed status.
  // Numeric assessments (including 1) need review, not an inferred diagnosis.
  const legacy = animal.specialNeeds ?? animal.flags?.specialNeeds;
  if (typeof legacy === "boolean") return legacy ? "yes" : "no";
  return "unknown";
}

function validateSpecialNeeds(input = {}, animal = {}) {
  const status = input.specialNeedsStatus ?? getSpecialNeedsStatus(animal);
  if (!STATUSES.has(status)) return { error: "Choose Yes, No, or Not yet assessed for special needs." };
  const notes = String(input.specialNeedsNotes ?? animal.specialNeedsNotes ?? "").trim();
  if (notes.length > 1000) return { error: "Special-needs care notes must be 1,000 characters or fewer." };
  if (status === "yes" && !notes) return { error: "Describe the animal's special needs and required care." };
  return { specialNeedsStatus: status, specialNeedsNotes: status === "no" ? "" : notes };
}

module.exports = { getSpecialNeedsStatus, validateSpecialNeeds };
