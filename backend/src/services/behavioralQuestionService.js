const BEHAVIOR_GROUPS = Object.freeze({
  activity: { key: "activity", label: "Activity & routine" },
  social: { key: "social", label: "Social comfort" },
  home: { key: "home", label: "Home fit" },
  safety: { key: "safety", label: "Support & safety" },
});

const definitions = [
  ["energyLevel", "activity", "Energy Level", "Overall energy of the animal"],
  ["exerciseNeeds", "activity", "Exercise Needs", "Amount of exercise the animal needs"],
  ["playfulness", "activity", "Playfulness", "Interest in play and interaction"],
  ["attentionNeeds", "activity", "Attention Needs", "How much daily attention the animal needs"],
  ["friendlinessToHumans", "social", "Friendliness to Humans", "How friendly the animal is with people"],
  ["goodWithKids", "social", "Good with Kids", "Suitability around children"],
  ["goodWithOtherPets", "social", "Good with Other Pets", "Compatibility with other pets"],
  ["strangerTolerance", "social", "Stranger Tolerance", "Comfort level around unfamiliar people"],
  ["affectionLevel", "social", "Affection Level", "Desire for closeness and affection"],
  ["independenceLevel", "home", "Independence Level", "Comfort being alone or self-directed"],
  ["noiseLevel", "home", "Noise Level", "How noisy or vocal the animal tends to be"],
  ["spaceNeeds", "home", "Space Needs", "How much living space the animal needs"],
  ["adaptability", "home", "Adaptability", "Ability to adjust to new routines or homes"],
  ["trainingDifficulty", "home", "Training Difficulty", "How difficult the animal is to train"],
  ["separationAnxiety", "safety", "Separation Anxiety", "Stress when left alone"],
  ["aggressive", "safety", "Aggression", "Level of aggressive behavior (lower is better)"],
];

const BEHAVIOR_DIMENSIONS = Object.freeze(definitions.map(([key, groupKey, label, description]) => ({
  key,
  groupKey,
  label,
  description,
})));
// Keep this canonical order aligned with the compatibilityVector written by the
// original behavioral assessment controller.
const REQUIRED_TRAITS = Object.freeze([
  "energyLevel", "exerciseNeeds", "independenceLevel", "attentionNeeds",
  "playfulness", "friendlinessToHumans", "goodWithKids", "goodWithOtherPets",
  "strangerTolerance", "noiseLevel", "spaceNeeds", "adaptability",
  "trainingDifficulty", "affectionLevel", "separationAnxiety", "aggressive",
]);
const DIMENSION_KEYS = new Set(REQUIRED_TRAITS);
const GROUP_KEYS = new Set(Object.keys(BEHAVIOR_GROUPS));
const SCALE_VALUES = Object.freeze([1, 2, 3, 4, 5]);
const MAX_QUESTIONS = 50;

const DEFAULT_QUESTIONS = Object.freeze(BEHAVIOR_DIMENSIONS.map((dimension, index) => ({
  id: dimension.key,
  traitKey: dimension.key,
  groupKey: dimension.groupKey,
  label: dimension.label,
  text: dimension.description,
  active: true,
  order: index + 1,
  choices: SCALE_VALUES.map((value) => ({
    id: `${dimension.key}-${value}`,
    text: String(value),
    value,
    order: value,
  })),
})));

function cleanText(value, maxLength) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cloneDefaultQuestions() {
  return DEFAULT_QUESTIONS.map((question) => ({
    ...question,
    choices: question.choices.map((choice) => ({ ...choice })),
  }));
}

// Retire the old numeric special-needs question without discarding edits to
// the remaining configured questions. Historical assessments remain intact.
function withoutLegacySpecialNeeds(questions) {
  return Array.isArray(questions)
    ? questions.filter(question => question?.traitKey !== "specialNeeds")
    : questions;
}

function validateAndNormalizeBehavioralQuestions(input) {
  if (!Array.isArray(input) || !input.length) {
    return { error: "At least one behavioral assessment question is required." };
  }
  if (input.length > MAX_QUESTIONS) {
    return { error: `A maximum of ${MAX_QUESTIONS} behavioral questions is allowed.` };
  }

  const ids = new Set();
  const activeTraits = new Map();
  const questions = [];

  for (let questionIndex = 0; questionIndex < input.length; questionIndex += 1) {
    const source = input[questionIndex] || {};
    const id = cleanText(source.id, 80);
    const traitKey = cleanText(source.traitKey, 80);
    const groupKey = cleanText(source.groupKey, 40).toLowerCase();
    const label = cleanText(source.label, 100);
    const text = cleanText(source.text, 300);
    const active = source.active === true;

    if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return { error: `Question ${questionIndex + 1} has an invalid ID.` };
    if (ids.has(id)) return { error: `Question ID "${id}" is duplicated.` };
    if (!DIMENSION_KEYS.has(traitKey)) return { error: `Question ${questionIndex + 1} has an invalid behavior link.` };
    if (!GROUP_KEYS.has(groupKey)) return { error: `Question ${questionIndex + 1} has an invalid section.` };
    if (!label) return { error: `Question ${questionIndex + 1} needs a title.` };
    if (!text) return { error: `Question ${questionIndex + 1} text cannot be blank.` };
    if (!Array.isArray(source.choices) || source.choices.length !== SCALE_VALUES.length) {
      return { error: `Question ${questionIndex + 1} must keep the complete 1–5 answer scale.` };
    }

    const choiceIds = new Set();
    const choiceValues = new Set();
    const choices = [];
    for (let choiceIndex = 0; choiceIndex < source.choices.length; choiceIndex += 1) {
      const sourceChoice = source.choices[choiceIndex] || {};
      const choiceId = cleanText(sourceChoice.id || `${id}-${choiceIndex + 1}`, 100);
      const choiceText = cleanText(sourceChoice.text, 120);
      const value = Number(sourceChoice.value);
      if (!choiceId || !/^[A-Za-z0-9_-]+$/.test(choiceId) || choiceIds.has(choiceId)) {
        return { error: `Question ${questionIndex + 1} has a missing or duplicate answer ID.` };
      }
      if (!choiceText) return { error: `Answer ${choiceIndex + 1} for question ${questionIndex + 1} cannot be blank.` };
      if (!Number.isInteger(value) || !SCALE_VALUES.includes(value) || choiceValues.has(value)) {
        return { error: `Question ${questionIndex + 1} must map one answer to each score from 1 to 5.` };
      }
      choiceIds.add(choiceId);
      choiceValues.add(value);
      choices.push({ id: choiceId, text: choiceText, value, order: choiceIndex + 1 });
    }

    if (active) {
      if (activeTraits.has(traitKey)) return { error: `Only one active question may measure ${traitKey}.` };
      activeTraits.set(traitKey, id);
    }
    ids.add(id);
    questions.push({ id, traitKey, groupKey, label, text, active, order: questionIndex + 1, choices });
  }

  const missingTraits = REQUIRED_TRAITS.filter((traitKey) => !activeTraits.has(traitKey));
  if (missingTraits.length) {
    return { error: `Every required behavior dimension must have one active question. Missing: ${missingTraits.join(", ")}.` };
  }
  return { questions };
}

function validateBehavioralAnswers({ traits, answerSelections }, questions) {
  const active = questions.filter((question) => question.active);
  const normalizedTraits = {};
  const normalizedSelections = {};

  for (const question of active) {
    const selectedId = cleanText(answerSelections?.[question.id] || answerSelections?.[question.traitKey], 100);
    const requestedValue = Number(traits?.[question.traitKey]);
    const choice = question.choices.find((item) => item.id === selectedId)
      || question.choices.find((item) => item.value === requestedValue);
    if (!choice) return { error: `Select a valid answer for ${question.label}.` };
    if (Number.isInteger(requestedValue) && requestedValue !== choice.value) {
      return { error: `The selected answer for ${question.label} does not match its configured score.` };
    }
    normalizedTraits[question.traitKey] = choice.value;
    normalizedSelections[question.id] = choice.id;
  }
  return { traits: normalizedTraits, answerSelections: normalizedSelections };
}

function buildBehavioralQuestionSnapshot(questions, traits, answerSelections = {}) {
  return questions.filter((question) => question.active).map((question) => {
    const value = Number(traits[question.traitKey]);
    const selectedId = answerSelections[question.id] || answerSelections[question.traitKey];
    const choice = question.choices.find((item) => item.id === selectedId)
      || question.choices.find((item) => item.value === value);
    return {
      questionId: question.id,
      traitKey: question.traitKey,
      behaviorLabel: BEHAVIOR_DIMENSIONS.find((item) => item.key === question.traitKey)?.label || question.traitKey,
      questionTitle: question.label,
      questionText: question.text,
      answerId: choice?.id || "",
      answerText: choice?.text || "",
      value,
    };
  });
}

module.exports = {
  BEHAVIOR_GROUPS,
  BEHAVIOR_DIMENSIONS,
  REQUIRED_TRAITS,
  DEFAULT_QUESTIONS,
  MAX_QUESTIONS,
  cloneDefaultQuestions,
  withoutLegacySpecialNeeds,
  validateAndNormalizeBehavioralQuestions,
  validateBehavioralAnswers,
  buildBehavioralQuestionSnapshot,
};
