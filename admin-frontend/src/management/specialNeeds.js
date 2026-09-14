export function specialNeedsStatus(animal = {}) {
  if (["yes", "no", "unknown"].includes(animal.specialNeedsStatus)) return animal.specialNeedsStatus;
  const legacy = animal.specialNeeds ?? animal.flags?.specialNeeds;
  return typeof legacy === "boolean" ? (legacy ? "yes" : "no") : "unknown";
}

export function specialNeedsLabel(animal) {
  return { yes: "Requires special care", no: "No known special needs", unknown: "Not yet assessed" }[specialNeedsStatus(animal)];
}
