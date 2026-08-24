import assert from "node:assert/strict";
import test from "node:test";

import {
  compareEventDates,
  isUpcomingEventDate,
  parseEventDate,
} from "../src/public/js/announcement-date-utils.js";

const now = new Date(2026, 7, 24, 18, 30);

test("past announcements are not treated as upcoming events", () => {
  assert.equal(isUpcomingEventDate("2026-08-16", now), false);
});

test("events later today remain upcoming until the day ends", () => {
  assert.equal(isUpcomingEventDate("2026-08-24", now), true);
});

test("future events remain upcoming", () => {
  assert.equal(isUpcomingEventDate("2026-09-02", now), true);
});

test("date-only values are parsed in local time and upcoming events sort nearest first", () => {
  assert.deepEqual(
    ["2026-09-10", "2026-08-25", "2026-09-01"].sort(compareEventDates),
    ["2026-08-25", "2026-09-01", "2026-09-10"],
  );
  assert.equal(parseEventDate("invalid"), null);
});
