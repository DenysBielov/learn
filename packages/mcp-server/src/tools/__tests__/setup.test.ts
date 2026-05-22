import { describe, it, expect, afterEach } from "vitest";
import { setupQuizFixture } from "./test-helper";

describe("test fixture", () => {
  let ctx: ReturnType<typeof setupQuizFixture> | null = null;
  afterEach(() => { ctx?.sqlite.close(); ctx = null; });

  it("seeds quiz, question, options, session, activity", () => {
    ctx = setupQuizFixture();
    expect(ctx.userId).toBe(1);
    expect(ctx.questionId).toBe(1);
    expect(ctx.optionACorrectId).toBe(1);
  });
});
