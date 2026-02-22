"use server";

import { z } from "zod";
import { getDb, writeTransaction } from "@flashcards/database";
import { tags, flashcardTags, questionTags, flashcards, quizQuestions, decks } from "@flashcards/database/schema";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { PRESET_COLORS } from "@/lib/tags";

const CONTROL_CHARS_RE = /[\x00-\x1f\x7f]/;

const tagNameSchema = z.string().trim().min(1).max(100).refine(
  (s) => !CONTROL_CHARS_RE.test(s),
  "Tag name must not contain control characters"
);

const colorSchema = z.enum(PRESET_COLORS).optional();

const positiveInt = z.number().int().positive();

export async function getTags() {
  const { userId } = await requireAuth();
  const db = getDb();
  return db.select().from(tags).where(eq(tags.userId, userId)).all();
}

export async function createTag(name: string, color?: string) {
  const { userId } = await requireAuth();
  const validName = tagNameSchema.parse(name);
  const validColor = colorSchema.parse(color);

  const db = getDb();

  // Round-robin color when none specified
  const assignedColor = validColor ?? (() => {
    const count = db.select({ id: tags.id }).from(tags).where(eq(tags.userId, userId)).all().length;
    return PRESET_COLORS[count % PRESET_COLORS.length];
  })();

  const [created] = writeTransaction(db, () =>
    db.insert(tags).values({ name: validName, color: assignedColor, userId }).returning().all()
  );
  return created;
}

export async function updateTag(tagId: number, name?: string, color?: string) {
  const { userId } = await requireAuth();
  positiveInt.parse(tagId);

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = tagNameSchema.parse(name);
  if (color !== undefined) updates.color = z.enum(PRESET_COLORS).parse(color);
  if (Object.keys(updates).length === 0) throw new Error("No fields to update");

  const db = getDb();
  const [updated] = writeTransaction(db, () =>
    db.update(tags).set(updates)
      .where(and(eq(tags.id, tagId), eq(tags.userId, userId)))
      .returning().all()
  );
  if (!updated) throw new Error("Tag not found");

  // Revalidate affected deck pages
  const affectedDecks = getAffectedDeckIds(db, tagId);
  for (const deckId of affectedDecks) {
    revalidatePath(`/decks/${deckId}`);
  }

  return updated;
}

export async function deleteTag(tagId: number) {
  const { userId } = await requireAuth();
  positiveInt.parse(tagId);
  const db = getDb();

  // Get affected decks before deletion
  const affectedDecks = getAffectedDeckIds(db, tagId);

  const deleted = writeTransaction(db, () =>
    db.delete(tags).where(and(eq(tags.id, tagId), eq(tags.userId, userId))).returning().all()
  );
  if (deleted.length === 0) throw new Error("Tag not found");

  for (const deckId of affectedDecks) {
    revalidatePath(`/decks/${deckId}`);
  }
}

export async function assignFlashcardTag(flashcardId: number, tagId: number, deckId: number) {
  const { userId } = await requireAuth();
  positiveInt.parse(flashcardId);
  positiveInt.parse(tagId);
  positiveInt.parse(deckId);
  const db = getDb();

  verifyTagOwnership(db, tagId, userId);
  verifyFlashcardOwnership(db, flashcardId, userId);

  writeTransaction(db, () =>
    db.insert(flashcardTags).values({ flashcardId, tagId }).onConflictDoNothing().run()
  );
  revalidatePath(`/decks/${deckId}`);
}

export async function removeFlashcardTag(flashcardId: number, tagId: number, deckId: number) {
  const { userId } = await requireAuth();
  positiveInt.parse(flashcardId);
  positiveInt.parse(tagId);
  positiveInt.parse(deckId);
  const db = getDb();

  verifyTagOwnership(db, tagId, userId);
  verifyFlashcardOwnership(db, flashcardId, userId);

  writeTransaction(db, () =>
    db.delete(flashcardTags)
      .where(and(eq(flashcardTags.flashcardId, flashcardId), eq(flashcardTags.tagId, tagId)))
      .run()
  );
  revalidatePath(`/decks/${deckId}`);
}

export async function assignQuestionTag(questionId: number, tagId: number, deckId: number) {
  const { userId } = await requireAuth();
  positiveInt.parse(questionId);
  positiveInt.parse(tagId);
  positiveInt.parse(deckId);
  const db = getDb();

  verifyTagOwnership(db, tagId, userId);
  verifyQuestionOwnership(db, questionId, userId);

  writeTransaction(db, () =>
    db.insert(questionTags).values({ questionId, tagId }).onConflictDoNothing().run()
  );
  revalidatePath(`/decks/${deckId}`);
}

export async function removeQuestionTag(questionId: number, tagId: number, deckId: number) {
  const { userId } = await requireAuth();
  positiveInt.parse(questionId);
  positiveInt.parse(tagId);
  positiveInt.parse(deckId);
  const db = getDb();

  verifyTagOwnership(db, tagId, userId);
  verifyQuestionOwnership(db, questionId, userId);

  writeTransaction(db, () =>
    db.delete(questionTags)
      .where(and(eq(questionTags.questionId, questionId), eq(questionTags.tagId, tagId)))
      .run()
  );
  revalidatePath(`/decks/${deckId}`);
}

const bulkIdsSchema = z.array(positiveInt).max(100);

export async function bulkUpdateFlashcardTags(
  flashcardIds: number[],
  addTagIds: number[],
  removeTagIds: number[],
  deckId: number
) {
  const { userId } = await requireAuth();
  const validFlashcardIds = bulkIdsSchema.parse(flashcardIds);
  const validAddTagIds = bulkIdsSchema.parse(addTagIds);
  const validRemoveTagIds = bulkIdsSchema.parse(removeTagIds);
  positiveInt.parse(deckId);

  const db = getDb();

  // Verify all ownership
  for (const tId of [...validAddTagIds, ...validRemoveTagIds]) {
    verifyTagOwnership(db, tId, userId);
  }
  for (const fId of validFlashcardIds) {
    verifyFlashcardOwnership(db, fId, userId);
  }

  writeTransaction(db, () => {
    for (const fId of validFlashcardIds) {
      for (const tId of validAddTagIds) {
        db.insert(flashcardTags).values({ flashcardId: fId, tagId: tId }).onConflictDoNothing().run();
      }
      for (const tId of validRemoveTagIds) {
        db.delete(flashcardTags)
          .where(and(eq(flashcardTags.flashcardId, fId), eq(flashcardTags.tagId, tId)))
          .run();
      }
    }
  });

  revalidatePath(`/decks/${deckId}`);
}

export async function bulkUpdateQuestionTags(
  questionIds: number[],
  addTagIds: number[],
  removeTagIds: number[],
  deckId: number
) {
  const { userId } = await requireAuth();
  const validQuestionIds = bulkIdsSchema.parse(questionIds);
  const validAddTagIds = bulkIdsSchema.parse(addTagIds);
  const validRemoveTagIds = bulkIdsSchema.parse(removeTagIds);
  positiveInt.parse(deckId);

  const db = getDb();

  for (const tId of [...validAddTagIds, ...validRemoveTagIds]) {
    verifyTagOwnership(db, tId, userId);
  }
  for (const qId of validQuestionIds) {
    verifyQuestionOwnership(db, qId, userId);
  }

  writeTransaction(db, () => {
    for (const qId of validQuestionIds) {
      for (const tId of validAddTagIds) {
        db.insert(questionTags).values({ questionId: qId, tagId: tId }).onConflictDoNothing().run();
      }
      for (const tId of validRemoveTagIds) {
        db.delete(questionTags)
          .where(and(eq(questionTags.questionId, qId), eq(questionTags.tagId, tId)))
          .run();
      }
    }
  });

  revalidatePath(`/decks/${deckId}`);
}

const itemIdsSchema = z.array(positiveInt).max(500);

export async function getTagsForItems(flashcardIds: number[], questionIds: number[]) {
  const { userId } = await requireAuth();
  const validFlashcardIds = itemIdsSchema.parse(flashcardIds);
  const validQuestionIds = itemIdsSchema.parse(questionIds);

  const db = getDb();
  const result: Record<string, { id: number; name: string; color: string | null }[]> = {};

  if (validFlashcardIds.length > 0) {
    const rows = db.all<{ flashcard_id: number; tag_id: number; tag_name: string; tag_color: string | null }>(sql`
      SELECT ft.flashcard_id, t.id AS tag_id, t.name AS tag_name, t.color AS tag_color
      FROM flashcard_tag ft
      JOIN tag t ON ft.tag_id = t.id
      JOIN flashcard f ON ft.flashcard_id = f.id
      JOIN deck d ON f.deck_id = d.id
      WHERE ft.flashcard_id IN (${sql.join(validFlashcardIds.map(id => sql`${id}`), sql`,`)})
        AND d.user_id = ${userId}
        AND t.user_id = ${userId}
    `);
    for (const row of rows) {
      const key = `f_${row.flashcard_id}`;
      if (!result[key]) result[key] = [];
      result[key].push({ id: row.tag_id, name: row.tag_name, color: row.tag_color });
    }
  }

  if (validQuestionIds.length > 0) {
    const rows = db.all<{ question_id: number; tag_id: number; tag_name: string; tag_color: string | null }>(sql`
      SELECT qt.question_id, t.id AS tag_id, t.name AS tag_name, t.color AS tag_color
      FROM question_tag qt
      JOIN tag t ON qt.tag_id = t.id
      JOIN quiz_question q ON qt.question_id = q.id
      JOIN deck d ON q.deck_id = d.id
      WHERE qt.question_id IN (${sql.join(validQuestionIds.map(id => sql`${id}`), sql`,`)})
        AND d.user_id = ${userId}
        AND t.user_id = ${userId}
    `);
    for (const row of rows) {
      const key = `q_${row.question_id}`;
      if (!result[key]) result[key] = [];
      result[key].push({ id: row.tag_id, name: row.tag_name, color: row.tag_color });
    }
  }

  return result;
}

// --- Helpers ---

function verifyTagOwnership(db: ReturnType<typeof getDb>, tagId: number, userId: number) {
  const tag = db.select({ id: tags.id }).from(tags)
    .where(and(eq(tags.id, tagId), eq(tags.userId, userId))).get();
  if (!tag) throw new Error("Tag not found");
}

function verifyFlashcardOwnership(db: ReturnType<typeof getDb>, flashcardId: number, userId: number) {
  const card = db.select({ id: flashcards.id }).from(flashcards)
    .innerJoin(decks, eq(flashcards.deckId, decks.id))
    .where(and(eq(flashcards.id, flashcardId), eq(decks.userId, userId))).get();
  if (!card) throw new Error("Flashcard not found");
}

function verifyQuestionOwnership(db: ReturnType<typeof getDb>, questionId: number, userId: number) {
  const q = db.select({ id: quizQuestions.id }).from(quizQuestions)
    .innerJoin(decks, eq(quizQuestions.deckId, decks.id))
    .where(and(eq(quizQuestions.id, questionId), eq(decks.userId, userId))).get();
  if (!q) throw new Error("Question not found");
}

function getAffectedDeckIds(db: ReturnType<typeof getDb>, tagId: number): number[] {
  const deckIds = new Set<number>();

  const fcRows = db.all<{ deck_id: number }>(sql`
    SELECT DISTINCT f.deck_id FROM flashcard_tag ft
    JOIN flashcard f ON ft.flashcard_id = f.id
    WHERE ft.tag_id = ${tagId}
  `);
  for (const r of fcRows) deckIds.add(r.deck_id);

  const qRows = db.all<{ deck_id: number }>(sql`
    SELECT DISTINCT q.deck_id FROM question_tag qt
    JOIN quiz_question q ON qt.question_id = q.id
    WHERE qt.tag_id = ${tagId}
  `);
  for (const r of qRows) deckIds.add(r.deck_id);

  return Array.from(deckIds);
}
