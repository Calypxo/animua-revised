const assert = require("node:assert/strict");
const test = require("node:test");
const { loadWithMocks, responseRecorder, snapshot } = require("../test-vitest/helpers/commonjs");

function mockFunction(implementation = () => undefined) {
  const calls = [];
  const wrapped = function wrappedMock(...args) {
    calls.push(args);
    return implementation.apply(this, args);
  };
  wrapped.mock = { calls };
  return wrapped;
}

global.vi = { fn: mockFunction };

function loadController({ existingAdoptions = [], alwaysEmptyDuplicateQuery = false, animalAdoptedDuringSubmission = false } = {}) {
  const created = new Map();
  const createCalls = [];
  let animalReads = 0;

  const db = {
    runTransaction: async (callback) => {
      const writes = [];
      const result = await callback({
        get: (reference) => reference.get(),
        create: (reference, data) => writes.push(() => reference.create(data)),
      });
      for (const write of writes) await write();
      return result;
    },
    collection: mockFunction((name) => ({
      doc: (id) => {
        if (name === "animals") {
          return { get: mockFunction(async () => snapshot({ status: animalAdoptedDuringSubmission && ++animalReads > 1 ? "Adopted" : "Ready", name: "Buddy" }, id)) };
        }
        return {
          id,
          create: mockFunction(async (data) => {
            createCalls.push([id, data]);
            if (created.has(id)) {
              const error = new Error("Document already exists");
              error.code = 6;
              throw error;
            }
            created.set(id, data);
          }),
        };
      },
      where: (field) => ({
        get: mockFunction(async () => {
          if (field === "pet_id") {
            const docs = alwaysEmptyDuplicateQuery
              ? []
              : existingAdoptions.map((data, index) => ({
                  id: `existing-${index}`,
                  data: () => data,
                }));
            return { docs, empty: docs.length === 0, size: docs.length };
          }
          return { docs: [], empty: true, size: created.size };
        }),
      }),
    })),
  };

  const controller = loadWithMocks("../src/controllers/adoptionController", {
    "../src/config/firebase": {
      db,
      admin: { firestore: { FieldValue: { serverTimestamp: () => "timestamp" } } },
    },
    "../src/services/notificationService": {
      createUserNotification: mockFunction(async () => undefined),
      createManagementNotification: mockFunction(async () => undefined),
    },
  });

  return { controller, created, createCalls };
}

function adoptionRequest(user = { id: "USER-1", email: "user@example.com" }) {
  return {
    user,
    body: {
      pet_id: "PET-1",
      pet_name: "Buddy",
      full_name: "Sample User",
      application_reference: "LOCAL-REFERENCE",
    },
  };
}

test("an existing application blocks the same user from applying for the same pet", async () => {
  const { controller, createCalls } = loadController({
    existingAdoptions: [{
      pet_id: "PET-1",
      applicationId: "APP-2026-001",
      applicant: { email: "user@example.com" },
    }],
  });
  const response = responseRecorder();

  await controller.createAdoption(adoptionRequest(), response);

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, "DUPLICATE_ADOPTION_APPLICATION");
  assert.match(response.body.message, /already submitted/i);
  assert.equal(createCalls.length, 0);
});

test("simultaneous applications for one user and pet create only one record", async () => {
  const { controller, created, createCalls } = loadController({
    alwaysEmptyDuplicateQuery: true,
  });
  const first = responseRecorder();
  const second = responseRecorder();

  await Promise.all([
    controller.createAdoption(adoptionRequest(), first),
    controller.createAdoption(adoptionRequest(), second),
  ]);

  assert.deepEqual([first.statusCode, second.statusCode].sort(), [201, 409]);
  assert.equal(created.size, 1);
  assert.equal(new Set(createCalls.map(([id]) => id)).size, 1);
});

test("a form submitted while the animal is finalized cannot create a late pending application", async () => {
  const { controller, created } = loadController({ animalAdoptedDuringSubmission: true });
  const response = responseRecorder();
  await controller.createAdoption(adoptionRequest(), response);
  assert.equal(response.statusCode, 409);
  assert.match(response.body.message, /no longer available/i);
  assert.equal(created.size, 0);
});
