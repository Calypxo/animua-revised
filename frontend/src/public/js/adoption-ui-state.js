export function createSelectionFocusGuard() {
  let applyingSelection = false;

  return {
    focusAfterSelection(input) {
      applyingSelection = true;
      try {
        input?.focus({ preventScroll: true });
      } finally {
        applyingSelection = false;
      }
    },
    shouldOpenOnFocus() {
      return !applyingSelection;
    },
  };
}
