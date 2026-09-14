const test = require("node:test");
const assert = require("node:assert/strict");

const {
  WORKFLOWS,
  buildApprovalDeadlineFields,
  lifecycleUpdate,
  validateScheduleDate,
} = require("../src/services/requestDeadlineService");

test("approval creates a 14-day attendance deadline ending at the close of day", () => {
  const fields = buildApprovalDeadlineFields(new Date("2026-08-01T08:30:00.000Z"));
  assert.equal(fields.approvedAt, "2026-08-01T08:30:00.000Z");
  assert.equal(fields.attendanceDeadlineAt, "2026-08-15T15:59:59.999Z");
  assert.equal(fields.deadlineStatus, "Awaiting Appointment");
});

test("public schedules must be today or later and no later than the deadline", () => {
  const record = buildApprovalDeadlineFields(new Date("2026-08-01T08:30:00.000Z"));
  const now = new Date("2026-08-03T01:00:00.000Z");
  assert.equal(validateScheduleDate(record, "2026-08-03", now), true);
  assert.equal(validateScheduleDate(record, "2026-08-15", now), true);
  assert.equal(validateScheduleDate(record, "2026-08-16", now), false);
  assert.equal(validateScheduleDate(record, "2026-08-02", now), false);
});

test("day-seven reminder flags an approved request without an appointment", () => {
  const record = buildApprovalDeadlineFields(new Date("2026-08-01T00:00:00.000Z"));
  const update = lifecycleUpdate(
    record,
    WORKFLOWS.adoption,
    new Date("2026-08-08T00:05:00.000Z")
  );
  assert.equal(update.deadlineReminderStage, "Day 7");
  assert.equal(update.deadlineStatus, "Appointment Required");
  assert.equal(update.noShowRisk, true);
});

test("a missed appointment creates no-show risk before the final deadline", () => {
  const record = {
    ...buildApprovalDeadlineFields(new Date("2026-08-01T00:00:00.000Z")),
    pickupSchedule: { date: "2026-08-05", time: "09:00" },
  };
  const update = lifecycleUpdate(
    record,
    WORKFLOWS.adoption,
    new Date("2026-08-06T01:00:00.000Z")
  );
  assert.equal(update.deadlineStatus, "Missed Appointment \u2014 No Show Risk");
  assert.equal(update.noShowRisk, true);
});

test("an unconfirmed request automatically expires after its 14-day deadline", () => {
  const record = buildApprovalDeadlineFields(new Date("2026-08-01T00:00:00.000Z"));
  const update = lifecycleUpdate(
    record,
    WORKFLOWS.surrender,
    new Date("2026-08-16T00:00:00.000Z")
  );
  assert.equal(update.status, "Expired");
  assert.equal(update.deadlineStatus, "Expired \u2014 No Show");
  assert.equal(update.noShowRisk, true);
});

test("confirmed arrival stops deadline warnings and expiration", () => {
  const record = {
    ...buildApprovalDeadlineFields(new Date("2026-08-01T00:00:00.000Z")),
    arrivalConfirmedAt: "2026-08-05T02:00:00.000Z",
  };
  const update = lifecycleUpdate(
    record,
    WORKFLOWS.surrender,
    new Date("2026-08-20T00:00:00.000Z")
  );
  assert.deepEqual(update, {});
});

test("a pending surrender reschedule does not suspend the attendance deadline", () => {
  const record = {
    ...buildApprovalDeadlineFields(new Date("2026-08-01T00:00:00.000Z")),
    surrenderRescheduleRequest: { status: "Pending", date: "2026-08-14" },
  };
  const update = lifecycleUpdate(record, WORKFLOWS.surrender, new Date("2026-08-16T00:00:00.000Z"));
  assert.equal(update.status, "Expired");
});

test("an explicit extension keeps a surrender reschedule active until the new deadline", () => {
  const record = {
    ...buildApprovalDeadlineFields(new Date("2026-08-01T00:00:00.000Z")),
    attendanceDeadlineAt: "2026-08-22T15:59:59.999Z",
    surrenderRescheduleRequest: { status: "Pending", date: "2026-08-20" },
  };
  const update = lifecycleUpdate(record, WORKFLOWS.surrender, new Date("2026-08-16T00:00:00.000Z"));
  assert.equal(update.status, undefined);
  assert.equal(update.deadlineStatus, "Reschedule Pending");
});
