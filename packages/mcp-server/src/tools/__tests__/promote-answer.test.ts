import { describe, it, expect, afterEach } from "vitest";
import { setupQuizFixture, closeCtx } from "./test-helper";
import { quizResults } from "@flashcards/database/schema";
import { promoteAnswerToFlashcard } from "../promote-answer";

describe("promote_answer_to_flashcard", () => {
  let ctx: ReturnType<typeof setupQuizFixture> | null = null;
  afterEach(() => { closeCtx(ctx); ctx = null; });

  it("creates a flashcard defaulting front=question, back=correct option", () => {
    ctx = setupQuizFixture();
    const ans = ctx.db.insert(quizResults).values({
      sessionId: 1, questionId: 1, correct: false,
    }).returning({ id: quizResults.id }).get();

    const card = promoteAnswerToFlashcard(ctx.db, ctx.userId, { answerId: ans.id, deckId: 1 });
    expect(card.front).toBe("2+2?");
    expect(card.back).toBe("4");
    expect(card.deckId).toBe(1);
  });

  it("rejects unowned answer", () => {
    ctx = setupQuizFixture();
    const ans = ctx.db.insert(quizResults).values({ questionId: 1, correct: true }).returning({ id: quizResults.id }).get();
    expect(() => promoteAnswerToFlashcard(ctx!.db, ctx!.otherUserId, { answerId: ans.id, deckId: 1 })).toThrow(/not found/i);
  });
});
