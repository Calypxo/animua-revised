const test = require("node:test");
const assert = require("node:assert/strict");
const matchRoutes = require("../src/routes/matchRoutes");

function handlers(method, path) {
  const layer = matchRoutes.stack.find((item) => item.route?.path === path && item.route.methods?.[method]);
  assert.ok(layer, `${method.toUpperCase()} ${path} should exist`);
  return layer.route.stack.map((item) => item.handle);
}

test("quiz question writes are forbidden to non-administrator management roles", () => {
  const [, authorizeAdmin] = handlers("put", "/match/admin/questions");
  let statusCode = 200;
  let nextCalled = false;
  authorizeAdmin(
    { user: { role: "Staff" } },
    { status(code) { statusCode = code; return this; }, json() { return this; } },
    () => { nextCalled = true; }
  );
  assert.equal(statusCode, 403);
  assert.equal(nextCalled, false);
});

test("administrators pass quiz question write authorization", () => {
  const [, authorizeAdmin] = handlers("put", "/match/admin/questions");
  let nextCalled = false;
  authorizeAdmin(
    { user: { role: "Admin" } },
    { status() { return this; }, json() { return this; } },
    () => { nextCalled = true; }
  );
  assert.equal(nextCalled, true);
});
