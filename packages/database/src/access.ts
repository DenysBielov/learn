import { eq, and } from "drizzle-orm";
import { getDb } from "./index";
import * as schema from "./schema";

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

export function redactQuizAnswers<T extends Record<string, unknown>>(question: T): T {
  const redacted = { ...question };
  delete (redacted as any).correctAnswer;
  delete (redacted as any).explanation;
  return redacted;
}

export function redactQuestionOptions<T extends { isCorrect?: boolean }>(options: T[]): T[] {
  return options.map((opt) => ({ ...opt, isCorrect: undefined }));
}
