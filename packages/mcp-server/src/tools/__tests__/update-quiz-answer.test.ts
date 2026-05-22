import { describe, it, expect, afterEach } from "vitest";
import { setupQuizFixture } from "./test-helper";
import { quizResults } from "@flashcards/database/schema";
import { eq } from "drizzle-orm";
import { updateQuizAnswer } from "../quiz-results";

describe("update_quiz_answer", () => {
  let ctx: ReturnType<typeof setupQuizFixture> | null = null;
  afterEach(() => { ctx?.sqlite.close(); ctx = null; });

  it("updates note and confidence; leaves immutable fields alone", () => {
    ctx = setupQuizFixture();
    const inserted = ctx.db.insert(quizResults).values({
      sessionId: 1, questionId: 1, correct: false, userAnswer: "x",
    }).returning({ id: quizResults.id }).get();

    updateQuizAnswer(ctx.db, ctx.userId, inserted.id, { note: "lucky", confidence: 3 });

    const row = ctx.db.select().from(quizResults).where(eq(quizResults.id, inserted.id)).get()!;
    expect(row.note).toBe("lucky");
    expect(row.confidence).toBe(3);
    expect(row.correct).toBe(false);
    expect(row.userAnswer).toBe("x");
  });

  it("clears note when null is passed", () => {
    ctx = setupQuizFixture();
    const inserted = ctx.db.insert(quizResults).values({
      questionId: 1, correct: true, note: "old",
    }).returning({ id: quizResults.id }).get();
    updateQuizAnswer(ctx.db, ctx.userId, inserted.id, { note: null });
    const row = ctx.db.select().from(quizResults).where(eq(quizResults.id, inserted.id)).get()!;
    expect(row.note).toBeNull();
  });

  it("rejects cross-user", () => {
    ctx = setupQuizFixture();
    const inserted = ctx.db.insert(quizResults).values({ questionId: 1, correct: true }).returning({ id: quizResults.id }).get();
    expect(() => updateQuizAnswer(ctx!.db, ctx!.otherUserId, inserted.id, { note: "x" })).toThrow(/not found/i);
  });

  it("rejects empty patch", () => {
    ctx = setupQuizFixture();
    const inserted = ctx.db.insert(quizResults).values({ questionId: 1, correct: true }).returning({ id: quizResults.id }).get();
    expect(() => updateQuizAnswer(ctx!.db, ctx!.userId, inserted.id, {})).toThrow(/nothing to update/i);
  });
});
