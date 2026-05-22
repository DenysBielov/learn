import { describe, it, expect, afterEach } from "vitest";
import { setupQuizFixture, closeCtx } from "./test-helper";
import { quizResults, tags, questionTags } from "@flashcards/database/schema";
import { getTagAccuracy } from "../tag-accuracy";

describe("get_tag_accuracy", () => {
  let ctx: ReturnType<typeof setupQuizFixture> | null = null;
  afterEach(() => { closeCtx(ctx); ctx = null; });

  it("aggregates per-tag accuracy across answers", () => {
    ctx = setupQuizFixture();
    ctx.db.insert(tags).values({ id: 1, name: "arithmetic", userId: 1 }).run();
    ctx.db.insert(questionTags).values({ questionId: 1, tagId: 1 }).run();
    ctx.db.insert(quizResults).values([
      { questionId: 1, correct: true, confidence: 5 },
      { questionId: 1, correct: false, confidence: 2 },
      { questionId: 1, correct: true, confidence: 4 },
    ]).run();

    const out = getTagAccuracy(ctx.db, ctx.userId, { tag: "arithmetic" });
    expect(out).toEqual([
      { tag: "arithmetic", attempts: 3, correctRate: expect.closeTo(2 / 3, 5), avgConfidence: expect.closeTo(11 / 3, 5) },
    ]);
  });

  it("applies the >=3 attempts threshold when tag is omitted", () => {
    ctx = setupQuizFixture();
    ctx.db.insert(tags).values({ id: 1, name: "rare", userId: 1 }).run();
    ctx.db.insert(questionTags).values({ questionId: 1, tagId: 1 }).run();
    ctx.db.insert(quizResults).values([
      { questionId: 1, correct: true },
      { questionId: 1, correct: false },
    ]).run();
    expect(getTagAccuracy(ctx.db, ctx.userId, {})).toEqual([]);
  });
});
