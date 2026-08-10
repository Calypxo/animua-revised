const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { createPredictiveRouter } = require("../src/routes/predictiveRouterFactory");

function authenticate(req, res, next) {
  const role = req.headers["x-test-role"];
  if (!role) return res.status(401).json({ message: "Authentication required." });
  req.user = { role };
  return next();
}

function authorize(...roles) {
  return (req, res, next) => roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ message: "Forbidden." });
}

const controller = {
  getStatus: (_req, res) => res.json({ ok: true }),
  getItems: (_req, res) => res.json({ items: [] }),
  predictLiveItems: (req, res) => res.json({ received: req.body.items.length }),
};

async function withServer(run) {
  const app = express();
  app.use(express.json());
  app.use("/api/predictive", createPredictiveRouter({ authenticate, authorize, controller }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("predictive endpoints require authentication and a management role", async () => {
  await withServer(async (baseUrl) => {
    const anonymous = await fetch(`${baseUrl}/api/predictive/status`);
    assert.equal(anonymous.status, 401);

    const publicUser = await fetch(`${baseUrl}/api/predictive/status`, {
      headers: { "x-test-role": "Public" },
    });
    assert.equal(publicUser.status, 403);

    for (const role of ["Admin", "Staff", "Veterinarian"]) {
      const allowed = await fetch(`${baseUrl}/api/predictive/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-test-role": role },
        body: JSON.stringify({ items: [{ id: role }] }),
      });
      assert.equal(allowed.status, 200);
      assert.deepEqual(await allowed.json(), { received: 1 });
    }
  });
});
