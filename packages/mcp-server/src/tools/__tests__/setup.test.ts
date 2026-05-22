import { describe, it, expect, afterEach } from "vitest";
import { setupQuizFixture, closeCtx } from "./test-helper";

describe("test fixture", () => {
  let ctx: ReturnType<typeof setupQuizFixture> | null = null;
  afterEach(() => { closeCtx(ctx); ctx = null; });

  it("seeds quiz, question, options, session, activity", () => {
    ctx = setupQuizFixture();
    expect(ctx.userId).toBe(1);
    expect(ctx.questionId).toBe(1);
    expect(ctx.optionACorrectId).toBe(1);
  });
});
