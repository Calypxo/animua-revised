import test from "node:test";
import assert from "node:assert/strict";
import {
  moveBehaviorQuestion,
  moveBehaviorQuestionWithinGroup,
  canDeactivateBehaviorQuestion,
  createBehaviorQuestionReplacement,
} from "../src/management/behavioralQuestionModel.js";

test("behavioral question reorder controls preserve records and update order", () => {
  const questions = [
    { id: "one", order: 1 },
    { id: "two", order: 2 },
    { id: "three", order: 3 },
  ];
  const moved = moveBehaviorQuestion(questions, 1, -1);
  assert.deepEqual(moved.map((item) => item.id), ["two", "one", "three"]);
  assert.deepEqual(moved.map((item) => item.order), [1, 2, 3]);
  assert.deepEqual(questions.map((item) => item.id), ["one", "two", "three"]);
});

test("section reorder skips questions belonging to other behavior sections", () => {
  const questions = [
    { id: "activity-one", groupKey: "activity", order: 1 },
    { id: "social-one", groupKey: "social", order: 2 },
    { id: "activity-two", groupKey: "activity", order: 3 },
  ];
  const moved = moveBehaviorQuestionWithinGroup(questions, 2, -1);
  assert.deepEqual(moved.map((item) => item.id), ["activity-two", "social-one", "activity-one"]);
});

test("the only active question for a behavior dimension cannot be deactivated", () => {
  const questions = [
    { id: "energy", traitKey: "energyLevel", active: true },
    { id: "exercise", traitKey: "exerciseNeeds", active: true },
  ];
  assert.equal(canDeactivateBehaviorQuestion(questions, "energy"), false);
  questions.push({ id: "energy-replacement", traitKey: "energyLevel", active: true });
  assert.equal(canDeactivateBehaviorQuestion(questions, "energy"), true);
});

test("replacement questions preserve the behavior link with unique question and answer IDs", () => {
  const source = {
    id: "energy",
    label: "Energy Level",
    traitKey: "energyLevel",
    groupKey: "activity",
    active: true,
    choices: [1, 2, 3, 4, 5].map((value) => ({ id: `energy-${value}`, text: String(value), value })),
  };
  const replacement = createBehaviorQuestionReplacement(source, "energy-replacement");
  assert.equal(replacement.id, "energy-replacement");
  assert.equal(replacement.traitKey, source.traitKey);
  assert.equal(replacement.active, true);
  assert.equal(replacement.__new, true);
  assert.deepEqual(replacement.choices.map((choice) => choice.id), [
    "energy-replacement-1",
    "energy-replacement-2",
    "energy-replacement-3",
    "energy-replacement-4",
    "energy-replacement-5",
  ]);
});
