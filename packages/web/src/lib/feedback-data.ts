import { getDb } from "@flashcards/database";
import { entityFeedback } from "@flashcards/database/schema";
import { and, eq, sql } from "drizzle-orm";

export const ENTITY_TYPES = ["material", "quiz", "question", "flashcard", "deck", "course"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export type EntityFeedbackData = {
  userVote: 1 | -1 | null;
  userComment: string | null;
  positiveCount: number;
  negativeCount: number;
};

/** Server-side helper callable from server components directly (no "use server" boundary needed). */
export function getEntityFeedbackData(
  db: ReturnType<typeof getDb>,
  userId: number,
  entityType: EntityType,
  entityId: number,
): EntityFeedbackData {
  const userRow = db.select({ vote: entityFeedback.vote, comment: entityFeedback.comment })
    .from(entityFeedback)
    .where(and(
      eq(entityFeedback.userId, userId),
      eq(entityFeedback.entityType, entityType),
      eq(entityFeedback.entityId, entityId),
    ))
    .get();

  const counts = db.select({
    positiveCount: sql<number>`sum(case when ${entityFeedback.vote} = 1 then 1 else 0 end)`,
    negativeCount: sql<number>`sum(case when ${entityFeedback.vote} = -1 then 1 else 0 end)`,
  })
    .from(entityFeedback)
    .where(and(
      eq(entityFeedback.entityType, entityType),
      eq(entityFeedback.entityId, entityId),
    ))
    .get();

  return {
    userVote: (userRow?.vote ?? null) as 1 | -1 | null,
    userComment: userRow?.comment ?? null,
    positiveCount: counts?.positiveCount ?? 0,
    negativeCount: counts?.negativeCount ?? 0,
  };
}
