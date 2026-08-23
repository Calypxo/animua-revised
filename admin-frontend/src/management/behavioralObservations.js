const OBSERVATION_HEADING = "Observed behaviors:";
const NOTES_HEADING = "Assessment notes:";

function singleLine(value, limit) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

export function normalizeBehavioralObservations(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => ({
      label: singleLine(entry?.label, 80),
      detail: singleLine(entry?.detail, 300),
    }))
    .filter((entry) => entry.label || entry.detail);
}

export function serializeBehavioralNotes(entries, notes = "") {
  const observations = normalizeBehavioralObservations(entries)
    .filter((entry) => entry.label);
  const cleanNotes = String(notes || "").trim();

  if (!observations.length) return cleanNotes;

  const lines = observations.map(({ label, detail }) =>
    `- ${label}${detail ? ` — ${detail}` : ""}`
  );

  return `${OBSERVATION_HEADING}\n${lines.join("\n")}\n\n${NOTES_HEADING}\n${cleanNotes}`;
}

export function parseBehavioralNotes(value = "") {
  const raw = String(value || "").replace(/\r\n?/g, "\n").trim();
  const marker = `\n\n${NOTES_HEADING}`;

  if (!raw.startsWith(`${OBSERVATION_HEADING}\n`) || !raw.includes(marker)) {
    return { observations: [], notes: raw };
  }

  const markerIndex = raw.indexOf(marker);
  const observationBlock = raw.slice(OBSERVATION_HEADING.length + 1, markerIndex);
  const notes = raw.slice(markerIndex + marker.length).replace(/^\n/, "").trim();
  const observations = [];

  for (const line of observationBlock.split(/\r?\n/).filter(Boolean)) {
    if (!line.startsWith("- ")) return { observations: [], notes: raw };
    const content = line.slice(2).trim();
    const separatorIndex = content.indexOf(" — ");
    const label = separatorIndex >= 0 ? content.slice(0, separatorIndex) : content;
    const detail = separatorIndex >= 0 ? content.slice(separatorIndex + 3) : "";
    if (!label.trim()) return { observations: [], notes: raw };
    observations.push({ label: label.trim(), detail: detail.trim() });
  }

  return { observations: normalizeBehavioralObservations(observations), notes };
}
