import { describe, it, expect } from "vitest";
import { calculateSm2, type Sm2Card, type Sm2Rating } from "../sm2";

describe("SM-2 Algorithm", () => {
  const newCard: Sm2Card = {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
  };

  it("first correct review sets interval to 1 day", () => {
    const result = calculateSm2(newCard, "good");
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(1);
  });

  it("second correct review sets interval to 6 days", () => {
    const afterFirst = calculateSm2(newCard, "good");
    const afterSecond = calculateSm2(afterFirst, "good");
    expect(afterSecond.interval).toBe(6);
    expect(afterSecond.repetitions).toBe(2);
  });

  it("'again' resets repetitions and interval", () => {
    const afterFirst = calculateSm2(newCard, "good");
    const afterAgain = calculateSm2(afterFirst, "again");
    expect(afterAgain.repetitions).toBe(0);
    expect(afterAgain.interval).toBe(0);
  });

  it("'easy' increases ease factor", () => {
    const result = calculateSm2(newCard, "easy");
    expect(result.easeFactor).toBeGreaterThan(2.5);
  });

  it("'hard' decreases ease factor but not below 1.3", () => {
    const result = calculateSm2(newCard, "hard");
    expect(result.easeFactor).toBeLessThan(2.5);
    expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("'again' does not change ease factor (SM-2 spec)", () => {
    const result = calculateSm2(newCard, "again");
    expect(result.easeFactor).toBe(2.5);
  });

  it("ease factor never goes below 1.3 after many hard reviews", () => {
    let card = newCard;
    for (let i = 0; i < 20; i++) {
      card = calculateSm2(card, "hard");
    }
    expect(card.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});
