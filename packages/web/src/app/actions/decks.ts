"use server";

import { getDb, writeTransaction } from "@flashcards/database";
import { decks } from "@flashcards/database/schema";
import { createDeckSchema } from "@flashcards/database/validation";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

export async function createDeck(formData: FormData) {
  const { userId } = await requireAuth();
  const parsed = createDeckSchema.parse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
  });

  const db = getDb();
  writeTransaction(db, () =>
    db.insert(decks).values({ ...parsed, userId }).run()
  );

  revalidatePath("/");
}

export async function getDecks() {
  const { userId } = await requireAuth();
  const db = getDb();
  return db
    .select({
      id: decks.id,
      name: decks.name,
      description: decks.description,
      flashcardCount: sql<number>`(SELECT COUNT(*) FROM flashcard WHERE flashcard.deck_id = "deck"."id")`,
      questionCount: sql<number>`(SELECT COUNT(*) FROM quiz_question WHERE quiz_question.deck_id = "deck"."id")`,
      dueCount: sql<number>`(SELECT COUNT(*) FROM flashcard WHERE flashcard.deck_id = "deck"."id" AND flashcard.next_review_at <= unixepoch())`,
      createdAt: decks.createdAt,
      updatedAt: decks.updatedAt,
    })
    .from(decks)
    .where(eq(decks.userId, userId))
    .all();
}

export async function getDeck(id: number) {
  const { userId } = await requireAuth();
  const db = getDb();
  return db.query.decks.findFirst({
    where: and(eq(decks.id, id), eq(decks.userId, userId)),
    with: {
      flashcards: { with: { learningMaterials: true } },
      quizQuestions: { with: { options: true, learningMaterials: true } },
    },
  });
}

export async function deleteDeck(id: number) {
  const { userId } = await requireAuth();
  const db = getDb();
  writeTransaction(db, () =>
    db.delete(decks).where(and(eq(decks.id, id), eq(decks.userId, userId))).run()
  );
  revalidatePath("/");
}
