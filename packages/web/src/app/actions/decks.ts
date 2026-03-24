"use server";

import { getDb, writeTransaction } from "@flashcards/database";
import { decks } from "@flashcards/database/schema";
import { createDeckSchema } from "@flashcards/database/validation";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, getAuthUser } from "@/lib/auth";
import { isPublicDeck } from "@flashcards/database/access";

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
      dueCount: sql<number>`(SELECT COUNT(*) FROM flashcard WHERE flashcard.deck_id = "deck"."id" AND flashcard.next_review_at <= unixepoch())`,
      createdAt: decks.createdAt,
      updatedAt: decks.updatedAt,
    })
    .from(decks)
    .where(eq(decks.userId, userId))
    .all();
}

export async function getDeck(id: number) {
  const user = await getAuthUser();
  const db = getDb();
  let isPublicView = false;

  // Try owner first
  let deck = user
    ? await db.query.decks.findFirst({
        where: and(eq(decks.id, id), eq(decks.userId, user.userId)),
        with: { flashcards: { with: { tags: { with: { tag: true } }, learningMaterials: true } } },
      })
    : undefined;

  if (!deck) {
    const courseCtx = isPublicDeck(db, id);
    if (!courseCtx) return null;
    deck = await db.query.decks.findFirst({
      where: eq(decks.id, id),
      with: { flashcards: { with: { tags: { with: { tag: true } }, learningMaterials: true } } },
    });
    if (!deck) return null;
    isPublicView = true;
  }

  return { ...deck, isPublicView };
}

export async function deleteDeck(id: number) {
  const { userId } = await requireAuth();
  const db = getDb();
  writeTransaction(db, () =>
    db.delete(decks).where(and(eq(decks.id, id), eq(decks.userId, userId))).run()
  );
  revalidatePath("/");
}
