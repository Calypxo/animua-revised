const test = require("node:test");
const assert = require("node:assert/strict");
const { loadWithMocks } = require("../test-vitest/helpers/commonjs");

function harness(record) {
  let writes = 0;
  const ref = {
    get: async () => ({ exists: true, updateTime: 1, data: () => ({ ...record }) }),
    update: async changes => { Object.assign(record, changes); writes++; },
  };
  const controller = loadWithMocks("../src/controllers/requestDeadlineController", {
    "../src/config/firebase": { db: { collection: () => ({ doc: () => ref }) }, admin: {} },
  });
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  return { controller, res, writes: () => writes, req: { params: { id: "TEST" }, body: { reason: "Test follow-up" }, user: { email: "staff@example.test" } } };
}

for (const kind of ["Adoption", "Surrender"]) {
  test(`${kind}: confirmed attendance cannot be marked no-show`, async () => {
    const record = { status: "Approved", arrivalConfirmedAt: "2026-09-15T01:00:00Z" };
    const env = harness(record);
    await env.controller[`mark${kind}NoShow`](env.req, env.res);
    assert.equal(env.res.statusCode, 400);
    assert.equal(env.writes(), 0);
    assert.equal(record.status, "Approved");
  });
  test(`${kind}: staff can close an approved request with unconfirmed arrival`, async () => {
    const record = { status: "Approved", arrivalConfirmedAt: null };
    const env = harness(record);
    await env.controller[`mark${kind}NoShow`](env.req, env.res);
    assert.equal(env.res.statusCode, 200);
    assert.equal(record.status, "Expired");
  });
}
