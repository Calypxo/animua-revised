const assert = require("node:assert/strict");
const test = require("node:test");
const { loadWithMocks, responseRecorder, snapshot } = require("../test-vitest/helpers/commonjs");

function mockFunction(implementation = () => undefined) {
  let activeImplementation = implementation;
  const calls = [];
  const wrapped = function wrappedMock(...args) {
    calls.push(args);
    return activeImplementation.apply(this, args);
  };
  wrapped.mock = { calls };
  wrapped.mockResolvedValue = (value) => {
    activeImplementation = async () => value;
    return wrapped;
  };
  return wrapped;
}

global.vi = { fn: mockFunction };

const records = new Map();
const updates = [];

function documentRef(collection, id) {
  const key = `${collection}/${id}`;
  return {
    get: mockFunction(async () => snapshot(records.get(key), id)),
    update: mockFunction(async (change) => {
      records.set(key, { ...(records.get(key) || {}), ...change });
      updates.push(change);
    }),
  };
}

const db = {
  collection: mockFunction((name) => ({
    doc: (id) => documentRef(name, id),
    where: () => ({ get: mockFunction(async () => ({ size: 0 })) }),
  })),
  batch: mockFunction(() => ({ update: mockFunction(), commit: mockFunction(async () => undefined) })),
  runTransaction: mockFunction(async (callback) => callback({
    get: (ref) => ref.get(),
    update: (ref, change) => ref.update(change),
  })),
};

const controller = loadWithMocks("../src/controllers/adoptionController", {
  "../src/config/firebase": {
    db,
    admin: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "timestamp",
          arrayUnion: (value) => value,
        },
      },
    },
  },
  "../src/services/notificationService": {
    createUserNotification: mockFunction(async () => undefined),
    createManagementNotification: mockFunction(async () => undefined),
  },
});

function request(date, time) {
  return {
    params: { id: "APP-LIMIT" },
    body: { date, time },
    user: { email: "owner@test.com" },
  };
}

test("the backend persists two pickup reschedules and rejects the third", async () => {
  records.clear();
  updates.length = 0;

  const now = new Date();
  const date = (days) => new Date(now.getTime() + days * 86400000).toISOString().slice(0, 10);
  records.set("adoptions/APP-LIMIT", {
    status: "Approved",
    applicant: { email: "owner@test.com" },
    attendanceDeadlineAt: new Date(now.getTime() + 10 * 86400000).toISOString(),
    pickupSchedule: {
      date: date(1),
      time: "09:00",
      scheduledAt: now.toISOString(),
    },
  });

  const first = responseRecorder();
  await controller.scheduleMyAdoptionPickup(request(date(2), "10:00"), first);
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.pickupSchedule.rescheduleCount, 1);
  assert.equal(first.body.reschedulesRemaining, 1);

  const second = responseRecorder();
  await controller.scheduleMyAdoptionPickup(request(date(3), "13:30"), second);
  assert.equal(second.statusCode, 200);
  assert.equal(second.body.pickupSchedule.rescheduleCount, 2);
  assert.equal(second.body.reschedulesRemaining, 0);
  assert.equal(second.body.pickupSchedule.rescheduleHistory.length, 2);

  const third = responseRecorder();
  await controller.scheduleMyAdoptionPickup(request(date(4), "14:30"), third);
  assert.equal(third.statusCode, 400);
  assert.match(third.body.message, /only be rescheduled twice/i);

  const storedSchedule = records.get("adoptions/APP-LIMIT").pickupSchedule;
  assert.equal(storedSchedule.rescheduleCount, 2);
  assert.equal(storedSchedule.rescheduleHistory.length, 2);
});

test("the backend rejects pickup rescheduling after attendance confirmation", async () => {
  records.clear();
  updates.length = 0;

  const now = new Date();
  const nextDate = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
  records.set("adoptions/APP-LIMIT", {
    status: "Approved",
    applicant: { email: "owner@test.com" },
    attendanceDeadlineAt: new Date(now.getTime() + 10 * 86400000).toISOString(),
    arrivalConfirmedAt: now.toISOString(),
    pickupSchedule: {
      date: nextDate,
      time: "09:00",
      scheduledAt: now.toISOString(),
    },
  });

  const response = responseRecorder();
  await controller.scheduleMyAdoptionPickup(request(nextDate, "10:00"), response);

  assert.equal(response.statusCode, 400);
  assert.match(response.body.message, /already been confirmed/i);
  assert.equal(updates.length, 0);
});
