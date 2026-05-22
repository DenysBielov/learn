import { describe, it, expect, afterEach } from "vitest";
import { setupQuizFixture, closeCtx } from "./test-helper";
import { quizResults } from "@flashcards/database/schema";
import { listQuizResults } from "../quiz-results";

describe("list_quiz_results", () => {
  let ctx: ReturnType<typeof setupQuizFixture> | null = null;
  afterEach(() => { closeCtx(ctx); ctx = null; });

  it("returns rows filtered by sessionId with joined option text", () => {
    ctx = setupQuizFixture();
    ctx.db.insert(quizResults).values({
      sessionId: 1, activityId: 1, questionId: 1,
      selectedOptionId: ctx.optionBWrongId, correct: false,
      userAnswer: "2", confidence: 2, note: "guessed",
    }).run();

    const rows = listQuizResults(ctx.db, ctx.userId, { sessionId: 1 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      quizId: 1,
      questionId: 1,
      selectedOptionId: 2,
      correct: false,
      confidence: 2,
      note: "guessed",
      selectedOptionText: "5",
      correctOptionText: "4",
      questionText: "2+2?",
      questionType: "multiple_choice",
    });
    expect(typeof rows[0].answeredAt).toBe("string");
  });

  it("rejects cross-user access", () => {
    ctx = setupQuizFixture();
    ctx.db.insert(quizResults).values({
      sessionId: 1, questionId: 1, correct: true,
    }).run();
    const rows = listQuizResults(ctx.db, ctx.otherUserId, { sessionId: 1 });
    expect(rows).toEqual([]);
  });

  it("requires sessionId or quizId", () => {
    ctx = setupQuizFixture();
    expect(() => listQuizResults(ctx!.db, ctx!.userId, {})).toThrow(/sessionId or quizId/);
  });

  it("filters by isCorrect, hasNote, minConfidence", () => {
    ctx = setupQuizFixture();
    ctx.db.insert(quizResults).values([
      { sessionId: 1, questionId: 1, correct: true, confidence: 5, note: "n" },
      { sessionId: 1, questionId: 1, correct: false, confidence: 1, note: null },
    ]).run();
    expect(listQuizResults(ctx.db, ctx.userId, { sessionId: 1, isCorrect: false })).toHaveLength(1);
    expect(listQuizResults(ctx.db, ctx.userId, { sessionId: 1, hasNote: true })).toHaveLength(1);
    expect(listQuizResults(ctx.db, ctx.userId, { sessionId: 1, minConfidence: 3 })).toHaveLength(1);
  });
});
