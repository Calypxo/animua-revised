const test = require("node:test");
const assert = require("node:assert/strict");
const { DEFAULT_QUESTIONS, validateQuestionWordingEdits, hasCustomWording } = require("../src/services/quizQuestionService");
const { cloneDefaultQuestions, withoutLegacySpecialNeeds, validateAndNormalizeBehavioralQuestions } = require("../src/services/behavioralQuestionService");
const { getSpecialNeedsStatus, validateSpecialNeeds } = require("../src/services/specialNeedsService");
const { applyFilters, scoreMatches, scoreMatchesLocally, RAW_QUESTION_KEYS, SCORING_VERSION } = require("../src/services/compatibilityScoringService");
const { loadWithMocks } = require("../test-vitest/helpers/commonjs");

test("wording edits preserve the full fixed questionnaire contract", () => {
  const edited = structuredClone(DEFAULT_QUESTIONS);
  edited[0].text = "What energy level would fit your household?";
  edited[0].label = "Preferred energy";
  edited[0].hint = "Consider your household's routine.";
  edited[0].choices[0].text = "A very calm pet";
  assert.equal(validateQuestionWordingEdits(edited, DEFAULT_QUESTIONS).error, undefined);
  assert.equal(hasCustomWording(edited[0]), true);
  assert.equal(hasCustomWording(DEFAULT_QUESTIONS[0]), false);
  const mutations = [
    questions => questions.push(structuredClone(questions[0])),
    questions => questions.pop(),
    questions => questions.reverse(),
    questions => { questions[0].active = false; },
    questions => { questions[0].id = "new-id"; },
    questions => { questions[0].traitKey = "exerciseNeeds"; },
    questions => { questions[0].phaseKey = "social"; },
    questions => { questions[0].order = 2; },
    questions => questions[0].choices.pop(),
    questions => questions[0].choices.reverse(),
    questions => { questions[0].choices[0].value = 5; },
    questions => { questions[0].choices[0].id = "new-answer"; },
    questions => { questions[0].choices[0].order = 3; },
  ];
  for (const mutate of mutations) {
    const questions = structuredClone(DEFAULT_QUESTIONS);
    mutate(questions);
    assert.match(validateQuestionWordingEdits(questions, DEFAULT_QUESTIONS).error, /only wording/i);
  }
});

test("legacy behavior configurations retain wording while retiring the numeric care question", () => {
  const questions = cloneDefaultQuestions();
  questions[0].text = "Custom energy wording";
  questions.push({ ...questions[0], id: "specialNeeds", traitKey: "specialNeeds" });
  const normalized = validateAndNormalizeBehavioralQuestions(withoutLegacySpecialNeeds(questions));
  assert.equal(normalized.error, undefined);
  assert.equal(normalized.questions.length, 16);
  assert.equal(normalized.questions[0].text, "Custom energy wording");
  assert.ok(!normalized.questions.some(question => question.traitKey === "specialNeeds"));
});

test("only explicit statuses or legacy booleans confirm special needs", () => {
  for (const score of [1, 2, 3, 4, 5]) {
    assert.equal(getSpecialNeedsStatus({ behavioralAssessment: { specialNeeds: score } }), "unknown");
    assert.equal(getSpecialNeedsStatus({ specialNeeds: score }), "unknown");
  }
  assert.equal(getSpecialNeedsStatus({ specialNeeds: false }), "no");
  assert.equal(getSpecialNeedsStatus({ specialNeeds: true }), "yes");
  assert.equal(getSpecialNeedsStatus({ specialNeedsStatus: "no", specialNeeds: true }), "no");
  assert.equal(getSpecialNeedsStatus({ specialNeedsStatus: "unknown", specialNeeds: false }), "unknown");
  assert.equal(getSpecialNeedsStatus({}), "unknown");
});

test("special-needs status validates care notes and keeps omitted existing status", () => {
  assert.match(validateSpecialNeeds({ specialNeedsStatus: 5 }).error, /choose/i);
  assert.match(validateSpecialNeeds({ specialNeedsStatus: "yes", specialNeedsNotes: "  " }).error, /describe/i);
  assert.match(validateSpecialNeeds({ specialNeedsStatus: "yes", specialNeedsNotes: "x".repeat(1001) }).error, /1,000/i);
  const existing = { specialNeedsStatus: "yes", specialNeedsNotes: "Daily mobility assistance." };
  assert.deepEqual(validateSpecialNeeds({}, existing), existing);
  assert.deepEqual(validateSpecialNeeds({ specialNeedsStatus: "no" }, existing), { specialNeedsStatus: "no", specialNeedsNotes: "" });
});

test("declining special needs includes only confirmed no; accepting preserves all care statuses", () => {
  const animals = [
    { id: "no", specialNeedsStatus: "no", behavioralAssessment: { specialNeeds: 5 } },
    { id: "yes", specialNeedsStatus: "yes", behavioralAssessment: { specialNeeds: 1 } },
    { id: "unknown" },
    { id: "legacy", behavioralAssessment: { specialNeeds: 1 } },
    { id: "legacy-no", specialNeeds: false },
  ].map(animal => ({ status: "Ready", ...animal }));
  const filters = { preferredSpecies: "Any", preferredSex: "Any", needAllergyFriendly: "no", acceptSpecialNeeds: "no" };
  assert.deepEqual(applyFilters(animals, filters).map(animal => animal.id), ["no", "legacy-no"]);
  assert.equal(applyFilters(animals, { ...filters, acceptSpecialNeeds: "yes" }).length, 5);
});

test("legacy special-needs scores and vet budget cannot affect behavior ranking", () => {
  const preferences = Object.fromEntries(RAW_QUESTION_KEYS.map(key => [key, 3]));
  const animals = [1, 5].map(value => ({ id: String(value), specialNeedsStatus: "yes", behavioralAssessment: { specialNeeds: value } }));
  const scores = scoreMatchesLocally(preferences, animals).matches.map(animal => animal.matchPercent);
  assert.deepEqual(scores, [100, 100]);
  preferences.healthRiskLevel = 1;
  assert.deepEqual(scoreMatchesLocally(preferences, animals).matches.map(animal => animal.matchPercent), scores);
});

test("an old deployed Python matcher falls back until its scoring contract is updated", async () => {
  const preferences = Object.fromEntries(RAW_QUESTION_KEYS.map(key => [key, 3]));
  const animals = [{ id: "pet", specialNeedsStatus: "no", behavioralAssessment: {} }];
  const options = { logger: { info() {}, warn() {} }, fetchImpl: async () => ({ ok: true, json: async () => ({ matches: [{ id: "old", matchPercent: 12 }] }) }) };
  assert.deepEqual(await scoreMatches(preferences, animals, 5, options), scoreMatchesLocally(preferences, animals));
  const expected = { scoringVersion: SCORING_VERSION, matches: [{ id: "pet", matchPercent: 100 }] };
  options.fetchImpl = async () => ({ ok: true, json: async () => expected });
  assert.deepEqual(await scoreMatches(preferences, animals, 5, options), expected);
});

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function animalController(existing, writes, audits) {
  const db = { collection: name => ({
    doc: id => ({ id, collection: name, get: async () => name === "animals" ? { exists: true, data: () => existing } : { exists: false }, update: async data => writes.push(data) }),
    add: async data => audits.push(data),
  }), runTransaction: async callback => callback({ get: ref => ref.get(), update: (ref, data) => writes.push(data), set: (ref, data) => audits.push(data) }) };
  return loadWithMocks("../src/controllers/animalController", {
    "../src/config/firebase": { db, admin: { firestore: { FieldValue: { serverTimestamp: () => "now", arrayUnion: (...values) => values, delete: () => "delete" } } } },
    "../src/services/inventoryAlertService": { notifyIfInventoryLevelWorsened: async () => {} },
  });
}

test("assessment API snapshots medical care without changing the animal care status", async () => {
  const writes = [], audits = [];
  const controller = animalController({ status: "Quarantine", specialNeedsStatus: "yes", specialNeedsNotes: "Daily mobility assistance.", behavioralAssessment: { specialNeeds: 4 } }, writes, audits);
  const body = { traits: Object.fromEntries(cloneDefaultQuestions().map(question => [question.traitKey, 3])), configurationVersion: 1 };
  const res = response();
  await controller.saveBehavioralAssessment({ params: { id: "pet" }, user: { role: "Veterinarian", email: "vet@example.com" }, body }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(writes.length, 1);
  assert.ok(!Object.hasOwn(writes[0], "specialNeedsStatus"));
  assert.ok(!Object.hasOwn(writes[0], "specialNeedsNotes"));
  assert.equal(writes[0].behavioralAssessment.specialNeeds, undefined);
  assert.equal(writes[0].compatibilityVector.length, 16);
  assert.equal(writes[0].legacySpecialNeedsRating, 4);
  assert.equal(writes[0].behavioralAssessmentHistory[0].specialNeedsNotes, "Daily mobility assistance.");
  assert.equal(audits[0].after.specialNeedsStatus, "yes");
});

test("assessment API redirects cached clients to medical care without writing", async () => {
  const writes = [];
  const controller = animalController({ status: "Ready" }, writes, []);
  const res = response();
  await controller.saveBehavioralAssessment({ params: { id: "pet" }, body: { traits: Object.fromEntries(cloneDefaultQuestions().map(question => [question.traitKey, 3])), specialNeedsStatus: "yes" } }, res);
  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /medical record/i);
  assert.equal(writes.length, 0);
});

const careUser = { role: "Veterinarian", fullName: "Test Vet", email: "vet@example.com" };
const medicalBody = { type: "Checkup", date: "2026-09-14", weight: null, inventoryItemId: "", quantityUsed: 0 };

test("medical care saves atomically with the visit and audit without changing behavior scores", async () => {
  const writes = [], audits = [];
  const existing = { status: "Quarantine", behavioralAssessment: { energyLevel: 3 }, medicalRecords: [] };
  const controller = animalController(existing, writes, audits);
  const care = { specialNeedsStatus: "yes", specialNeedsNotes: "Daily mobility assistance." };
  const res = response();
  await controller.addMedicalRecord({ params: { id: "pet" }, user: careUser, body: { ...medicalBody, ...care, specialNeedsBaseline: { specialNeedsStatus: "unknown", specialNeedsNotes: "" } } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].specialNeedsStatus, "yes");
  assert.equal(writes[0].specialNeedsNotes, care.specialNeedsNotes);
  assert.equal(writes[0].medicalRecords[0].specialNeedsStatus, "yes");
  assert.equal(writes[0].medicalRecords[0].specialNeedsNotes, care.specialNeedsNotes);
  assert.equal(writes[0].medicalRecords[0].vet, careUser.fullName);
  assert.ok(!Object.hasOwn(writes[0], "behavioralAssessment"));
  assert.equal(audits[0].before.specialNeedsStatus, "unknown");
  assert.equal(audits[0].after.specialNeedsStatus, "yes");
});

test("editing a medical record updates care and clears obsolete instructions when no is chosen", async () => {
  const writes = [], audits = [];
  const existing = { status: "Quarantine", specialNeedsStatus: "yes", specialNeedsNotes: "Old care.", medicalRecords: [
    { id: "visit", ...medicalBody, specialNeedsStatus: "yes", specialNeedsNotes: "Old care." },
    { id: "clearance", type: "Quarantine Clearance", date: "2026-09-14", clearance: "Cleared" },
  ] };
  const controller = animalController(existing, writes, audits);
  const res = response();
  await controller.updateMedicalRecord({ params: { id: "pet", medicalId: "visit" }, user: careUser, body: { ...medicalBody, specialNeedsStatus: "no", specialNeedsBaseline: { specialNeedsStatus: "yes", specialNeedsNotes: "Old care." } } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].specialNeedsStatus, "no");
  assert.equal(writes[0].specialNeedsNotes, "");
  assert.equal(writes[0].medicalRecords[0].specialNeedsNotes, "");
  assert.equal(writes[0].quarantineClearance, "Cleared");
  assert.equal(audits[0].before.specialNeedsStatus, "yes");
  assert.equal(audits[0].after.specialNeedsStatus, "no");
});

for (const operation of ["addMedicalRecord", "updateMedicalRecord"]) {
  test(`${operation} preserves current care when only visit details change`, async () => {
    const writes = [];
    const existing = { status: "Quarantine", specialNeedsStatus: "yes", specialNeedsNotes: "Current care.", medicalRecords: [{ id: "visit", ...medicalBody, specialNeedsStatus: "no", specialNeedsNotes: "" }] };
    const controller = animalController(existing, writes, []);
    const res = response();
    await controller[operation]({ params: { id: "pet", medicalId: "visit" }, user: careUser, body: { ...medicalBody, diagnosis: "Routine checkup" } }, res);
    assert.equal(res.statusCode, operation === "addMedicalRecord" ? 201 : 200);
    assert.ok(!Object.hasOwn(writes[0], "specialNeedsStatus"));
    assert.ok(!Object.hasOwn(writes[0], "specialNeedsNotes"));
    assert.equal(writes[0].medicalRecords[0].specialNeedsStatus, "no");
  });

  test(`${operation} rejects invalid or stale care before any writes`, async () => {
    for (const [care, status] of [
      [{ specialNeedsStatus: "yes", specialNeedsNotes: "" }, 400],
      [{ specialNeedsStatus: 5 }, 400],
      [{ specialNeedsStatus: "yes", specialNeedsNotes: "x".repeat(1001) }, 400],
      [{ specialNeedsStatus: "no", specialNeedsBaseline: { specialNeedsStatus: "unknown", specialNeedsNotes: "" } }, 409],
    ]) {
      const writes = [], audits = [];
      const existing = { status: "Quarantine", specialNeedsStatus: "yes", specialNeedsNotes: "Latest care.", medicalRecords: [{ id: "visit", ...medicalBody }] };
      const controller = animalController(existing, writes, audits);
      const res = response();
      await controller[operation]({ params: { id: "pet", medicalId: "visit" }, user: careUser, body: { ...medicalBody, ...care } }, res);
      assert.equal(res.statusCode, status);
      assert.equal(writes.length, 0);
      assert.equal(audits.length, 0);
    }
  });
}

test("question API rejects structural and stale writes and publishes wording for public quizzes", async () => {
  let savedQuestions = structuredClone(DEFAULT_QUESTIONS);
  let version = 1;
  const writes = [];
  const db = {
    collection: name => ({ doc: id => ({ id, name, get: async () => ({ exists: true, data: () => name === "quizQuestionConfigs" ? { questions: savedQuestions, version } : { quizVersion: version } }) }), add: async () => {} }),
    runTransaction: async callback => callback({ get: ref => ref.get(), set: (ref, data) => writes.push({ ref, data }) }),
  };
  const controller = loadWithMocks("../src/controllers/matchController", {
    "../src/config/firebase": { db, admin: { firestore: { FieldValue: { serverTimestamp: () => "now" } } } },
    "../src/services/notificationService": { createManagementNotification: async () => {} },
  });
  const request = questions => ({ user: { id: "admin", email: "admin@example.com", fullName: "Admin" }, body: { questions, version: 1 } });
  const structural = structuredClone(savedQuestions);
  structural[0].choices[0].value = 5;
  const rejected = response();
  await controller.replaceAdminQuestions(request(structural), rejected);
  assert.equal(rejected.statusCode, 400);
  assert.equal(writes.length, 0);
  const edited = structuredClone(savedQuestions);
  edited[0].text = "What energy level fits your home?";
  const accepted = response();
  await controller.replaceAdminQuestions(request(edited), accepted);
  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.body.version, 2);
  assert.equal(writes.length, 2);
  savedQuestions = accepted.body.questions;
  version = 2;
  const stale = response();
  await controller.replaceAdminQuestions(request(edited), stale);
  assert.equal(stale.statusCode, 409);
  assert.equal(writes.length, 2);
  const publicQuiz = response();
  await controller.getQuizQuestions({}, publicQuiz);
  assert.equal(publicQuiz.body.questions[0].text, edited[0].text);
  assert.equal(publicQuiz.body.questions[0].customWording, true);
});
