import test from "node:test";
import assert from "node:assert/strict";
import { getAppointmentMonitor } from "../src/management/surrenderAppointmentMonitor.js";

const now = new Date("2026-09-15T10:00:00+08:00");
const approved = { status: "Approved", reviewedAt: "2026-09-10T10:00:00+08:00", attendanceDeadlineAt: "2026-09-24T10:00:00+08:00" };
const withDate = (date, time) => ({ ...approved, surrenderAppointment: { date, time } });

test("shows due today, upcoming, and elapsed appointment times in Philippine time", () => {
  assert.equal(getAppointmentMonitor(withDate("2026-09-15", "13:30"), now).state, "today");
  assert.equal(getAppointmentMonitor(withDate("2026-09-15", "09:00"), now).state, "overdue");
  assert.equal(getAppointmentMonitor(withDate("2026-09-16", "09:00"), now).state, "upcoming");
  assert.match(getAppointmentMonitor(withDate("2026-09-12", "09:00"), now).detail, /3 days ago/);
  assert.match(getAppointmentMonitor(withDate("2026-09-15", "13:30"), now).scheduled, /13:30 PHT/);
});

test("uses shelter calendar date across UTC midnight and does not invent a missing time", () => {
  const midnight = new Date("2026-09-14T16:01:00Z");
  assert.equal(getAppointmentMonitor(withDate("2026-09-15"), midnight).state, "today");
  assert.match(getAppointmentMonitor(withDate("2026-09-15"), now).scheduled, /time not set/);
});

test("flags unscheduled requests with approval age and expired deadlines", () => {
  assert.equal(getAppointmentMonitor(approved, now).state, "unscheduled");
  assert.match(getAppointmentMonitor(approved, now).detail, /5 days since approval/);
  assert.equal(getAppointmentMonitor({ ...approved, attendanceDeadlineAt: "2026-09-14T10:00:00+08:00" }, now).state, "overdue");
  assert.equal(getAppointmentMonitor({ ...approved, attendanceDeadlineAt: null }, now).deadlineLabel, "Not set");
});

test("completed and closed requests never create active overdue alerts", () => {
  const past = withDate("2026-09-10", "09:00");
  for (const status of ["Converted", "Expired", "Rejected", "Pending"]) {
    assert.equal(getAppointmentMonitor({ ...past, status }, now).state, "inactive");
  }
  assert.equal(getAppointmentMonitor({ ...past, arrivalConfirmedAt: now.toISOString() }, now).state, "inactive");
});

test("pending reschedule does not replace the confirmed appointment", () => {
  const record = { ...withDate("2026-09-14", "09:00"), surrenderRescheduleRequest: { status: "pending", date: "2026-09-20", time: "13:00" } };
  const result = getAppointmentMonitor(record, now);
  assert.equal(result.state, "overdue");
  assert.equal(result.reschedulePending, true);
  assert.match(result.scheduled, /14/);
});

test("supports legacy dropoff dates and rejects malformed calendar dates", () => {
  assert.equal(getAppointmentMonitor({ ...approved, dropoffDate: "2026-09-15" }, now).state, "today");
  for (const date of ["bad", "2026-02-30", "2026-99-99"]) {
    assert.equal(getAppointmentMonitor(withDate(date), now).state, "unscheduled");
  }
});
