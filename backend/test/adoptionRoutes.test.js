const test = require("node:test");
const assert = require("node:assert/strict");

const adoptionRoutes = require("../src/routes/adoptionRoutes");

function adoptionSubmissionHandlers() {
  const submissionRoute = adoptionRoutes.stack.find(
    (layer) => layer.route?.path === "/" && layer.route.methods?.post
  );

  assert.ok(submissionRoute, "adoption submission route should exist");
  return submissionRoute.route.stack.map((layer) => layer.handle);
}

test("adoption submission rejects requests without authentication", async () => {
  const [authenticateToken] = adoptionSubmissionHandlers();
  let statusCode = 200;
  let responseBody;
  let nextCalled = false;

  const req = { headers: {} };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  await authenticateToken(req, res, () => {
    nextCalled = true;
  });

  assert.equal(statusCode, 401);
  assert.equal(nextCalled, false);
  assert.match(responseBody.message, /access denied/i);
});
