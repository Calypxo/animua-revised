const { RAW_QUESTION_KEYS } = require("./compatibilityScoringService");

const PHASES = new Set(["lifestyle", "social", "care", "affection"]);
const MAX_QUESTIONS = 60;
const MIN_CHOICES = 2;
const MAX_CHOICES = 8;

const definitions = [
  ["energyLevel", "lifestyle", "Energy Level", "How energetic do you want your pet to be?", "Gaano ka-energetic ang pet na gusto mo?", ["Very calm", "Low energy", "Moderate", "Active", "Very energetic"]],
  ["exerciseNeeds", "lifestyle", "Exercise Capacity", "How much daily exercise can you realistically provide?", "Gaano karaming daily exercise ang kaya mong ibigay?", ["Very little", "A little", "Moderate", "A lot", "Very high"]],
  ["independenceLevel", "lifestyle", "Independence", "How independent should your pet be?", "Gaano ka-independent dapat ang pet mo?", ["Needs constant companionship", "Low independence", "Balanced", "Quite independent", "Very independent"]],
  ["attentionNeeds", "lifestyle", "Attention Capacity", "How much daily attention can you give your pet?", "Gaano karaming daily attention ang kaya mong ibigay sa pet?", ["Very little", "A little", "Moderate", "A lot", "Very high"]],
  ["playfulness", "lifestyle", "Playfulness", "How playful do you want your pet to be?", "Gaano ka-playful ang pet na gusto mo?", ["Very calm", "Slightly playful", "Balanced", "Playful", "Very playful"]],
  ["adaptability", "lifestyle", "Routine Stability", "How often does your daily routine change?", "Gaano kadalas nagbabago ang daily routine mo?", ["Very stable", "Slightly changing", "Moderate changes", "Often changing", "Very unpredictable"]],
  ["friendlinessToHumans", "social", "Household Sociability", "How social is your household overall?", "Gaano kasocial ang inyong household?", ["Very quiet", "Slightly social", "Moderately social", "Social", "Very social"]],
  ["goodWithKids", "social", "Kids at Home", "How often will your pet interact with children?", "Gaano kadalas makakasalamuha ng pet ang mga bata?", ["Never", "Rarely", "Sometimes", "Often", "Daily - it's a must"]],
  ["goodWithOtherPets", "social", "Other Pets", "Will your pet live with or interact with other pets?", "Makakasama ba ng pet ang ibang hayop?", ["No other pets", "Rare contact", "Sometimes", "Often", "Yes, definitely"]],
  ["strangerTolerance", "social", "Visitor Comfort", "How comfortable should your pet be around visitors or strangers?", "Gaano dapat kakomportable ang pet sa bisita o strangers?", ["Very cautious", "Reserved", "Balanced", "Friendly", "Very welcoming"]],
  ["noiseLevel", "care", "Noise Tolerance", "How much noise can you comfortably handle from a pet?", "Gaano karaming ingay mula sa pet ang kaya mong tanggapin?", ["Very little", "Low", "Moderate", "High", "Very high"]],
  ["spaceNeeds", "care", "Living Space", "How much living space can you provide?", "Gaano kalaking living space ang kaya mong ibigay?", ["Very small (studio)", "Small", "Average", "Large", "Very large with yard"]],
  ["climateTolerance", "care", "Climate Readiness", "Can you care for a pet in Angeles City's warm climate?", "Kaya mo bang alagaan ang pet sa mainit na klima ng Angeles City?", ["Not ready", "Slightly ready", "Moderately ready", "Ready", "Fully prepared"]],
  ["groomingNeeds", "care", "Grooming Commitment", "How willing are you to groom your pet regularly?", "Gaano ka kahandang mag-groom ng pet nang regular?", ["Not willing", "Slightly willing", "Moderate effort", "Willing", "Very willing"]],
  ["trainingDifficulty", "care", "Training Commitment", "How much training difficulty can you handle?", "Gaano kahirap na training ang kaya mong hawakan?", ["Very easy only", "Low difficulty", "Moderate", "Can handle difficult", "Very experienced trainer"]],
  ["healthRiskLevel", "care", "Vet Budget", "How prepared are you for veterinary costs?", "Gaano ka kahanda sa gastusing veterinary?", ["Not prepared", "Slightly prepared", "Somewhat prepared", "Prepared", "Fully prepared"]],
  ["affectionLevel", "affection", "Affection Preference", "How affectionate do you want your pet to be?", "Gaano kalambing ang pet na gusto mo?", ["Very independent", "Not very affectionate", "Balanced", "Affectionate", "Very cuddly"]],
  ["separationAnxiety", "affection", "Clinginess Tolerance", "How comfortable are you with a clingy pet?", "Gaano ka kakomportable sa clingy na pet?", ["Not comfortable", "Slightly OK", "Neutral", "Comfortable", "Completely fine with it"]],
];

const DEFAULT_QUESTIONS = definitions.map(([traitKey, phaseKey, label, text, hint, choices], index) => ({
  id: traitKey,
  traitKey,
  phaseKey,
  label,
  text,
  hint,
  active: true,
  order: index + 1,
  choices: choices.map((choiceText, choiceIndex) => ({
    id: `${traitKey}-${choiceIndex + 1}`,
    text: choiceText,
    value: choiceIndex + 1,
    order: choiceIndex + 1,
  })),
}));

function cleanText(value, maxLength) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function validateAndNormalizeQuestions(input) {
  if (!Array.isArray(input) || !input.length) {
    return { error: "At least one quiz question is required." };
  }
  if (input.length > MAX_QUESTIONS) {
    return { error: `A maximum of ${MAX_QUESTIONS} quiz questions is allowed.` };
  }

  const ids = new Set();
  const activeTraits = new Map();
  const questions = [];

  for (let questionIndex = 0; questionIndex < input.length; questionIndex += 1) {
    const source = input[questionIndex] || {};
    const id = cleanText(source.id, 80);
    const traitKey = cleanText(source.traitKey, 80);
    const phaseKey = cleanText(source.phaseKey, 40).toLowerCase();
    const label = cleanText(source.label, 100);
    const text = cleanText(source.text, 300);
    const hint = cleanText(source.hint, 300);
    const active = source.active === true;

    if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return { error: `Question ${questionIndex + 1} has an invalid ID.` };
    if (ids.has(id)) return { error: `Question ID "${id}" is duplicated.` };
    if (!RAW_QUESTION_KEYS.includes(traitKey)) return { error: `Question ${questionIndex + 1} has an invalid scoring trait.` };
    if (!PHASES.has(phaseKey)) return { error: `Question ${questionIndex + 1} has an invalid section.` };
    if (!label) return { error: `Question ${questionIndex + 1} needs a short label.` };
    if (!text) return { error: `Question ${questionIndex + 1} text cannot be empty.` };
    if (!Array.isArray(source.choices) || source.choices.length < MIN_CHOICES) return { error: `Question ${questionIndex + 1} needs at least ${MIN_CHOICES} answer choices.` };
    if (source.choices.length > MAX_CHOICES) return { error: `Question ${questionIndex + 1} cannot have more than ${MAX_CHOICES} answer choices.` };

    const choiceIds = new Set();
    const choices = [];
    for (let choiceIndex = 0; choiceIndex < source.choices.length; choiceIndex += 1) {
      const choice = source.choices[choiceIndex] || {};
      const choiceId = cleanText(choice.id || `${id}-${choiceIndex + 1}`, 100);
      const choiceText = cleanText(choice.text, 160);
      const value = Number(choice.value);
      if (!choiceId || !/^[A-Za-z0-9_-]+$/.test(choiceId) || choiceIds.has(choiceId)) return { error: `Question ${questionIndex + 1} has a missing or duplicate answer ID.` };
      if (!choiceText) return { error: `Answer ${choiceIndex + 1} for question ${questionIndex + 1} cannot be empty.` };
      if (!Number.isInteger(value) || value < 1 || value > 5) return { error: `Answer ${choiceIndex + 1} for question ${questionIndex + 1} needs a whole-number score from 1 to 5.` };
      choiceIds.add(choiceId);
      choices.push({ id: choiceId, text: choiceText, value, order: choiceIndex + 1 });
    }

    if (active) {
      if (activeTraits.has(traitKey)) return { error: `Only one active question may map to ${traitKey}.` };
      activeTraits.set(traitKey, id);
    }
    ids.add(id);
    questions.push({ id, traitKey, phaseKey, label, text, hint, active, order: questionIndex + 1, choices });
  }

  if (!activeTraits.size) return { error: "At least one quiz question must remain active." };
  return { questions };
}

function validateConfiguredPreferences(input, questions) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "All active compatibility preferences are required." };
  }
  const activeTraits = new Set(questions.filter((question) => question.active).map((question) => question.traitKey));
  const preferences = {};
  const scoringPreferences = {};
  for (const key of RAW_QUESTION_KEYS) {
    if (!activeTraits.has(key)) {
      scoringPreferences[key] = 3;
      continue;
    }
    const value = Number(input[key]);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      return { error: `${key} must be a whole number from 1 to 5.` };
    }
    preferences[key] = value;
    scoringPreferences[key] = value;
  }
  return { preferences, scoringPreferences };
}

function hasCustomWording(question) {
  const original = DEFAULT_QUESTIONS.find(item => item.id === question.id);
  return !original || ["label", "text", "hint"].some(key => question[key] !== original[key])
    || question.choices.some((choice, index) => choice.text !== original.choices[index]?.text);
}

// Existing quizzes and their saved results share stable IDs and score mappings.
// Management may improve wording, but cannot redesign that scoring contract.
function validateQuestionWordingEdits(input, previousQuestions) {
  const protectedError = { error: "Only wording can be edited. Keep the existing questions, sections, behavior links, answer choices, scores, order, and active status." };
  if (!Array.isArray(input) || input.length !== previousQuestions.length) return protectedError;
  for (let index = 0; index < previousQuestions.length; index += 1) {
    const previous = previousQuestions[index];
    const question = input[index];
    if (!question || ["id", "traitKey", "phaseKey", "active", "order"].some(key => question[key] !== previous[key])) return protectedError;
    if (!Array.isArray(question.choices) || question.choices.length !== previous.choices.length) return protectedError;
    if (question.choices.some((choice, choiceIndex) => !choice || ["id", "value", "order"].some(key => choice[key] !== previous.choices[choiceIndex][key]))) return protectedError;
  }
  return validateAndNormalizeQuestions(input);
}

function buildQuestionSnapshot(questions, preferences, answerSelections = {}) {
  return questions.filter((question) => question.active).map((question) => {
    const value = Number(preferences[question.traitKey]);
    const selectedChoiceId = String(answerSelections[question.traitKey] || "");
    const choice = question.choices.find((item) => item.id === selectedChoiceId && item.value === value)
      || question.choices.find((item) => item.value === value);
    return {
      questionId: question.id,
      traitKey: question.traitKey,
      label: question.label,
      questionText: question.text,
      answerText: choice?.text || "",
      value,
    };
  });
}

module.exports = {
  DEFAULT_QUESTIONS,
  MAX_QUESTIONS,
  MIN_CHOICES,
  MAX_CHOICES,
  validateAndNormalizeQuestions,
  validateQuestionWordingEdits,
  hasCustomWording,
  validateConfiguredPreferences,
  buildQuestionSnapshot,
};
