import {
  apiFetch,
} from "../utils/api.js";

const TIME_ZONE = "Asia/Manila";

function toDate(value) {
  if (!value) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime())
      ? null
      : parsed;
  }

  const seconds =
    value._seconds ??
    value.seconds;

  if (typeof seconds === "number") {
    return new Date(seconds * 1000);
  }

  return null;
}

function formatDateTime(value) {
  const date = toDate(value);

  if (!date) {
    return {
      date: "—",
      time: "—",
      timestamp: 0,
    };
  }

  const dateParts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(date);

  const getPart = (type) =>
    dateParts.find(
      (part) => part.type === type
    )?.value || "";

  const time =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }
    ).format(date);

  return {
    date:
      `${getPart("year")}-` +
      `${getPart("month")}-` +
      `${getPart("day")}`,

    time,
    timestamp: date.getTime(),
  };
}

function buildRelatedInfo(animal) {
  const values = [
    animal.species
      ? `Species: ${animal.species}`
      : "",

    animal.breed
      ? `Breed: ${animal.breed}`
      : "",

    animal.sex
      ? `Sex: ${animal.sex}`
      : "",
  ].filter(Boolean);

  return values.length
    ? values.join(" · ")
    : "No additional information.";
}

function mapAnimalToArchiveRecord(
  animal
) {
  const archivedDateTime =
    formatDateTime(
      animal.archivedAt ||
      animal.updatedAt
    );

  return {
    id: `ARC-ANIMAL-${animal.id}`,

    sourceId: animal.id,
    sourceType: "animal",

    module: "Animal Management",
    type: "Animal Record",

    title:
      animal.adoptedName ||
      animal.identifyingDescription ||
      animal.shelterLabel ||
      [
        animal.color,
        animal.ageEstimate,
        animal.sex,
        animal.species,
      ].filter(Boolean).join(" ") ||
      animal.name ||
      `Animal ${animal.id}`,

    recordId: animal.id,

    reason:
      animal.archiveReason ||
      "Other",

    archivedDate:
      archivedDateTime.date,

    archivedTime:
      archivedDateTime.time,

    archivedTimestamp:
      archivedDateTime.timestamp,

    archivedBy:
      animal.archivedByName ||
      animal.archivedBy ||
      animal.updatedBy ||
      "System",

    description:
      animal.archiveDescription ||
      `Animal record archived from ${
        animal.statusBeforeArchive ||
        "active records"
      }.`,

    relatedInfo:
      buildRelatedInfo(animal),
  };
}

export async function getArchivedRecords() {
  const data = await apiFetch(
    "/animals?status=Archived"
  );

  const animals = Array.isArray(
    data?.animals
  )
    ? data.animals
    : [];

  return animals
    .map(mapAnimalToArchiveRecord)
    .sort(
      (a, b) =>
        b.archivedTimestamp -
        a.archivedTimestamp
    );
}

export async function restoreArchivedAnimal(
  animalId
) {
  if (!animalId) {
    throw new Error(
      "Animal ID is required."
    );
  }

  return apiFetch(
    `/animals/${encodeURIComponent(
      animalId
    )}/restore`,
    {
      method: "PATCH",
    }
  );
}
