export function moveBehaviorQuestion(items, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items.map((item) => ({ ...item }));
  const next = items.map((item) => ({ ...item }));
  [next[index], next[target]] = [next[target], next[index]];
  return next.map((item, itemIndex) => ({ ...item, order: itemIndex + 1 }));
}

export function moveBehaviorQuestionWithinGroup(items, index, direction) {
  const current = items[index];
  if (!current) return items.map((item) => ({ ...item }));
  const groupIndexes = items
    .map((item, itemIndex) => ({ item, itemIndex }))
    .filter(({ item }) => item.groupKey === current.groupKey)
    .map(({ itemIndex }) => itemIndex);
  const position = groupIndexes.indexOf(index);
  const targetIndex = groupIndexes[position + direction];
  if (targetIndex === undefined) return items.map((item) => ({ ...item }));
  const next = items.map((item) => ({ ...item }));
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next.map((item, itemIndex) => ({ ...item, order: itemIndex + 1 }));
}

export function canDeactivateBehaviorQuestion(items, questionId) {
  const current = items.find((item) => item.id === questionId);
  if (!current?.active) return true;
  return items.some((item) => item.id !== questionId && item.active && item.traitKey === current.traitKey);
}

export function createBehaviorQuestionReplacement(question, id) {
  return {
    ...question,
    id,
    label: `${question.label} replacement`,
    active: true,
    __new: true,
    choices: question.choices.map((choice) => ({
      ...choice,
      id: `${id}-${choice.value}`,
    })),
  };
}
