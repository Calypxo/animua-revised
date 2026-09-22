const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const fromTestDirectory = (modulePath) => require.resolve(
  path.resolve(__dirname, "..", modulePath),
);

function loadWithMocks(moduleRelativePath, mocks) {
  const modulePath = fromTestDirectory(moduleRelativePath);
  const saved = new Map();

  for (const [dependencyPath, exports] of Object.entries(mocks)) {
    const resolved = fromTestDirectory(dependencyPath);
    saved.set(resolved, require.cache[resolved]);
    require.cache[resolved] = {
      id: resolved,
      filename: resolved,
      loaded: true,
      exports,
    };
  }

  const originalModule = require.cache[modulePath];
  delete require.cache[modulePath];
  try {
    return require(modulePath);
  } finally {
    delete require.cache[modulePath];
    if (originalModule) require.cache[modulePath] = originalModule;
    for (const [resolved, original] of saved) {
      if (original) require.cache[resolved] = original;
      else delete require.cache[resolved];
    }
  }
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

let record;
let updates;
const requestRef = {
  async get() {
    return {
      id: "SR-ACCEPTED",
      exists: true,
      data: () => record,
    };
  },
  async update(changes) {
    updates.push(changes);
    record = { ...record, ...changes };
  },
};
const db = {
  collection() {
    return { doc: () => requestRef };
  },
};

const controller = loadWithMocks("src/controllers/surrenderController", {
  "src/config/firebase": { db, admin: {} },
  "src/services/surrenderNlpService": {
    analyzeSurrenderReason: async () => ({}),
    buildFallbackAnalysis: () => ({}),
  },
  "src/services/requestDeadlineService": {
    buildApprovalDeadlineFields: () => ({}),
    reconcileRequestDeadlines: async () => ({}),
    validateScheduleDate: () => true,
  },
  "src/services/notificationService": {
    createUserNotification: async () => {},
    createManagementNotification: async () => {},
  },
  "src/services/surrenderWorkflowService": {
    isDirectSurrenderStatusAllowed: () => true,
  },
});

test.beforeEach(() => {
  record = {
    status: "Accepted",
    account: { email: "owner@test.com" },
    attendanceDeadlineAt: "2026-09-12T15:59:59.999Z",
  };
  updates = [];
});

test("an accepted surrender request can save its first appointment", async () => {
  const response = responseRecorder();

  await controller.scheduleMySurrenderAppointment({
    params: { id: "SR-ACCEPTED" },
    user: { email: "owner@test.com" },
    body: { date: "2026-09-05", time: "13:30" },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.message, "Surrender appointment saved.");
  assert.deepEqual(
    {
      date: response.body.surrenderAppointment.date,
      time: response.body.surrenderAppointment.time,
      location: response.body.surrenderAppointment.location,
    },
    {
      date: "2026-09-05",
      time: "13:30",
      location: "Angeles City Veterinary Office, Brgy. Pampang, Angeles City",
    },
  );
  assert.equal(updates.length, 1);
  assert.equal(updates[0].dropoffDate, "2026-09-05");
  assert.equal(updates[0].deadlineStatus, "Appointment Scheduled");
  assert.equal(updates[0].noShowRisk, false);
});

test("appointment scheduling remains unavailable before acceptance", async () => {
  record.status = "Pending";
  const response = responseRecorder();

  await controller.scheduleMySurrenderAppointment({
    params: { id: "SR-PENDING" },
    user: { email: "owner@test.com" },
    body: { date: "2026-09-05", time: "13:30" },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.match(response.body.message, /only accepted/i);
  assert.equal(updates.length, 0);
});

test("drop-off rescheduling remains unavailable after attendance confirmation", async () => {
  record.arrivalConfirmedAt = "2026-08-29T01:00:00.000Z";
  record.surrenderAppointment = {
    date: "2026-09-05",
    time: "13:30",
  };
  const response = responseRecorder();

  await controller.scheduleMySurrenderAppointment({
    params: { id: "SR-ACCEPTED" },
    user: { email: "owner@test.com" },
    body: { date: "2026-09-06", time: "14:30" },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.match(response.body.message, /already been confirmed/i);
  assert.equal(updates.length, 0);
});

test("a surrender date change stays pending until staff approves and cannot be changed twice", async () => {
  record.status = "Approved";
  record.surrenderAppointment = { date: "2026-09-05", time: "09:00" };
  const deadline = record.attendanceDeadlineAt;
  const request = { params: { id: "SR-ACCEPTED" }, user: { email: "owner@test.com" }, body: { date: "2026-09-06", time: "10:00" } };
  const pending = responseRecorder();
  await controller.scheduleMySurrenderAppointment(request, pending);
  assert.equal(pending.statusCode, 200);
  assert.equal(pending.body.requiresApproval, true);
  assert.equal(record.surrenderAppointment.date, "2026-09-05");
  assert.equal(record.surrenderRescheduleRequest.status, "Pending");
  const approved = responseRecorder();
  await controller.approveSurrenderReschedule({ ...request, user: { email: "staff@test.com" } }, approved);
  assert.equal(approved.statusCode, 200);
  assert.equal(record.surrenderAppointment.date, "2026-09-06");
  assert.equal(record.attendanceDeadlineAt, deadline);
  const second = responseRecorder();
  await controller.scheduleMySurrenderAppointment({ ...request, body: { date: "2026-09-07", time: "11:00" } }, second);
  assert.equal(second.statusCode, 400);
  assert.equal(record.surrenderAppointment.date, "2026-09-06");
});
