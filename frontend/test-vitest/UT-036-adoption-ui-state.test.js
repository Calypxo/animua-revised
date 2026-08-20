import { describe, expect, it, vi } from "vitest";
import { createSelectionFocusGuard } from "../src/public/js/adoption-ui-state.js";

describe("UT-036 — Adoption UI State", () => {
  it("suppresses only the focus event caused by applying a birthdate selection", () => {
    const guard = createSelectionFocusGuard();
    const observedFocusStates = [];
    const input = {
      focus: vi.fn(() => observedFocusStates.push(guard.shouldOpenOnFocus())),
    };

    expect(guard.shouldOpenOnFocus()).toBe(true);
    guard.focusAfterSelection(input);

    expect(input.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(observedFocusStates).toEqual([false]);
    expect(guard.shouldOpenOnFocus()).toBe(true);
  });
});
