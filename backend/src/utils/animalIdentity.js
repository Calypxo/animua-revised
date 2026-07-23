const PLACEHOLDER_NAMES = new Set([
  "",
  "unknown",
  "unnamed",
  "unnamed pet",
  "unnamed furbaby",
  "n/a",
  "none",
]);

function cleanText(value) {
  return String(value || "").trim();
}

function isMeaningfulLegacyName(value) {
  const normalized = cleanText(value).toLowerCase();
  return normalized && !PLACEHOLDER_NAMES.has(normalized);
}

function buildShelterLabel(data = {}, id = "") {
  const description = cleanText(
    data.identifyingDescription ||
    data.shelterLabel
  );

  if (description) return description;

  const colorMarkings = cleanText(
    data.colorMarkings ||
    data.color
  );
  const identity = [
    cleanText(data.ageEstimate),
    cleanText(data.sex),
    cleanText(data.species),
  ].filter(Boolean).join(" ");

  if (colorMarkings || identity) {
    return [colorMarkings, identity]
      .filter(Boolean)
      .join(" - ");
  }

  if (isMeaningfulLegacyName(data.animalName)) {
    return cleanText(data.animalName);
  }

  if (isMeaningfulLegacyName(data.name)) {
    return cleanText(data.name);
  }

  return id ? `Animal ${id}` : "Shelter animal";
}

function getAnimalDisplayLabel(data = {}, id = "") {
  const adoptedName = cleanText(data.adoptedName);

  if (data.status === "Adopted" && adoptedName) {
    return adoptedName;
  }

  return buildShelterLabel(data, id);
}

module.exports = {
  buildShelterLabel,
  cleanText,
  getAnimalDisplayLabel,
  isMeaningfulLegacyName,
};
