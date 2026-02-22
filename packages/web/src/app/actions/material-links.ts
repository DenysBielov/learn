"use server";

import { getDb, writeTransaction } from "@flashcards/database";
import {
  materials,
  decks,
  quizzes,
  tags,
  materialDecks,
  materialQuizzes,
  materialResources,
  materialTags,
} from "@flashcards/database/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

// --- Deck links ---

export async function linkDeckToMaterial(materialId: number, deckId: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  writeTransaction(db, () => {
    const material = db.select({ userId: materials.userId }).from(materials)
      .where(eq(materials.id, materialId)).get();
    const deck = db.select({ userId: decks.userId }).from(decks)
      .where(eq(decks.id, deckId)).get();
    if (!material || !deck || material.userId !== userId || deck.userId !== userId) {
      throw new Error("Not authorized");
    }

    db.insert(materialDecks).values({ materialId, deckId }).onConflictDoNothing().run();
  });

  revalidatePath("/");
}

export async function unlinkDeckFromMaterial(materialId: number, deckId: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  writeTransaction(db, () => {
    const material = db.select({ userId: materials.userId }).from(materials)
      .where(eq(materials.id, materialId)).get();
    const deck = db.select({ userId: decks.userId }).from(decks)
      .where(eq(decks.id, deckId)).get();
    if (!material || !deck || material.userId !== userId || deck.userId !== userId) {
      throw new Error("Not authorized");
    }

    db.delete(materialDecks)
      .where(and(eq(materialDecks.materialId, materialId), eq(materialDecks.deckId, deckId)))
      .run();
  });

  revalidatePath("/");
}

// --- Quiz links ---

export async function linkQuizToMaterial(materialId: number, quizId: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  writeTransaction(db, () => {
    const material = db.select({ userId: materials.userId }).from(materials)
      .where(eq(materials.id, materialId)).get();
    const quiz = db.select({ userId: quizzes.userId }).from(quizzes)
      .where(eq(quizzes.id, quizId)).get();
    if (!material || !quiz || material.userId !== userId || quiz.userId !== userId) {
      throw new Error("Not authorized");
    }

    db.insert(materialQuizzes).values({ materialId, quizId }).onConflictDoNothing().run();
  });

  revalidatePath("/");
}

export async function unlinkQuizFromMaterial(materialId: number, quizId: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  writeTransaction(db, () => {
    const material = db.select({ userId: materials.userId }).from(materials)
      .where(eq(materials.id, materialId)).get();
    const quiz = db.select({ userId: quizzes.userId }).from(quizzes)
      .where(eq(quizzes.id, quizId)).get();
    if (!material || !quiz || material.userId !== userId || quiz.userId !== userId) {
      throw new Error("Not authorized");
    }

    db.delete(materialQuizzes)
      .where(and(eq(materialQuizzes.materialId, materialId), eq(materialQuizzes.quizId, quizId)))
      .run();
  });

  revalidatePath("/");
}

// --- Resources ---

export async function addMaterialResource(
  materialId: number,
  url: string,
  title?: string,
  type?: string,
) {
  const { userId } = await requireAuth();
  const db = getDb();

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    throw new Error("URL must start with http:// or https://");
  }

  const resource = writeTransaction(db, () => {
    const material = db.select({ userId: materials.userId }).from(materials)
      .where(eq(materials.id, materialId)).get();
    if (!material || material.userId !== userId) {
      throw new Error("Not authorized");
    }

    const [created] = db.insert(materialResources).values({
      materialId,
      url,
      title: title ?? null,
      type: (type as "article" | "video" | "documentation" | "obsidian" | "other") ?? "other",
    }).returning().all();

    return created;
  });

  revalidatePath("/");
  return resource;
}

export async function removeMaterialResource(resourceId: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  writeTransaction(db, () => {
    const resource = db.select({ materialId: materialResources.materialId })
      .from(materialResources)
      .where(eq(materialResources.id, resourceId)).get();
    if (!resource) {
      throw new Error("Resource not found");
    }

    const material = db.select({ userId: materials.userId }).from(materials)
      .where(eq(materials.id, resource.materialId)).get();
    if (!material || material.userId !== userId) {
      throw new Error("Not authorized");
    }

    db.delete(materialResources).where(eq(materialResources.id, resourceId)).run();
  });

  revalidatePath("/");
}

// --- Tags ---

export async function assignMaterialTag(materialId: number, tagId: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  writeTransaction(db, () => {
    const material = db.select({ userId: materials.userId }).from(materials)
      .where(eq(materials.id, materialId)).get();
    const tag = db.select({ userId: tags.userId }).from(tags)
      .where(eq(tags.id, tagId)).get();
    if (!material || !tag || material.userId !== userId || tag.userId !== userId) {
      throw new Error("Not authorized");
    }

    db.insert(materialTags).values({ materialId, tagId }).onConflictDoNothing().run();
  });

  revalidatePath("/");
}

export async function removeMaterialTag(materialId: number, tagId: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  writeTransaction(db, () => {
    const material = db.select({ userId: materials.userId }).from(materials)
      .where(eq(materials.id, materialId)).get();
    const tag = db.select({ userId: tags.userId }).from(tags)
      .where(eq(tags.id, tagId)).get();
    if (!material || !tag || material.userId !== userId || tag.userId !== userId) {
      throw new Error("Not authorized");
    }

    db.delete(materialTags)
      .where(and(eq(materialTags.materialId, materialId), eq(materialTags.tagId, tagId)))
      .run();
  });

  revalidatePath("/");
}

// --- Query ---

export async function getMaterialLinks(materialId: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  const material = db.select({ id: materials.id }).from(materials)
    .where(and(eq(materials.id, materialId), eq(materials.userId, userId))).get();
  if (!material) {
    throw new Error("Material not found");
  }

  const linkedDecks = db.select({
    id: decks.id,
    name: decks.name,
  })
    .from(materialDecks)
    .innerJoin(decks, eq(materialDecks.deckId, decks.id))
    .where(eq(materialDecks.materialId, materialId))
    .all();

  const linkedQuizzes = db.select({
    id: quizzes.id,
    title: quizzes.title,
  })
    .from(materialQuizzes)
    .innerJoin(quizzes, eq(materialQuizzes.quizId, quizzes.id))
    .where(eq(materialQuizzes.materialId, materialId))
    .all();

  const resources = db.select()
    .from(materialResources)
    .where(eq(materialResources.materialId, materialId))
    .all();

  const linkedTags = db.select({
    id: tags.id,
    name: tags.name,
    color: tags.color,
  })
    .from(materialTags)
    .innerJoin(tags, eq(materialTags.tagId, tags.id))
    .where(eq(materialTags.materialId, materialId))
    .all();

  return {
    decks: linkedDecks,
    quizzes: linkedQuizzes,
    resources,
    tags: linkedTags,
  };
}
