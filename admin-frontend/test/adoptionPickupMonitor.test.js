import test from "node:test";
import assert from "node:assert/strict";
import { getPickupMonitor } from "../src/management/adoptionPickupMonitor.js";

const now = new Date("2026-09-15T10:00:00+08:00");
const application = { status: "Approved", approvedAt: "2026-09-10T10:00:00+08:00", attendanceDeadlineAt: "2026-09-24T23:59:59+08:00", pickupSchedule: { date: "2026-09-15", time: "09:00" } };

test("a missed pickup remains distinct from the final deadline", () => {
  const missed = getPickupMonitor(application, now);
  assert.equal(missed.label, "Pickup time passed — confirm attendance");
  assert.match(missed.detail, /adopter/);
  const expiredWindow = getPickupMonitor(application, new Date("2026-09-25T00:00:00+08:00"));
  assert.equal(expiredWindow.label, "Final deadline passed");
  assert.equal(application.status, "Approved");
});

test("confirmed arrivals, finalized, closed, and expired applications do not require active follow-up", () => {
  for (const status of ["Finalized", "Closed", "Expired", "Rejected", "Pending"]) {
    assert.equal(getPickupMonitor({ ...application, status }, now).state, "inactive");
  }
  assert.equal(getPickupMonitor({ ...application, arrivalConfirmedAt: now.toISOString() }, now).label, "Arrival confirmed");
  assert.equal(getPickupMonitor({ ...application, status: "Closed" }, now).label, "Application closed");
});

test("an approved but unscheduled adopter shows elapsed days since approval", () => {
  const waiting = getPickupMonitor({ ...application, pickupSchedule: null }, now);
  assert.equal(waiting.state, "unscheduled");
  assert.match(waiting.detail, /5 days since approval/);
});

test("rescheduled pickup uses the saved date and preserves the final deadline", () => {
  const changed = getPickupMonitor({ ...application, pickupSchedule: { date: "2026-09-20", time: "13:00", rescheduleCount: 1 } }, now);
  assert.equal(changed.label, "Scheduled");
  assert.equal(changed.reschedulePending, false);
  assert.equal(changed.deadlineLabel, getPickupMonitor(application, now).deadlineLabel);
  assert.equal(getPickupMonitor({ ...application, pickupSchedule: { date: "2026-09-15", time: "13:00" } }, now).state, "today");
});
