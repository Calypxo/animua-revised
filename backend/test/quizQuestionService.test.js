const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_QUESTIONS,
  validateAndNormalizeQuestions,
  validateConfiguredPreferences,
  buildQuestionSnapshot,
} = require("../src/services/quizQuestionService");

test("default compatibility questions form a valid protected configuration", () => {
  const result = validateAndNormalizeQuestions(DEFAULT_QUESTIONS);
  assert.equal(result.error, undefined);
  assert.equal(result.questions.length, 18);
  assert.equal(result.questions.every((question) => question.active), true);
});

test("question text and answer labels can change without changing score mappings", () => {
  const edited = structuredClone(DEFAULT_QUESTIONS);
  edited[0].text = "Which energy level best fits your household?";
  edited[0].choices[0].text = "A very calm companion";
  const result = validateAndNormalizeQuestions(edited);
  assert.equal(result.error, undefined);
  assert.equal(result.questions[0].choices[0].value, 1);
});

test("incomplete and malformed configurations are rejected", () => {
  const missingText = structuredClone(DEFAULT_QUESTIONS);
  missingText[0].text = "";
  assert.match(validateAndNormalizeQuestions(missingText).error, /text cannot be empty/i);

  const invalidScore = structuredClone(DEFAULT_QUESTIONS);
  invalidScore[0].choices[0].value = 8;
  assert.match(validateAndNormalizeQuestions(invalidScore).error, /score from 1 to 5/i);

  const noActiveQuestions = structuredClone(DEFAULT_QUESTIONS).map((question) => ({ ...question, active: false }));
  assert.match(validateAndNormalizeQuestions(noActiveQuestions).error, /one quiz question must remain active/i);
});

test("an inactive draft can safely replace an active question in one save", () => {
  const questions = structuredClone(DEFAULT_QUESTIONS);
  questions[0].active = false;
  questions.push({
    ...structuredClone(questions[0]),
    id: "energyLevel-replacement",
    text: "What activity level should your future pet have?",
    active: true,
  });
  const result = validateAndNormalizeQuestions(questions);
  assert.equal(result.error, undefined);
  assert.equal(result.questions.filter((question) => question.active && question.traitKey === "energyLevel").length, 1);
});

test("result snapshots preserve the wording and selected answer at completion time", () => {
  const preferences = Object.fromEntries(DEFAULT_QUESTIONS.map((question) => [question.traitKey, 3]));
  const snapshot = buildQuestionSnapshot(DEFAULT_QUESTIONS, preferences);
  assert.equal(snapshot.length, 18);
  assert.equal(snapshot[0].questionText, DEFAULT_QUESTIONS[0].text);
  assert.equal(snapshot[0].answerText, DEFAULT_QUESTIONS[0].choices[2].text);
  assert.equal(snapshot[0].value, 3);
});

test("choice IDs preserve exact answer wording when two choices share a score", () => {
  const questions = structuredClone(DEFAULT_QUESTIONS);
  questions[0].choices.push({ id: "energyLevel-alternate", text: "Calm, with short playful bursts", value: 3, order: 6 });
  const preferences = Object.fromEntries(questions.map((question) => [question.traitKey, 3]));
  const snapshot = buildQuestionSnapshot(questions, preferences, { energyLevel: "energyLevel-alternate" });
  assert.equal(snapshot[0].answerText, "Calm, with short playful bursts");
});

test("inactive traits are omitted from saved answers and neutral only inside scoring", () => {
  const questions = structuredClone(DEFAULT_QUESTIONS);
  questions[0].active = false;
  const input = Object.fromEntries(questions.filter((question) => question.active).map((question) => [question.traitKey, 4]));
  const result = validateConfiguredPreferences(input, questions);
  assert.equal(result.error, undefined);
  assert.equal(result.preferences.energyLevel, undefined);
  assert.equal(result.scoringPreferences.energyLevel, 3);
  assert.equal(result.preferences.exerciseNeeds, 4);
});
