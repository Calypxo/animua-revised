const assert = require("node:assert/strict");
const test = require("node:test");
const { loadWithMocks } = require("../test-vitest/helpers/commonjs");

function createHarness(type, { pendingReschedule = false } = {}) {
  const collectionName = type === "surrender" ? "surrenderRequests" : "adoptions";
  const requestId = type === "surrender" ? "SURRENDER-NO-SHOW" : "ADOPTION-NO-SHOW";
  let request = {
    status: "Approved",
    approvedAt: "2026-08-01T00:00:00.000Z",
    attendanceDeadlineAt: "2026-08-15T15:59:59.999Z",
    deadlineDays: 14,
    deadlineStatus: pendingReschedule ? "Reschedule Pending" : "Appointment Scheduled",
    deadlineReminderStage: "Approved",
    noShowRisk: false,
    account: { email: "client@test.com", role: "Public" },
    ...(pendingReschedule
      ? {
          [type === "surrender" ? "surrenderRescheduleRequest" : "pickupRescheduleRequest"]: {
            status: "Pending",
            date: "2026-08-20",
          },
        }
      : {}),
  };
  let user = {
    email: "client@test.com",
    role: "Public",
    status: "Active",
    sessionVersion: 4,
  };
  let userUpdateCount = 0;

  const requestRef = {
    update: async (changes) => { request = { ...request, ...changes }; },
  };
  const userRef = {
    get: async () => ({ exists: true, data: () => user }),
    update: async (changes) => {
      userUpdateCount += 1;
      user = { ...user, ...changes };
    },
  };
  const db = {
    collection(name) {
      if (name === "users") {
        return { doc: (id) => {
          assert.equal(id, "client@test.com");
          return userRef;
        } };
      }
      assert.equal(name, collectionName);
      return {
        where(field, operator, statuses) {
          assert.equal(field, "status");
          assert.equal(operator, "in");
          assert.deepEqual(statuses, ["Approved", "Expired"]);
          return {
            get: async () => ({
              size: 1,
              docs: [{ id: requestId, data: () => request, ref: requestRef }],
            }),
          };
        },
      };
    },
  };

  return {
    service: loadWithMocks("../src/services/requestDeadlineService", {
      "../src/config/firebase": { db },
    }),
    getRequest: () => request,
    getUser: () => user,
    getUserUpdateCount: () => userUpdateCount,
  };
}

for (const type of ["adoption", "surrender"]) {
  test(`the 14-day ${type} no-show automatically disables the public account`, async () => {
    const originalEnvironment = process.env.APP_ENVIRONMENT;
    process.env.APP_ENVIRONMENT = "production";
    try {
      const harness = createHarness(type, { pendingReschedule: type === "surrender" });
      const result = await harness.service.reconcileRequestDeadlines(
        type,
        new Date("2026-08-16T00:00:00.000Z")
      );

      assert.deepEqual(result, {
        checked: 1,
        updated: 1,
        expired: 1,
        accountsDisabled: 1,
      });
      assert.equal(harness.getRequest().status, "Expired");
      assert.equal(harness.getRequest().accountDisabledEmail, "client@test.com");
      assert.equal(harness.getUser().status, "Inactive");
      assert.equal(harness.getUser().sessionVersion, 5);
      assert.equal(harness.getUser().disabledBy, "system:attendance-deadline");

      await harness.service.reconcileRequestDeadlines(
        type,
        new Date("2026-08-16T01:00:00.000Z")
      );
      assert.equal(harness.getUserUpdateCount(), 1);
    } finally {
      if (originalEnvironment === undefined) delete process.env.APP_ENVIRONMENT;
      else process.env.APP_ENVIRONMENT = originalEnvironment;
    }
  });
}
