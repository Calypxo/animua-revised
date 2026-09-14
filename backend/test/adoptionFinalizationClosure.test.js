const test = require("node:test");
const assert = require("node:assert/strict");
const { loadWithMocks } = require("../test-vitest/helpers/commonjs");

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

// Optimistic transaction double: retries stale reads and stages writes until
// commit. Query revisions also detect a newly created sibling application.
function setup({ failCommit = false, failNotification = false } = {}) {
  const records = new Map();
  const versions = new Map();
  const notifications = [];
  let revision = 0;
  let beforeUpdate;
  function seed(path, data) {
    records.set(path, structuredClone(data));
    versions.set(path, ++revision);
  }
  function snap(reference) {
    const data = structuredClone(records.get(reference.path));
    return { id: reference.id, ref: reference, exists: data !== undefined, updateTime: versions.get(reference.path), data: () => data };
  }
  function ref(path) {
    return {
      path, id: path.split("/").at(-1), get: async function () { return snap(this); },
      update: async function (data, precondition) {
        if (beforeUpdate) { const callback = beforeUpdate; beforeUpdate = null; callback(); }
        if (precondition && precondition.lastUpdateTime !== versions.get(path)) {
          throw Object.assign(new Error("stale document"), { code: 9 });
        }
        seed(path, { ...records.get(path), ...data });
      },
    };
  }
  function query(name, field, value) {
    return { query: true, get: async () => {
      const docs = [...records].filter(([path, data]) => path.startsWith(name + "/") && (!field || data[field] === value))
        .map(([path]) => snap(ref(path)));
      return { docs, size: docs.length, empty: docs.length === 0 };
    } };
  }
  const db = {
    collection: (name) => ({ doc: (id) => ref(`${name}/${id}`), where: (field, _op, value) => query(name, field, value), get: () => query(name).get() }),
    runTransaction: async (callback) => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const reads = new Map();
        const writes = [];
        let queryRevision;
        const result = await callback({
          get: async (reference) => {
            assert.equal(writes.length, 0, "Firestore requires reads before writes");
            if (reference.query) queryRevision = revision;
            else reads.set(reference.path, versions.get(reference.path));
            return reference.get();
          },
          update: (reference, data) => writes.push({ reference, data }),
          create: (reference, data) => writes.push({ reference, data, create: true }),
        });
        if ([...reads].some(([path, version]) => versions.get(path) !== version)
          || (queryRevision !== undefined && queryRevision !== revision)) continue;
        if (failCommit) throw new Error("simulated commit failure");
        if (writes.some(({ reference, create }) => create && records.has(reference.path))) {
          throw Object.assign(new Error("already exists"), { code: 6 });
        }
        for (const { reference, data } of writes) seed(reference.path, { ...records.get(reference.path), ...data });
        return result;
      }
      throw new Error("transaction retry limit");
    },
  };
  const firebase = { db, admin: { firestore: { FieldValue: { serverTimestamp: () => "timestamp", arrayUnion: (value) => [value] } } } };
  const controller = loadWithMocks("../src/controllers/adoptionController", {
    "../src/config/firebase": firebase,
    "../src/services/notificationService": {
      createUserNotification: async (notification) => {
        assert.equal(records.get("animals/PET-1").status, "Adopted", "notify only after commit");
        notifications.push(notification);
        if (failNotification) throw new Error("notification unavailable");
      },
      createManagementNotification: async () => {},
    },
  });
  const deadlines = loadWithMocks("../src/controllers/requestDeadlineController", { "../src/config/firebase": firebase });
  seed("animals/PET-1", { status: "Ready", name: "Shelter animal", visibleToPublic: true });
  seed("adoptions/WINNER", { pet_id: "PET-1", status: "Approved", arrivalConfirmedAt: "2026-09-15T01:00:00Z", applicant: { email: "winner@example.com", full_name: "Winner" } });
  const request = (id = "WINNER") => ({ params: { id }, body: { adoptedName: "Milo", reason: "Reviewed by staff" }, user: { email: "staff@example.com" } });
  return { controller, deadlines, records, notifications, seed, request, beforeUpdate: (callback) => { beforeUpdate = callback; } };
}

test("finalization closes only other active applications and preserves their submitted history", async () => {
  const env = setup();
  for (const status of ["Pending", "Approved", "Under Review", "Rejected", "Expired", "Closed", "Finalized"]) {
    env.seed(`adoptions/${status}`, { pet_id: "PET-1", status, applicant: { email: `${status}@example.com` }, rejectedReason: "Existing decision", pickupSchedule: { date: "2026-09-17" }, noShowRisk: true });
  }
  env.seed("adoptions/OTHER-PET", { pet_id: "PET-2", status: "Pending" });
  const res = response();
  await env.controller.finalizeAdoption(env.request(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.closedApplicationCount, 3);
  assert.equal(env.records.get("animals/PET-1").adoptionApplicationId, "WINNER");
  assert.equal(env.records.get("animals/PET-1").visibleToPublic, false);
  assert.equal(env.records.get("adoptions/WINNER").status, "Finalized");
  for (const status of ["Pending", "Approved", "Under Review"]) {
    const record = env.records.get(`adoptions/${status}`);
    assert.equal(record.status, "Closed");
    assert.equal(record.statusBeforeClosure, status);
    assert.equal(record.closureCode, "ANIMAL_ADOPTED");
    assert.match(record.closureReason, /not a rejection/i);
    assert.equal(record.closedBy, "staff@example.com");
    assert.equal(record.closedByApplicationId, "WINNER");
    assert.ok(record.closedAt);
    assert.equal(record.noShowRisk, false);
    assert.equal(record.deadlineReminderStage, "Completed");
    assert.deepEqual(record.pickupSchedule, { date: "2026-09-17" });
  }
  for (const status of ["Rejected", "Expired", "Closed", "Finalized"]) {
    assert.equal(env.records.get(`adoptions/${status}`).status, status);
    assert.equal(env.records.get(`adoptions/${status}`).closedAt, undefined);
  }
  assert.equal(env.records.get("adoptions/OTHER-PET").status, "Pending");
  assert.equal(env.notifications.length, 4);
  const closures = env.notifications.filter((notification) => notification.type === "adoption_closed");
  assert.equal(closures.length, 3);
  assert.ok(closures.every((notification) => !notification.message.includes("Winner")));
  const details = response();
  await env.controller.getAdoptionById(env.request("Pending"), details);
  assert.equal(details.body.adoption.closureCode, "ANIMAL_ADOPTED");
  assert.equal(details.body.adoption.closedByApplicationId, undefined);
});

test("failed commit leaves the animal and all applications unchanged, with no notifications", async () => {
  const env = setup({ failCommit: true });
  env.seed("adoptions/PENDING", { pet_id: "PET-1", status: "Pending" });
  const before = structuredClone(env.records);
  const res = response();
  await env.controller.finalizeAdoption(env.request(), res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(env.records, before);
  assert.equal(env.notifications.length, 0);
});

test("concurrent finalizations result in one finalized adoption and one closed application", async () => {
  const env = setup();
  env.seed("adoptions/SECOND", { ...env.records.get("adoptions/WINNER"), applicant: { email: "second@example.com" } });
  const responses = [response(), response()];
  await Promise.all([
    env.controller.finalizeAdoption(env.request(), responses[0]),
    env.controller.finalizeAdoption(env.request("SECOND"), responses[1]),
  ]);
  assert.deepEqual(responses.map((res) => res.statusCode).sort(), [200, 400]);
  assert.deepEqual(["WINNER", "SECOND"].map((id) => env.records.get(`adoptions/${id}`).status).sort(), ["Closed", "Finalized"]);
  assert.equal(env.notifications.length, 2);
});

test("notification failure does not undo a successful finalization or invite a duplicate retry", async () => {
  const env = setup({ failNotification: true });
  const first = response();
  await env.controller.finalizeAdoption(env.request(), first);
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.notificationFailures, 1);
  const again = response();
  await env.controller.finalizeAdoption(env.request(), again);
  assert.equal(again.statusCode, 400);
  assert.equal(env.notifications.length, 1);
});

test("an unconfirmed arrival or unavailable animal cannot close other applications", async () => {
  for (const invalid of ["arrival", "animal"]) {
    const env = setup();
    if (invalid === "arrival") env.seed("adoptions/WINNER", { pet_id: "PET-1", status: "Approved" });
    else env.seed("animals/PET-1", { status: "Quarantine" });
    env.seed("adoptions/PENDING", { pet_id: "PET-1", status: "Pending" });
    const before = structuredClone(env.records);
    const res = response();
    await env.controller.finalizeAdoption(env.request(), res);
    assert.ok([400, 409].includes(res.statusCode));
    assert.deepEqual(env.records, before);
    assert.equal(env.notifications.length, 0);
  }
});

test("closed applications cannot be approved, rejected, restored or marked no-show", async () => {
  const env = setup();
  env.seed("adoptions/CLOSED", { pet_id: "PET-1", status: "Closed" });
  for (const handler of [env.controller.approveAdoption, env.controller.rejectAdoption, env.deadlines.restoreAdoptionDeadline, env.deadlines.markAdoptionNoShow]) {
    const res = response();
    await handler(env.request("CLOSED"), res);
    assert.ok([400, 409].includes(res.statusCode));
    assert.equal(env.records.get("adoptions/CLOSED").status, "Closed");
  }
});

test("a stale staff decision cannot overwrite automatic closure", async () => {
  for (const action of ["approveAdoption", "rejectAdoption", "markAdoptionNoShow"]) {
    const env = setup();
    env.seed("adoptions/STALE", { pet_id: "PET-1", status: "Approved" });
    env.beforeUpdate(() => env.seed("adoptions/STALE", { pet_id: "PET-1", status: "Closed" }));
    const res = response();
    await (env.controller[action] || env.deadlines[action])(env.request("STALE"), res);
    assert.equal(res.statusCode, 409);
    assert.equal(env.records.get("adoptions/STALE").status, "Closed");
    assert.equal(env.notifications.length, 0);
  }
});
