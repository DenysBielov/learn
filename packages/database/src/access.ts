import { eq, and, sql } from "drizzle-orm";
import { getDb } from "./index";
import * as schema from "./schema";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

type Course = typeof schema.courses.$inferSelect;

/**
 * Get effective visibility for a course.
 * Top-level courses use their own visibility.
 * Sub-courses resolve via rootCourseId denormalization.
 * @param rootVisibility - Optional pre-fetched root visibility (avoids extra DB query)
 */
export function getEffectiveVisibility(
  course: Course,
  rootVisibility?: "private" | "public" | "forkable"
): "private" | "public" | "forkable" {
  if (!course.parentId) return course.visibility;
  if (rootVisibility) return rootVisibility;
  if (course.rootCourseId) {
    const db = getDb();
    const root = db.select({ visibility: schema.courses.visibility })
      .from(schema.courses)
      .where(and(
        eq(schema.courses.id, course.rootCourseId),
        eq(schema.courses.userId, course.userId) // Validate ownership match
      ))
      .get();
    return root?.visibility ?? "private";
  }
  return "private";
}

export function canViewCourse(course: Course, userId?: number): boolean {
  if (userId && course.userId === userId) return true;
  const visibility = getEffectiveVisibility(course);
  return visibility === "public" || visibility === "forkable";
}

export function canForkCourse(course: Course, userId?: number): boolean {
  if (!userId) return false;
  if (course.userId === userId) return false;
  const visibility = getEffectiveVisibility(course);
  return visibility === "forkable";
}

/**
 * Check if a material belongs to a public/forkable course via course_step.
 * Returns course context if public, null otherwise.
 */
export function isPublicMaterial(db: BetterSQLite3Database<typeof schema>, materialId: number) {
  const row = db.select({
    courseId: schema.courses.id,
    courseName: schema.courses.name,
    coursePublicId: schema.courses.publicId,
    courseColor: schema.courses.color,
  })
    .from(schema.courseSteps)
    .innerJoin(schema.courses, eq(schema.courseSteps.courseId, schema.courses.id))
    .where(eq(schema.courseSteps.materialId, materialId))
    .get();
  if (!row) return null;

  const course = db.select().from(schema.courses).where(eq(schema.courses.id, row.courseId)).get();
  if (!course) return null;

  const visibility = getEffectiveVisibility(course);
  if (visibility !== "public" && visibility !== "forkable") return null;
  return row;
}

/**
 * Check if a quiz belongs to a public/forkable course via course_step.
 */
export function isPublicQuiz(db: BetterSQLite3Database<typeof schema>, quizId: number) {
  const row = db.select({
    courseId: schema.courses.id,
    courseName: schema.courses.name,
    coursePublicId: schema.courses.publicId,
    courseColor: schema.courses.color,
  })
    .from(schema.courseSteps)
    .innerJoin(schema.courses, eq(schema.courseSteps.courseId, schema.courses.id))
    .where(eq(schema.courseSteps.quizId, quizId))
    .get();
  if (!row) return null;

  const course = db.select().from(schema.courses).where(eq(schema.courses.id, row.courseId)).get();
  if (!course) return null;

  const visibility = getEffectiveVisibility(course);
  if (visibility !== "public" && visibility !== "forkable") return null;
  return row;
}

/**
 * Check if a deck belongs to a public/forkable course via course_deck.
 */
export function isPublicDeck(db: BetterSQLite3Database<typeof schema>, deckId: number) {
  const row = db.select({
    courseId: schema.courses.id,
    courseName: schema.courses.name,
    coursePublicId: schema.courses.publicId,
    courseColor: schema.courses.color,
  })
    .from(schema.courseDecks)
    .innerJoin(schema.courses, eq(schema.courseDecks.courseId, schema.courses.id))
    .where(eq(schema.courseDecks.deckId, deckId))
    .get();
  if (!row) return null;

  const course = db.select().from(schema.courses).where(eq(schema.courses.id, row.courseId)).get();
  if (!course) return null;

  const visibility = getEffectiveVisibility(course);
  if (visibility !== "public" && visibility !== "forkable") return null;
  return row;
}

export function redactQuizAnswers<T extends Record<string, unknown>>(question: T): T {
  const redacted = { ...question };
  delete (redacted as any).correctAnswer;
  delete (redacted as any).explanation;
  return redacted;
}

export function redactQuestionOptions<T extends { isCorrect?: boolean }>(options: T[]): T[] {
  return options.map((opt) => ({ ...opt, isCorrect: undefined }));
}
