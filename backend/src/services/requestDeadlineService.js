const { db } = require("../config/firebase");

const DAY_MS = 24 * 60 * 60 * 1000;
const DEADLINE_DAYS = 14;
const WARNING_DAY = 7;

function isFunctionalityTestingEnvironment(env = process.env) {
  return String(env.APP_ENVIRONMENT || "").trim().toLowerCase() === "functionality-testing";
}

function skippedReconciliationResult() {
  return {
    checked: 0,
    updated: 0,
    expired: 0,
    skipped: true,
    reason: "functionality-testing",
  };
}

const WORKFLOWS = {
  adoption: {
    collection: "adoptions",
    scheduleField: "pickupSchedule",
    rescheduleField: "pickupRescheduleRequest",
  },
  surrender: {
    collection: "surrenderRequests",
    scheduleField: "surrenderAppointment",
    rescheduleField: "surrenderRescheduleRequest",
  },
};

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const seconds = value._seconds ?? value.seconds;
  const parsed = typeof seconds === "number"
    ? new Date(seconds * 1000)
    : /^\d{4}-\d{2}-\d{2}$/.test(String(value))
      ? new Date(`${value}T00:00:00`)
      : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(value, days) {
  const date = toDate(value) || new Date();
  return new Date(date.getTime() + Number(days) * DAY_MS);
}

function approvalDate(record = {}) {
  return toDate(
    record.approvedAt ||
    record.approvedDate ||
    record.acceptedAt ||
    record.acceptedDate ||
    record.reviewedAt ||
    record.updatedAt
  );
}

function deadlineDate(record = {}) {
  const deadline = toDate(record.attendanceDeadlineAt)
    || addDays(approvalDate(record) || new Date(), DEADLINE_DAYS);
  deadline.setHours(23, 59, 59, 999);
  return deadline;
}

function buildApprovalDeadlineFields(now = new Date()) {
  const approvedAt = toDate(now) || new Date();
  const deadline = addDays(approvedAt, DEADLINE_DAYS);
  deadline.setHours(23, 59, 59, 999);
  return {
    approvedAt: approvedAt.toISOString(),
    attendanceDeadlineAt: deadline.toISOString(),
    deadlineDays: DEADLINE_DAYS,
    deadlineStatus: "Awaiting Appointment",
    deadlineReminderStage: "Approved",
    noShowRisk: false,
    arrivalConfirmedAt: null,
    expiredAt: null,
    expirationReason: null,
  };
}

function validateScheduleDate(record, dateValue, now = new Date()) {
  const scheduleDate = toDate(dateValue);
  const deadline = deadlineDate(record);
  const today = toDate(now);
  if (!scheduleDate || !deadline || !today) return false;
  scheduleDate.setHours(0, 0, 0, 0);
  deadline.setHours(23, 59, 59, 999);
  today.setHours(0, 0, 0, 0);
  return scheduleDate >= today && scheduleDate <= deadline;
}

function lifecycleUpdate(record, workflow, now = new Date()) {
  const approved = approvalDate(record);
  const deadline = deadlineDate(record);
  if (!approved || !deadline || record.arrivalConfirmedAt) return {};

  const elapsedDays = Math.max(0, Math.floor((now.getTime() - approved.getTime()) / DAY_MS));
  const schedule = record[workflow.scheduleField] || {};
  const scheduleDate = toDate(schedule.date);
  if (scheduleDate) scheduleDate.setHours(23, 59, 59, 999);
  const reschedule = record[workflow.rescheduleField] || {};
  const pendingReschedule = String(reschedule.status || "").toLowerCase() === "pending";
  const isExpired = now.getTime() > deadline.getTime();

  // A surrender date-change request does not grant an attendance extension.
  if (isExpired && (!pendingReschedule || workflow === WORKFLOWS.surrender)) {
    return {
      status: "Expired",
      deadlineStatus: "Expired \u2014 No Show",
      deadlineReminderStage: "Expired",
      noShowRisk: true,
      expiredAt: now.toISOString(),
      expirationReason: "The approved 14-day attendance deadline passed without confirmed arrival.",
      updatedAt: now.toISOString(),
    };
  }

  let deadlineStatus = scheduleDate ? "Appointment Scheduled" : "Awaiting Appointment";
  let reminderStage = "Approved";
  let noShowRisk = false;

  if (pendingReschedule) {
    deadlineStatus = "Reschedule Pending";
  } else if (scheduleDate && scheduleDate.getTime() < now.getTime()) {
    deadlineStatus = "Missed Appointment \u2014 No Show Risk";
    noShowRisk = true;
  } else if (elapsedDays >= 12) {
    deadlineStatus = scheduleDate ? "Appointment Scheduled \u2014 Deadline Urgent" : "Deadline Urgent";
    reminderStage = "Day 12";
    noShowRisk = true;
  } else if (elapsedDays >= WARNING_DAY) {
    deadlineStatus = scheduleDate ? "Appointment Scheduled" : "Appointment Required";
    reminderStage = "Day 7";
    noShowRisk = !scheduleDate;
  }

  const update = {};
  const expectedDeadline = deadline.toISOString();
  if (!record.attendanceDeadlineAt) update.attendanceDeadlineAt = expectedDeadline;
  if (record.deadlineDays !== DEADLINE_DAYS) update.deadlineDays = DEADLINE_DAYS;
  if (record.deadlineStatus !== deadlineStatus) update.deadlineStatus = deadlineStatus;
  if (record.deadlineReminderStage !== reminderStage) update.deadlineReminderStage = reminderStage;
  if (Boolean(record.noShowRisk) !== noShowRisk) update.noShowRisk = noShowRisk;
  if (reminderStage !== "Approved" && record.deadlineReminderStage !== reminderStage) {
    update.deadlineNotifiedAt = now.toISOString();
  }
  return update;
}

async function reconcileWorkflow(type, now = new Date()) {
  const workflow = WORKFLOWS[type];
  if (!workflow) return { checked: 0, updated: 0, expired: 0 };
  const snapshot = await db.collection(workflow.collection).where("status", "==", "Approved").get();
  let updated = 0;
  let expired = 0;

  await Promise.all(snapshot.docs.map(async (document) => {
    const update = lifecycleUpdate(document.data() || {}, workflow, now);
    if (!Object.keys(update).length) return;
    await document.ref.update(update);
    updated += 1;
    if (update.status === "Expired") expired += 1;
  }));

  return { checked: snapshot.size, updated, expired };
}

async function reconcileRequestDeadlines(types = Object.keys(WORKFLOWS), now = new Date()) {
  if (isFunctionalityTestingEnvironment()) {
    return skippedReconciliationResult();
  }

  const selected = Array.isArray(types) ? types : [types];
  const results = await Promise.all(selected.map((type) => reconcileWorkflow(type, now)));
  return results.reduce((total, result) => ({
    checked: total.checked + result.checked,
    updated: total.updated + result.updated,
    expired: total.expired + result.expired,
  }), { checked: 0, updated: 0, expired: 0 });
}

module.exports = {
  DEADLINE_DAYS,
  WARNING_DAY,
  WORKFLOWS,
  addDays,
  approvalDate,
  deadlineDate,
  buildApprovalDeadlineFields,
  validateScheduleDate,
  lifecycleUpdate,
  isFunctionalityTestingEnvironment,
  reconcileRequestDeadlines,
};
