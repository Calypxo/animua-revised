const test = require("node:test");
const assert = require("node:assert/strict");
const authRoutes = require("../src/routes/authRoutes");
const userRoutes = require("../src/routes/userRoutes");
const authController = require("../src/controllers/authController");
const authorizeRole = require("../src/middleware/roleMiddleware");

function routeHandlers(router, method, path) {
  const layer = router.stack.find((item) => item.route?.path === path && item.route.methods?.[method]);
  assert.ok(layer, `${method.toUpperCase()} ${path} should exist`);
  return layer.route.stack.map((item) => item.handle);
}

test("management self-service recovery routes are public and use dedicated controllers", () => {
  assert.deepEqual(routeHandlers(authRoutes, "post", "/management/request-password-reset-otp"), [authController.requestManagementPasswordResetOtp]);
  assert.deepEqual(routeHandlers(authRoutes, "post", "/management/verify-password-reset-otp"), [authController.verifyManagementPasswordResetOtp]);
  assert.deepEqual(routeHandlers(authRoutes, "post", "/management/reset-password"), [authController.completeManagementPasswordReset]);
});

test("existing public recovery endpoints remain connected to their original controllers", () => {
  assert.deepEqual(routeHandlers(authRoutes, "post", "/request-forgot-password-otp"), [authController.requestForgotPasswordOtp]);
  assert.deepEqual(routeHandlers(authRoutes, "post", "/confirm-forgot-password-otp"), [authController.confirmForgotPasswordOtp]);
});

test("admin-assisted reset route sends recovery instead of accepting a replacement password", () => {
  assert.deepEqual(routeHandlers(userRoutes, "patch", "/:id/reset-password"), [authController.sendManagementPasswordResetByAdmin]);
});

test("admin-assisted recovery authorization rejects Staff and permits Admin", () => {
  const middleware = authorizeRole("Admin");
  const invoke = (role) => {
    let statusCode = 200;
    let nextCalled = false;
    middleware(
      { user: { role } },
      { status(code) { statusCode = code; return this; }, json() { return this; } },
      () => { nextCalled = true; }
    );
    return { statusCode, nextCalled };
  };
  assert.deepEqual(invoke("Staff"), { statusCode: 403, nextCalled: false });
  assert.deepEqual(invoke("Veterinarian"), { statusCode: 403, nextCalled: false });
  assert.deepEqual(invoke("Admin"), { statusCode: 200, nextCalled: true });
});
