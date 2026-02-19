export type Sm2Rating = "again" | "hard" | "good" | "easy";

export interface Sm2Card {
  easeFactor: number;
  interval: number; // days
  repetitions: number;
}

export interface Sm2Result extends Sm2Card {
  nextReviewAt: Date;
}

const RATING_QUALITY: Record<Sm2Rating, number> = {
  again: 0,
  hard: 3,
  good: 4,
  easy: 5,
};

export function calculateSm2(card: Sm2Card, rating: Sm2Rating): Sm2Result {
  const q = RATING_QUALITY[rating];
  let { easeFactor, interval, repetitions } = card;

  if (q < 3) {
    // Failed — reset repetitions and interval, keep ease factor unchanged
    repetitions = 0;
    interval = 0;
  } else {
    // Passed
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;

    // Only update ease factor on successful reviews (SM-2 spec)
    easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    easeFactor = Math.max(1.3, easeFactor);
  }

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + interval);

  return { easeFactor, interval, repetitions, nextReviewAt };
}
