import { describe, it, expect } from "vitest";
import {
  createDeckSchema,
  createFlashcardSchema,
  createQuizQuestionSchema,
  createMultipleChoiceSchema,
  createMatchingSchema,
  searchSchema,
  createCourseSchema,
  updateCourseSchema,
} from "../validation.js";

describe("Validation", () => {
  it("validates deck creation", () => {
    expect(createDeckSchema.parse({ name: "Test" })).toEqual({ name: "Test", description: "" });
    expect(() => createDeckSchema.parse({ name: "" })).toThrow();
  });

  it("validates flashcard creation", () => {
    expect(() => createFlashcardSchema.parse({ deckId: 1, front: "", back: "A" })).toThrow();
    expect(createFlashcardSchema.parse({ deckId: 1, front: "Q", back: "A" })).toBeTruthy();
  });

  it("validates multiple choice question", () => {
    const valid = {
      type: "multiple_choice" as const,
      deckId: 1,
      question: "What?",
      options: [
        { optionText: "A", isCorrect: true },
        { optionText: "B", isCorrect: false },
      ],
    };
    expect(createMultipleChoiceSchema.parse(valid)).toBeTruthy();
  });

  it("rejects multiple choice with no correct answer", () => {
    const invalid = {
      type: "multiple_choice" as const,
      deckId: 1,
      question: "What?",
      options: [
        { optionText: "A", isCorrect: false },
        { optionText: "B", isCorrect: false },
      ],
    };
    expect(() => createMultipleChoiceSchema.parse(invalid)).toThrow();
  });

  it("validates matching question", () => {
    const valid = {
      type: "matching" as const,
      deckId: 1,
      question: "Match these",
      correctAnswer: [
        { left: "A", right: "1" },
        { left: "B", right: "2" },
      ],
    };
    expect(createMatchingSchema.parse(valid)).toBeTruthy();
  });

  it("validates discriminated union picks correct type", () => {
    const mc = {
      type: "multiple_choice",
      deckId: 1,
      question: "What?",
      options: [
        { optionText: "A", isCorrect: true },
        { optionText: "B", isCorrect: false },
      ],
    };
    expect(createQuizQuestionSchema.parse(mc)).toBeTruthy();
  });

  it("validates search query length", () => {
    expect(() => searchSchema.parse({ query: "" })).toThrow();
    expect(() => searchSchema.parse({ query: "a".repeat(201) })).toThrow();
    expect(searchSchema.parse({ query: "typescript" })).toBeTruthy();
  });
});

describe("createCourseSchema", () => {
  it("accepts valid course", () => {
    const result = createCourseSchema.safeParse({ name: "Algorithms" });
    expect(result.success).toBe(true);
  });

  it("accepts all optional fields", () => {
    const result = createCourseSchema.safeParse({
      name: "Algorithms",
      description: "Learn algorithms",
      color: "#ff0000",
      parentId: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createCourseSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name over 200 chars", () => {
    const result = createCourseSchema.safeParse({ name: "a".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("rejects description over 2000 chars", () => {
    const result = createCourseSchema.safeParse({
      name: "Test",
      description: "a".repeat(2001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid color format", () => {
    const result = createCourseSchema.safeParse({ name: "Test", color: "red" });
    expect(result.success).toBe(false);
  });

  it("accepts valid hex color", () => {
    const result = createCourseSchema.safeParse({ name: "Test", color: "#aaBBcc" });
    expect(result.success).toBe(true);
  });
});

describe("updateCourseSchema", () => {
  it("accepts partial updates", () => {
    const result = updateCourseSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = updateCourseSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
