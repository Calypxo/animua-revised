const test = require("node:test");
const assert = require("node:assert/strict");
const animalRoutes = require("../src/routes/animalRoutes");

function handlers(method, path) {
  const layer = animalRoutes.stack.find((item) => item.route?.path === path && item.route.methods?.[method]);
  assert.ok(layer, `${method.toUpperCase()} ${path} should exist`);
  return layer.route.stack.map((item) => item.handle);
}

function authorize(method, role) {
  const [roleMiddleware] = handlers(method, "/behavioral-questions");
  let statusCode = 200;
  let nextCalled = false;
  roleMiddleware(
    { user: { role } },
    { status(code) { statusCode = code; return this; }, json() { return this; } },
    () => { nextCalled = true; }
  );
  return { statusCode, nextCalled };
}

test("staff cannot read or modify behavioral question configuration", () => {
  assert.deepEqual(authorize("get", "Staff"), { statusCode: 403, nextCalled: false });
  assert.deepEqual(authorize("put", "Staff"), { statusCode: 403, nextCalled: false });
});

test("administrators and veterinarians can manage behavioral question configuration", () => {
  assert.equal(authorize("get", "Admin").nextCalled, true);
  assert.equal(authorize("put", "Admin").nextCalled, true);
  assert.equal(authorize("get", "Veterinarian").nextCalled, true);
  assert.equal(authorize("put", "Veterinarian").nextCalled, true);
});

test("behavioral question configuration is registered before the dynamic animal id route", () => {
  const staticRouteIndex = animalRoutes.stack.findIndex((item) => item.route?.path === "/behavioral-questions");
  const dynamicRouteIndex = animalRoutes.stack.findIndex((item) => item.route?.path === "/:id");
  assert.ok(staticRouteIndex >= 0, "behavioral configuration route should exist");
  assert.ok(dynamicRouteIndex >= 0, "animal detail route should exist");
  assert.ok(staticRouteIndex < dynamicRouteIndex, "static behavioral route must be matched first");
});
