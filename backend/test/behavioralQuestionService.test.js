const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_QUESTIONS,
  REQUIRED_TRAITS,
  validateAndNormalizeBehavioralQuestions,
  validateBehavioralAnswers,
  buildBehavioralQuestionSnapshot,
} = require("../src/services/behavioralQuestionService");

test("default behavioral questions preserve every existing behavior dimension", () => {
  const result = validateAndNormalizeBehavioralQuestions(structuredClone(DEFAULT_QUESTIONS));
  assert.equal(result.error, undefined);
  assert.equal(result.questions.length, 16);
  assert.deepEqual(new Set(result.questions.map((question) => question.traitKey)), new Set(REQUIRED_TRAITS));
});

test("question wording, answer wording, and controlled behavior links can be edited", () => {
  const questions = structuredClone(DEFAULT_QUESTIONS);
  questions[0].text = "Rate the animal's observed daily energy.";
  questions[0].choices[2].text = "Moderate observed energy";
  const firstLink = questions[0].traitKey;
  questions[0].traitKey = questions[1].traitKey;
  questions[1].traitKey = firstLink;
  const result = validateAndNormalizeBehavioralQuestions(questions);
  assert.equal(result.error, undefined);
  assert.equal(result.questions[0].choices[2].value, 3);
  assert.equal(result.questions[0].traitKey, "exerciseNeeds");
});

test("invalid mappings and incomplete scales are rejected", () => {
  const invalidLink = structuredClone(DEFAULT_QUESTIONS);
  invalidLink[0].traitKey = "inventedBehavior";
  assert.match(validateAndNormalizeBehavioralQuestions(invalidLink).error, /invalid behavior link/i);

  const incomplete = structuredClone(DEFAULT_QUESTIONS);
  incomplete[0].choices.pop();
  assert.match(validateAndNormalizeBehavioralQuestions(incomplete).error, /complete 1–5 answer scale/i);

  const duplicateScore = structuredClone(DEFAULT_QUESTIONS);
  duplicateScore[0].choices[0].value = 2;
  assert.match(validateAndNormalizeBehavioralQuestions(duplicateScore).error, /one answer to each score/i);
});

test("reorder is normalized and an active question can only be deactivated with a replacement", () => {
  const reordered = structuredClone(DEFAULT_QUESTIONS).reverse();
  const normalized = validateAndNormalizeBehavioralQuestions(reordered);
  assert.equal(normalized.error, undefined);
  assert.equal(normalized.questions[0].order, 1);

  const unsafe = structuredClone(DEFAULT_QUESTIONS);
  unsafe[0].active = false;
  assert.match(validateAndNormalizeBehavioralQuestions(unsafe).error, /every required behavior dimension/i);

  const safe = structuredClone(DEFAULT_QUESTIONS);
  safe[0].active = false;
  safe.push({ ...structuredClone(safe[0]), id: "energy-replacement", active: true });
  assert.equal(validateAndNormalizeBehavioralQuestions(safe).error, undefined);
});

test("assessment answers use the active configuration and snapshots preserve completed wording", () => {
  const questions = structuredClone(DEFAULT_QUESTIONS);
  questions[0].text = "Current configured energy question";
  questions[0].choices[3].text = "Observed high energy";
  const traits = Object.fromEntries(questions.map((question) => [question.traitKey, 4]));
  const answers = Object.fromEntries(questions.map((question) => [question.id, question.choices[3].id]));
  const validated = validateBehavioralAnswers({ traits, answerSelections: answers }, questions);
  assert.equal(validated.error, undefined);
  const snapshot = buildBehavioralQuestionSnapshot(questions, validated.traits, validated.answerSelections);
  questions[0].text = "Later edited wording";
  assert.equal(snapshot[0].questionText, "Current configured energy question");
  assert.equal(snapshot[0].answerText, "Observed high energy");
});
