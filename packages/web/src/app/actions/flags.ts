"use server";

import { getDb, writeTransaction } from "@flashcards/database";
import { cardFlags } from "@flashcards/database/schema";
import { and, eq, isNull } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

type FlagType = "requires_review" | "requires_more_study";

export async function toggleFlag(
  flagType: FlagType,
  flashcardId?: number,
  questionId?: number,
) {
  const { userId } = await requireAuth();
  if (!flashcardId && !questionId) throw new Error("Must specify flashcardId or questionId");

  const db = getDb();

  const conditions = [
    eq(cardFlags.userId, userId),
    eq(cardFlags.flagType, flagType),
    isNull(cardFlags.resolvedAt),
  ];
  if (flashcardId) conditions.push(eq(cardFlags.flashcardId, flashcardId));
  if (questionId) conditions.push(eq(cardFlags.questionId, questionId));

  const existing = db.select({ id: cardFlags.id })
    .from(cardFlags)
    .where(and(...conditions))
    .get();

  if (existing) {
    writeTransaction(db, () =>
      db.delete(cardFlags).where(eq(cardFlags.id, existing.id)).run()
    );
    return { action: "removed" as const, flagId: existing.id };
  }

  const [flag] = writeTransaction(db, () =>
    db.insert(cardFlags).values({
      userId,
      flashcardId: flashcardId ?? null,
      questionId: questionId ?? null,
      flagType,
    }).returning().all()
  );
  return { action: "added" as const, flagId: flag.id };
}

export async function addFlagComment(
  flagType: FlagType,
  comment: string,
  flashcardId?: number,
  questionId?: number,
) {
  const { userId } = await requireAuth();
  if (!flashcardId && !questionId) throw new Error("Must specify flashcardId or questionId");

  const db = getDb();

  const conditions = [
    eq(cardFlags.userId, userId),
    eq(cardFlags.flagType, flagType),
    isNull(cardFlags.resolvedAt),
  ];
  if (flashcardId) conditions.push(eq(cardFlags.flashcardId, flashcardId));
  if (questionId) conditions.push(eq(cardFlags.questionId, questionId));

  const existing = db.select({ id: cardFlags.id })
    .from(cardFlags)
    .where(and(...conditions))
    .get();

  if (existing) {
    writeTransaction(db, () =>
      db.update(cardFlags)
        .set({ comment })
        .where(eq(cardFlags.id, existing.id))
        .run()
    );
    return { flagId: existing.id };
  }

  const [flag] = writeTransaction(db, () =>
    db.insert(cardFlags).values({
      userId,
      flashcardId: flashcardId ?? null,
      questionId: questionId ?? null,
      flagType,
      comment,
    }).returning().all()
  );
  return { flagId: flag.id };
}

export async function getFlags(flashcardId?: number, questionId?: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  const conditions = [eq(cardFlags.userId, userId), isNull(cardFlags.resolvedAt)];
  if (flashcardId) conditions.push(eq(cardFlags.flashcardId, flashcardId));
  if (questionId) conditions.push(eq(cardFlags.questionId, questionId));

  return db.select()
    .from(cardFlags)
    .where(and(...conditions))
    .all();
}

export async function removeFlag(flagId: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  writeTransaction(db, () =>
    db.delete(cardFlags)
      .where(and(eq(cardFlags.id, flagId), eq(cardFlags.userId, userId)))
      .run()
  );
}
