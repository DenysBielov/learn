import { describe, it, expect } from "vitest";
import { validateOptionSet } from "@flashcards/database/validation";

describe("validateOptionSet", () => {
  it("multiple_choice: valid with >=1 correct (allows multiple correct)", () => {
    expect(validateOptionSet("multiple_choice", [{ isCorrect: true }, { isCorrect: false }])).toBeNull();
    expect(validateOptionSet("multiple_choice", [{ isCorrect: true }, { isCorrect: true }])).toBeNull();
  });

  it("multiple_choice: rejects <2 options and 0 correct", () => {
    expect(validateOptionSet("multiple_choice", [{ isCorrect: true }])).toMatch(/requires 2/);
    expect(validateOptionSet("multiple_choice", [{ isCorrect: false }, { isCorrect: false }]))
      .toMatch(/at least one option must be correct/i);
  });

  it("true_false: exactly 2 options and exactly 1 correct", () => {
    expect(validateOptionSet("true_false", [{ isCorrect: true }, { isCorrect: false }])).toBeNull();
    expect(validateOptionSet("true_false", [{ isCorrect: true }, { isCorrect: false }, { isCorrect: false }]))
      .toMatch(/exactly 2 options/i);
    expect(validateOptionSet("true_false", [{ isCorrect: true }, { isCorrect: true }]))
      .toMatch(/exactly one option must be correct/i);
  });

  it("multi_select: >=1 correct AND >=1 incorrect", () => {
    expect(validateOptionSet("multi_select", [{ isCorrect: true }, { isCorrect: false }])).toBeNull();
    expect(validateOptionSet("multi_select", [{ isCorrect: true }, { isCorrect: true }]))
      .toMatch(/at least one option must be incorrect/i);
    expect(validateOptionSet("multi_select", [{ isCorrect: false }, { isCorrect: false }]))
      .toMatch(/at least one option must be correct/i);
  });

  it("non-option types are rejected with a correctAnswer message", () => {
    expect(validateOptionSet("matching", [{ isCorrect: true }, { isCorrect: false }])).toMatch(/correctAnswer/i);
    expect(validateOptionSet("free_text", [{ isCorrect: true }, { isCorrect: false }])).toMatch(/correctAnswer/i);
    expect(validateOptionSet("ordering", [{ isCorrect: true }, { isCorrect: false }])).toMatch(/correctAnswer/i);
  });
});
