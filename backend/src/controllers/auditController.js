// backend/src/controllers/auditController.js
const { db } = require("../config/firebase");

const AUDIT_COL = "auditLogs";
const USER_COL = "users";
const TIME_ZONE = "Asia/Manila";

const ACTION_LABELS = {
  "animal.updated": "Updated",
  "animal.behavioral_assessment": "Behavioral Assessment",
  "animal.sent_to_quarantine": "Sent to Quarantine",
  "animal.marked_ready": "Marked Ready",
  "animal.archived": "Archived",
  "animal.medical_record_added": "Medical Record Added",
  "animal.medical_record_updated": "Medical Record Updated",
  "inventory.medical_stock_used": "Medical Stock Used",
  "inventory.medical_stock_returned": "Medical Stock Returned",

  "intake.created": "Created",
  "intake.updated": "Updated",
  "intake.approved": "Approved",
  "intake.rejected": "Rejected",
  "intake.converted": "Converted",
};

const SENSITIVE_KEY_PATTERN =
  /password|passcode|token|secret|hash|authorization|credential/i;

function toDate(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  if (typeof value._seconds === "number") {
    return new Date(value._seconds * 1000);
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

function formatDateTime(value) {
  const date = toDate(value);

  if (!date) {
    return {
      timestamp: null,
      date: "—",
      time: "—",
    };
  }

  const dateParts = new Intl.DateTimeFormat(
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
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date);

  return {
    timestamp: date.toISOString(),
    date: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
    time,
  };
}

function humanizeText(value) {
  return String(value || "")
    .replaceAll("_", " ")
    .replaceAll(".", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    )
    .trim();
}

function getActionLabel(action) {
  const normalized = String(action || "")
    .trim()
    .toLowerCase();

  if (ACTION_LABELS[normalized]) {
    return ACTION_LABELS[normalized];
  }

  const actionPart =
    normalized.split(".").pop();

  return (
    humanizeText(actionPart) ||
    "Updated"
  );
}

function sanitizeValue(value, depth = 0) {
  if (depth > 4) {
    return "[Nested data omitted]";
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map((item) =>
        sanitizeValue(item, depth + 1)
      );
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !SENSITIVE_KEY_PATTERN.test(key)
        )
        .map(([key, item]) => [
          key,
          sanitizeValue(item, depth + 1),
        ])
    );
  }

  return value;
}

function formatDetailValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function summarizeChanges(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return "";
  }

  return Object.entries(value)
    .slice(0, 6)
    .map(
      ([key, item]) =>
        `${humanizeText(key)}: ${formatDetailValue(item)}`
    )
    .join(", ");
}

function buildDetails(
  log,
  actionLabel,
  before,
  after
) {
  if (log.details) {
    return String(log.details);
  }

  const target =
    log.targetName ||
    log.targetId ||
    "record";

  const beforeSummary =
    summarizeChanges(before);

  const afterSummary =
    summarizeChanges(after);

  if (beforeSummary && afterSummary) {
    return `${actionLabel} ${target}. Before: ${beforeSummary}. After: ${afterSummary}.`;
  }

  if (afterSummary) {
    return `${actionLabel} ${target}. Changes: ${afterSummary}.`;
  }

  return `${actionLabel} ${target}.`;
}

async function getRoleMap(rawLogs) {
  const emails = [
    ...new Set(
      rawLogs
        .map((log) =>
          String(log.performedBy || "")
            .trim()
            .toLowerCase()
        )
        .filter((email) =>
          email.includes("@")
        )
    ),
  ];

  const snapshots = await Promise.all(
    emails.map((email) =>
      db
        .collection(USER_COL)
        .doc(email)
        .get()
    )
  );

  const roleMap = new Map();

  snapshots.forEach(
    (snapshot, index) => {
      if (!snapshot.exists) return;

      roleMap.set(
        emails[index],
        snapshot.data()?.role ||
          "Management User"
      );
    }
  );

  return roleMap;
}

exports.getAuditLogs = async (
  req,
  res
) => {
  try {
    const requestedLimit =
      Number.parseInt(
        req.query.limit,
        10
      );

    const limit =
      Number.isFinite(requestedLimit)
        ? Math.min(
            Math.max(
              requestedLimit,
              1
            ),
            1000
          )
        : 500;

    const snapshot = await db
      .collection(AUDIT_COL)
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();

    const rawLogs =
      snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

    const roleMap =
      await getRoleMap(rawLogs);

    const logs = rawLogs.map((log) => {
      const dateTime =
        formatDateTime(log.timestamp);

      const action =
        getActionLabel(log.action);

      const before = sanitizeValue(
        log.before || {}
      );

      const after = sanitizeValue(
        log.after || {}
      );

      const email = String(
        log.performedBy || ""
      )
        .trim()
        .toLowerCase();

      return {
        id: log.id,

        timestamp:
          dateTime.timestamp,

        date: dateTime.date,
        time: dateTime.time,

        actor:
          log.performedByName ||
          log.actor ||
          log.performedBy ||
          "System",

        role:
          log.role ||
          roleMap.get(email) ||
          "Management User",

        module:
          log.module || "System",

        action,
        rawAction:
          log.action || "",

        record:
          log.targetId ||
          log.record ||
          log.id,

        targetName:
          log.targetName || "",

        status:
          log.status || "Success",

        details: buildDetails(
          log,
          action,
          before,
          after
        ),

        ipAddress:
          log.ipAddress ||
          "Not recorded",

        before,
        after,
      };
    });

    return res.status(200).json({
      logs,
      total: logs.length,
    });
  } catch (error) {
    console.error(
      "[getAuditLogs]",
      error
    );

    return res.status(500).json({
      message:
        "Failed to fetch audit logs.",
    });
  }
};
