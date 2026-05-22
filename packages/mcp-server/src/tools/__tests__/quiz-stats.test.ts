import { describe, it, expect, afterEach } from "vitest";
import { setupQuizFixture, closeCtx } from "./test-helper";
import { quizResults, studySessions } from "@flashcards/database/schema";
import { getQuizStats } from "../quiz-stats";

describe("get_quiz_stats", () => {
  let ctx: ReturnType<typeof setupQuizFixture> | null = null;
  afterEach(() => { closeCtx(ctx); ctx = null; });

  it("computes per-attempt and per-question accuracy across two sessions", () => {
    ctx = setupQuizFixture();
    ctx.db.insert(studySessions).values({ id: 2, userId: 1 }).run();
    ctx.sqlite.prepare(
      "INSERT INTO session_activity (id, session_id, type, quiz_id, started_at, completed_at) VALUES (?,?,?,?,?,?)"
    ).run(2, 2, "quiz_answer", 1, 1_700_001_000, 1_700_001_500);

    ctx.db.insert(quizResults).values({ sessionId: 1, activityId: 1, questionId: 1, correct: false, confidence: 1, timeSpentMs: 4000 }).run();
    ctx.db.insert(quizResults).values({ sessionId: 2, activityId: 2, questionId: 1, correct: true, confidence: 5, timeSpentMs: 2000 }).run();

    const stats = getQuizStats(ctx.db, ctx.userId, { quizId: 1 });
    expect(stats.attempts).toHaveLength(2);
    expect(stats.attempts[0].percent + stats.attempts[1].percent).toBe(100);
    expect(stats.bestPercent).toBe(100);
    expect(stats.latestPercent).toBe(100);
    expect(stats.perQuestionAccuracy).toEqual([
      expect.objectContaining({ questionId: 1, attempts: 2, correctRate: 0.5, lastCorrect: true, avgTimeMs: 3000 }),
    ]);
  });

  it("rejects unowned quiz", () => {
    ctx = setupQuizFixture();
    expect(() => getQuizStats(ctx!.db, ctx!.otherUserId, { quizId: 1 })).toThrow(/not found/i);
  });
});
