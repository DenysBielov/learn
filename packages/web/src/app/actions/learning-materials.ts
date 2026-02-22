"use server";

import { getDb, writeTransaction } from "@flashcards/database";
import { learningMaterials, flashcards, quizQuestions, decks } from "@flashcards/database/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

const ALLOWED_URL_SCHEMES = ["http:", "https:", "obsidian:"];

function validateUrl(url: string): void {
  if (url.startsWith("obsidian://")) return; // obsidian:// is valid but URL constructor may not parse it
  try {
    const parsed = new URL(url);
    if (!ALLOWED_URL_SCHEMES.includes(parsed.protocol)) {
      throw new Error(`URL scheme "${parsed.protocol}" is not allowed. Allowed: ${ALLOWED_URL_SCHEMES.join(", ")}`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("not allowed")) throw e;
    throw new Error("Invalid URL format");
  }
}

function detectType(url: string): "article" | "video" | "obsidian" | "other" {
  if (url.startsWith("obsidian://")) return "obsidian";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "video";
  return "article";
}

export async function addLearningMaterial(
  url: string,
  flashcardId?: number,
  questionId?: number,
  title?: string,
) {
  const { userId } = await requireAuth();
  if (!flashcardId && !questionId) throw new Error("Must specify flashcardId or questionId");
  if (flashcardId && questionId) throw new Error("Specify only one of flashcardId or questionId");
  if (url.length > 2048) throw new Error("URL must be 2048 characters or fewer");
  if (title && title.length > 500) throw new Error("Title must be 500 characters or fewer");

  validateUrl(url);

  const db = getDb();
  const type = detectType(url);

  // Verify ownership through deck
  if (flashcardId) {
    const card = db.select({ id: flashcards.id }).from(flashcards)
      .innerJoin(decks, eq(flashcards.deckId, decks.id))
      .where(and(eq(flashcards.id, flashcardId), eq(decks.userId, userId)))
      .get();
    if (!card) throw new Error("Flashcard not found");
  }
  if (questionId) {
    const q = db.select({ id: quizQuestions.id }).from(quizQuestions)
      .innerJoin(decks, eq(quizQuestions.deckId, decks.id))
      .where(and(eq(quizQuestions.id, questionId), eq(decks.userId, userId)))
      .get();
    if (!q) throw new Error("Question not found");
  }

  const [material] = writeTransaction(db, () => {
    // Position query inside transaction to avoid race condition
    const maxPos = db.select({ position: learningMaterials.position })
      .from(learningMaterials)
      .where(
        flashcardId
          ? eq(learningMaterials.flashcardId, flashcardId)
          : eq(learningMaterials.questionId, questionId!)
      )
      .all();

    const nextPosition = maxPos.length > 0
      ? Math.max(...maxPos.map(m => m.position)) + 1
      : 0;

    return db.insert(learningMaterials).values({
      flashcardId: flashcardId ?? null,
      questionId: questionId ?? null,
      url,
      title: title || null,
      type,
      position: nextPosition,
    }).returning().all();
  });

  revalidatePath("/decks");
  return material;
}

export async function removeLearningMaterial(id: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  // Look up the material and verify ownership through parent flashcard/question → deck
  const material = db.select({
    id: learningMaterials.id,
    flashcardId: learningMaterials.flashcardId,
    questionId: learningMaterials.questionId,
  }).from(learningMaterials).where(eq(learningMaterials.id, id)).get();

  if (!material) throw new Error("Material not found");

  if (material.flashcardId) {
    const card = db.select({ id: flashcards.id }).from(flashcards)
      .innerJoin(decks, eq(flashcards.deckId, decks.id))
      .where(and(eq(flashcards.id, material.flashcardId), eq(decks.userId, userId)))
      .get();
    if (!card) throw new Error("Not authorized");
  } else if (material.questionId) {
    const q = db.select({ id: quizQuestions.id }).from(quizQuestions)
      .innerJoin(decks, eq(quizQuestions.deckId, decks.id))
      .where(and(eq(quizQuestions.id, material.questionId), eq(decks.userId, userId)))
      .get();
    if (!q) throw new Error("Not authorized");
  }

  writeTransaction(db, () =>
    db.delete(learningMaterials).where(eq(learningMaterials.id, id)).run()
  );

  revalidatePath("/decks");
}

// Note: getLearningMaterials is not needed as a standalone action.
// Deck view gets materials via getDeck eager loading (Task 3).
// Study/quiz gets materials via attachLearningMaterials/Drizzle with clause (Task 9).
// MCP has its own list_learning_materials tool (Task 8).
