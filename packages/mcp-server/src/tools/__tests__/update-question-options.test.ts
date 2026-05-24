import { describe, it, expect, afterEach } from "vitest";
import { validateOptionSet } from "@flashcards/database/validation";
import { setupQuizFixture, closeCtx } from "./test-helper";
import { quizQuestions, questionOptions, quizResults } from "@flashcards/database/schema";
import { eq } from "drizzle-orm";
import { updateQuestionOptions } from "../quiz";

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

describe("updateQuestionOptions", () => {
  let ctx: ReturnType<typeof setupQuizFixture> | null = null;
  afterEach(() => { closeCtx(ctx); ctx = null; });

  it("updates an option in place, keeping its id and quiz_result reference", () => {
    ctx = setupQuizFixture(); // question 1 (MC): opt 1 "4"✓, opt 2 "5"✗
    const qr = ctx.db.insert(quizResults).values({
      questionId: 1, selectedOptionId: 1, correct: true,
    }).returning({ id: quizResults.id }).get();

    const res = updateQuestionOptions(ctx.db, ctx.userId, 1, [
      { id: 1, optionText: "four", isCorrect: true },
      { id: 2, optionText: "5", isCorrect: false },
    ]);

    expect(res).toEqual({
      questionId: 1,
      type: "multiple_choice",
      options: [
        { id: 1, optionText: "four", isCorrect: true },
        { id: 2, optionText: "5", isCorrect: false },
      ],
      updated: 2, inserted: 0, deleted: 0,
    });

    const opt1 = ctx.db.select().from(questionOptions).where(eq(questionOptions.id, 1)).get()!;
    expect(opt1.optionText).toBe("four");
    expect(opt1.isCorrect).toBe(true);

    const row = ctx.db.select().from(quizResults).where(eq(quizResults.id, qr.id)).get()!;
    expect(row.selectedOptionId).toBe(1); // preserved
  });

  it("inserts an option without an id (gets a new id)", () => {
    ctx = setupQuizFixture();
    const res = updateQuestionOptions(ctx.db, ctx.userId, 1, [
      { id: 1, optionText: "4", isCorrect: true },
      { id: 2, optionText: "5", isCorrect: false },
      { optionText: "6", isCorrect: false },
    ]);
    expect(res.inserted).toBe(1);
    expect(res.options).toHaveLength(3);
    const added = res.options.find((o) => o.optionText === "6")!;
    expect(added.id).toBeGreaterThan(2);
  });

  it("deletes an omitted option and NULLs its quiz_result.selected_option_id", () => {
    ctx = setupQuizFixture();
    // add a 3rd option and a result that selected it
    ctx.db.insert(questionOptions).values({ id: 3, questionId: 1, optionText: "6", isCorrect: false }).run();
    const qr = ctx.db.insert(quizResults).values({
      questionId: 1, selectedOptionId: 3, correct: false,
    }).returning({ id: quizResults.id }).get();

    const res = updateQuestionOptions(ctx.db, ctx.userId, 1, [
      { id: 1, optionText: "4", isCorrect: true },
      { id: 2, optionText: "5", isCorrect: false },
    ]); // omit id 3 -> delete

    expect(res.deleted).toBe(1);
    expect(ctx.db.select().from(questionOptions).where(eq(questionOptions.id, 3)).get()).toBeUndefined();
    const row = ctx.db.select().from(quizResults).where(eq(quizResults.id, qr.id)).get()!;
    expect(row.selectedOptionId).toBeNull(); // history row survives, pointer cleared
  });

  it("handles update + insert + delete in one call", () => {
    ctx = setupQuizFixture();
    ctx.db.insert(questionOptions).values({ id: 3, questionId: 1, optionText: "6", isCorrect: false }).run();

    const res = updateQuestionOptions(ctx.db, ctx.userId, 1, [
      { id: 1, optionText: "keep", isCorrect: true }, // update
      { optionText: "added", isCorrect: false },      // insert
    ]); // omit ids 2 and 3 -> delete both

    expect(res).toMatchObject({ updated: 1, inserted: 1, deleted: 2 });
    expect(res.options).toHaveLength(2);
    expect(res.options.find((o) => o.id === 1)!.optionText).toBe("keep");
  });

  it("rejects a multiple_choice set with no correct option (and writes nothing)", () => {
    ctx = setupQuizFixture();
    expect(() => updateQuestionOptions(ctx!.db, ctx!.userId, 1, [
      { id: 1, optionText: "4", isCorrect: false },
      { id: 2, optionText: "5", isCorrect: false },
    ])).toThrow(/at least one option must be correct/i);
    // unchanged
    expect(ctx.db.select().from(questionOptions).where(eq(questionOptions.id, 1)).get()!.isCorrect).toBe(true);
  });

  it("rejects true_false with != 2 options", () => {
    ctx = setupQuizFixture();
    ctx.db.insert(quizQuestions).values({ id: 2, quizId: 1, type: "true_false", question: "T/F?" }).run();
    ctx.db.insert(questionOptions).values([
      { id: 10, questionId: 2, optionText: "True", isCorrect: true },
      { id: 11, questionId: 2, optionText: "False", isCorrect: false },
    ]).run();
    expect(() => updateQuestionOptions(ctx!.db, ctx!.userId, 2, [
      { id: 10, optionText: "True", isCorrect: true },
      { id: 11, optionText: "False", isCorrect: false },
      { optionText: "Maybe", isCorrect: false },
    ])).toThrow(/exactly 2 options/i);
  });

  it("rejects multi_select with all options correct", () => {
    ctx = setupQuizFixture();
    ctx.db.insert(quizQuestions).values({ id: 3, quizId: 1, type: "multi_select", question: "pick" }).run();
    ctx.db.insert(questionOptions).values([
      { id: 20, questionId: 3, optionText: "a", isCorrect: true },
      { id: 21, questionId: 3, optionText: "b", isCorrect: false },
    ]).run();
    expect(() => updateQuestionOptions(ctx!.db, ctx!.userId, 3, [
      { id: 20, optionText: "a", isCorrect: true },
      { id: 21, optionText: "b", isCorrect: true },
    ])).toThrow(/at least one option must be incorrect/i);
  });

  it("rejects an option id from another question", () => {
    ctx = setupQuizFixture();
    ctx.db.insert(quizQuestions).values({ id: 2, quizId: 1, type: "multiple_choice", question: "other" }).run();
    ctx.db.insert(questionOptions).values({ id: 99, questionId: 2, optionText: "x", isCorrect: true }).run();
    expect(() => updateQuestionOptions(ctx!.db, ctx!.userId, 1, [
      { id: 99, optionText: "x", isCorrect: true }, // belongs to question 2
      { id: 2, optionText: "5", isCorrect: false },
    ])).toThrow(/does not belong/i);
  });

  it("rejects duplicate option ids in the input", () => {
    ctx = setupQuizFixture();
    expect(() => updateQuestionOptions(ctx!.db, ctx!.userId, 1, [
      { id: 1, optionText: "4", isCorrect: true },
      { id: 1, optionText: "dup", isCorrect: false },
    ])).toThrow(/duplicate option id/i);
  });

  it("rejects a question owned by another user", () => {
    ctx = setupQuizFixture();
    expect(() => updateQuestionOptions(ctx!.db, ctx!.otherUserId, 1, [
      { id: 1, optionText: "4", isCorrect: true },
      { id: 2, optionText: "5", isCorrect: false },
    ])).toThrow(/not found/i);
  });

  it("rejects non-option question types", () => {
    ctx = setupQuizFixture();
    ctx.db.insert(quizQuestions).values({
      id: 5, quizId: 1, type: "matching", question: "match",
      correctAnswer: JSON.stringify([{ left: "a", right: "1" }, { left: "b", right: "2" }]),
    }).run();
    expect(() => updateQuestionOptions(ctx!.db, ctx!.userId, 5, [
      { optionText: "x", isCorrect: true },
      { optionText: "y", isCorrect: false },
    ])).toThrow(/correctAnswer/i);
  });
});
