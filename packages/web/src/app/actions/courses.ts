"use server";

import { getDb, writeTransaction } from "@flashcards/database";
import { courses, courseDecks, decks } from "@flashcards/database/schema";
import { createCourseSchema, updateCourseSchema, toggleCourseActiveSchema } from "@flashcards/database/validation";
import {
  checkCircularReference,
  getAncestorDepth,
  getDescendantCourseIds,
  getCourseBreadcrumbs as getCourseBreadcrumbsQuery,
  getDashboardCourseStats,
  getNextPosition,
  getNextDeckPosition,
} from "@flashcards/database/courses";
import { eq, sql, isNull, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

export async function createCourse(data: {
  name: string;
  description?: string;
  color?: string;
  parentId?: number;
}) {
  const { userId } = await requireAuth();
  const parsed = createCourseSchema.parse(data);
  const db = getDb();

  const course = writeTransaction(db, () => {
    if (parsed.parentId) {
      const parent = db.select({ id: courses.id }).from(courses)
        .where(and(eq(courses.id, parsed.parentId), eq(courses.userId, userId))).get();
      if (!parent) throw new Error("Parent course not found");
      getAncestorDepth(db, parsed.parentId, userId, true);
    }

    const position = getNextPosition(db, parsed.parentId ?? null, userId);

    const [created] = db.insert(courses).values({
      userId,
      name: parsed.name,
      description: parsed.description,
      color: parsed.color,
      parentId: parsed.parentId ?? null,
      position,
    }).returning().all();

    return created;
  });

  revalidatePath("/");
  return course;
}

export async function getCourse(id: number) {
  const { userId } = await requireAuth();
  const db = getDb();
  const course = db.select().from(courses).where(and(eq(courses.id, id), eq(courses.userId, userId))).get();
  if (!course) return null;

  const children = db.select({
    id: courses.id,
    name: courses.name,
    description: courses.description,
    color: courses.color,
    isActive: courses.isActive,
    position: courses.position,
    totalDecks: sql<number>`(SELECT COUNT(*) FROM course_deck WHERE course_deck.course_id = "course"."id")`,
    dueCards: sql<number>`(SELECT COUNT(*) FROM course_deck cd INNER JOIN flashcard f ON f.deck_id = cd.deck_id WHERE cd.course_id = "course"."id" AND f.next_review_at <= unixepoch())`,
  }).from(courses)
    .where(eq(courses.parentId, id))
    .orderBy(courses.position, courses.name)
    .all();

  const courseDeckRows = db.select({
    deckId: courseDecks.deckId,
    position: courseDecks.position,
    name: decks.name,
    description: decks.description,
    flashcardCount: sql<number>`(SELECT COUNT(*) FROM flashcard WHERE flashcard.deck_id = "deck"."id")`,
    questionCount: sql<number>`(SELECT COUNT(*) FROM quiz_question WHERE quiz_question.deck_id = "deck"."id")`,
    dueCount: sql<number>`(SELECT COUNT(*) FROM flashcard WHERE flashcard.deck_id = "deck"."id" AND flashcard.next_review_at <= unixepoch())`,
  })
    .from(courseDecks)
    .innerJoin(decks, eq(courseDecks.deckId, decks.id))
    .where(eq(courseDecks.courseId, id))
    .orderBy(courseDecks.position, decks.name)
    .all();

  return { ...course, children, decks: courseDeckRows };
}

export async function getTopLevelCourses() {
  const { userId } = await requireAuth();
  const db = getDb();
  const topCourses = db.select().from(courses)
    .where(and(isNull(courses.parentId), eq(courses.userId, userId)))
    .orderBy(courses.position, courses.name)
    .all();

  const stats = getDashboardCourseStats(db, userId);
  const statsMap = new Map(stats.map(s => [s.rootId, s]));

  return topCourses.map(c => ({
    ...c,
    totalDecks: statsMap.get(c.id)?.totalDecks ?? 0,
    dueCards: statsMap.get(c.id)?.dueCards ?? 0,
    isEffectivelyActive: statsMap.get(c.id)?.hasActiveDescendant ?? false,
  }));
}

export async function getUngroupedDecks() {
  const { userId } = await requireAuth();
  const db = getDb();
  return db.select({
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
    .where(sql`${decks.id} NOT IN (SELECT deck_id FROM course_deck) AND ${decks.userId} = ${userId}`)
    .all();
}

export async function updateCourse(id: number, data: {
  name?: string;
  description?: string;
  color?: string;
}) {
  const { userId } = await requireAuth();
  const parsed = updateCourseSchema.parse(data);
  const db = getDb();

  writeTransaction(db, () => {
    db.update(courses)
      .set({ ...parsed, updatedAt: new Date() })
      .where(and(eq(courses.id, id), eq(courses.userId, userId)))
      .run();
  });

  revalidatePath("/");
  revalidatePath(`/courses/${id}`);
}

export async function toggleCourseActive(id: number, isActive: boolean) {
  const { userId } = await requireAuth();
  const parsed = toggleCourseActiveSchema.parse({ id, isActive });
  const db = getDb();

  writeTransaction(db, () => {
    const course = db.select({ id: courses.id }).from(courses)
      .where(and(eq(courses.id, parsed.id), eq(courses.userId, userId))).get();
    if (!course) throw new Error("Course not found");

    db.update(courses)
      .set({ isActive: parsed.isActive, updatedAt: new Date() })
      .where(and(eq(courses.id, parsed.id), eq(courses.userId, userId)))
      .run();
  });

  revalidatePath("/");
  revalidatePath(`/courses/${id}`);
}

export async function deleteCourse(id: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  writeTransaction(db, () => {
    const course = db.select({ id: courses.id }).from(courses)
      .where(and(eq(courses.id, id), eq(courses.userId, userId))).get();
    if (!course) throw new Error("Course not found");

    const descendantIds = getDescendantCourseIds(db, id, userId);
    for (const descId of descendantIds) {
      db.delete(courseDecks).where(eq(courseDecks.courseId, descId)).run();
      db.delete(courses).where(eq(courses.id, descId)).run();
    }
  });

  revalidatePath("/");
}

export async function getCourseBreadcrumbs(courseId: number) {
  const { userId } = await requireAuth();
  const db = getDb();
  return getCourseBreadcrumbsQuery(db, courseId, userId);
}

export async function addDeckToCourse(courseId: number, deckId: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  writeTransaction(db, () => {
    const course = db.select({ id: courses.id }).from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.userId, userId))).get();
    if (!course) throw new Error("Course not found");
    const deck = db.select({ id: decks.id }).from(decks)
      .where(and(eq(decks.id, deckId), eq(decks.userId, userId))).get();
    if (!deck) throw new Error("Deck not found");

    const existing = db.select().from(courseDecks)
      .where(and(eq(courseDecks.courseId, courseId), eq(courseDecks.deckId, deckId))).get();
    if (existing) throw new Error("Deck already in course");

    const position = getNextDeckPosition(db, courseId);
    db.insert(courseDecks).values({ courseId, deckId, position }).run();
  });

  revalidatePath(`/courses/${courseId}`);
}

export async function removeDeckFromCourse(courseId: number, deckId: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  writeTransaction(db, () => {
    const course = db.select({ id: courses.id }).from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.userId, userId))).get();
    if (!course) throw new Error("Course not found");

    db.delete(courseDecks)
      .where(and(eq(courseDecks.courseId, courseId), eq(courseDecks.deckId, deckId)))
      .run();
  });

  revalidatePath(`/courses/${courseId}`);
}

export async function moveCourse(courseId: number, newParentId: number | null) {
  const { userId } = await requireAuth();
  const db = getDb();

  writeTransaction(db, () => {
    const course = db.select({ id: courses.id }).from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.userId, userId))).get();
    if (!course) throw new Error("Course not found");

    if (newParentId !== null) {
      const parent = db.select({ id: courses.id }).from(courses)
        .where(and(eq(courses.id, newParentId), eq(courses.userId, userId))).get();
      if (!parent) throw new Error("Target parent course not found");

      if (checkCircularReference(db, courseId, newParentId, userId)) {
        throw new Error("Cannot move course under its own descendant");
      }

      getAncestorDepth(db, newParentId, userId, true);
    }

    const position = getNextPosition(db, newParentId, userId);
    db.update(courses)
      .set({ parentId: newParentId, position, updatedAt: new Date() })
      .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
      .run();
  });

  revalidatePath("/");
}

export async function getAvailableDecks(courseId: number) {
  const { userId } = await requireAuth();
  const db = getDb();
  return db.select({
    id: decks.id,
    name: decks.name,
  })
    .from(decks)
    .where(sql`${decks.id} NOT IN (SELECT deck_id FROM course_deck WHERE course_id = ${courseId}) AND ${decks.userId} = ${userId}`)
    .orderBy(decks.name)
    .all();
}
