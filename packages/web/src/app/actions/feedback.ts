"use server";

import { getDb, writeTransaction } from "@flashcards/database";
import { entityFeedback, materials, quizzes, quizQuestions, flashcards, decks, courses } from "@flashcards/database/schema";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import { getEntityFeedbackData } from "@/lib/feedback-data";

export { type EntityType, type EntityFeedbackData } from "@/lib/feedback-data";

const entityTypeSchema = z.enum(["material", "quiz", "question", "flashcard", "deck", "course"]);
type EntityType = z.infer<typeof entityTypeSchema>;

const voteSchema = z.union([z.literal(1), z.literal(-1)]);

const entityTableMap = {
  material: materials,
  quiz: quizzes,
  question: quizQuestions,
  flashcard: flashcards,
  deck: decks,
  course: courses,
} as const;

function entityExists(db: ReturnType<typeof getDb>, entityType: EntityType, entityId: number): boolean {
  const table = entityTableMap[entityType];
  const row = db.select({ id: (table as any).id }).from(table).where(eq((table as any).id, entityId)).get();
  return !!row;
}

export async function toggleFeedback(entityType: string, entityId: number, vote: number) {
  const parsedType = entityTypeSchema.parse(entityType);
  const parsedVote = voteSchema.parse(vote);

  const { userId } = await requireAuth();
  const db = getDb();

  if (!entityExists(db, parsedType, entityId)) {
    throw new Error(`Entity ${parsedType}:${entityId} not found`);
  }

  const existing = db.select({ id: entityFeedback.id, vote: entityFeedback.vote })
    .from(entityFeedback)
    .where(and(
      eq(entityFeedback.userId, userId),
      eq(entityFeedback.entityType, parsedType),
      eq(entityFeedback.entityId, entityId),
    ))
    .get();

  if (existing) {
    if (existing.vote === parsedVote) {
      writeTransaction(db, () =>
        db.delete(entityFeedback).where(eq(entityFeedback.id, existing.id)).run()
      );
      return { userVote: null as number | null };
    }
    writeTransaction(db, () =>
      db.update(entityFeedback)
        .set({ vote: parsedVote, comment: null, updatedAt: new Date() })
        .where(eq(entityFeedback.id, existing.id))
        .run()
    );
    return { userVote: parsedVote as number | null };
  }

  writeTransaction(db, () =>
    db.insert(entityFeedback).values({
      userId,
      entityType: parsedType,
      entityId,
      vote: parsedVote,
    }).run()
  );
  return { userVote: parsedVote as number | null };
}

export async function addFeedbackComment(entityType: string, entityId: number, comment: string) {
  const parsedType = entityTypeSchema.parse(entityType);
  const parsedComment = z.string().max(1000).parse(comment);

  const { userId } = await requireAuth();
  const db = getDb();

  writeTransaction(db, () =>
    db.update(entityFeedback)
      .set({ comment: parsedComment || null, updatedAt: new Date() })
      .where(and(
        eq(entityFeedback.userId, userId),
        eq(entityFeedback.entityType, parsedType),
        eq(entityFeedback.entityId, entityId),
      ))
      .run()
  );
}

export async function getEntityFeedback(entityType: string, entityId: number) {
  const parsedType = entityTypeSchema.parse(entityType);

  const { userId } = await requireAuth();
  const db = getDb();

  return getEntityFeedbackData(db, userId, parsedType, entityId);
}
