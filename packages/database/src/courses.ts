import { sql } from "drizzle-orm";
import type { AppDatabase } from "./index";

/**
 * Check if newParentId is the course itself or one of its descendants.
 * Uses UNION (not UNION ALL) for safety — terminates if corrupt cycle exists.
 */
export function checkCircularReference(
  db: AppDatabase,
  courseId: number,
  newParentId: number,
  userId: number
): boolean {
  const result = db.all<{ found: number }>(sql`
    WITH RECURSIVE descendants AS (
      SELECT id FROM course WHERE id = ${courseId} AND user_id = ${userId}
      UNION
      SELECT c.id FROM course c
      JOIN descendants d ON c.parent_id = d.id
    )
    SELECT 1 AS found FROM descendants WHERE id = ${newParentId}
    LIMIT 1
  `);
  return result.length > 0;
}

/**
 * Get the depth of the given parentId (how many ancestors it has + 1).
 * Returns 0 if parentId is null (top-level).
 * If validate=true, throws if depth would exceed 10.
 */
export function getAncestorDepth(
  db: AppDatabase,
  parentId: number | null,
  userId: number,
  validate: boolean = false
): number {
  if (parentId === null) return 0;

  const result = db.all<{ depth: number }>(sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id, 1 AS depth FROM course WHERE id = ${parentId} AND user_id = ${userId}
      UNION ALL
      SELECT c.id, c.parent_id, a.depth + 1 FROM course c
      JOIN ancestors a ON c.id = a.parent_id
      WHERE a.depth < 11
    )
    SELECT MAX(depth) AS depth FROM ancestors
  `);

  const depth = result[0]?.depth ?? 0;

  if (validate && depth >= 10) {
    throw new Error("Nesting depth exceeds maximum of 10 levels");
  }

  return depth;
}

/**
 * Collect all deck IDs from a course and all its descendants.
 * Uses UNION ALL with depth limit (cycles prevented at write time).
 */
export function getDescendantDeckIds(
  db: AppDatabase,
  courseId: number,
  userId: number
): number[] {
  const result = db.all<{ deck_id: number }>(sql`
    WITH RECURSIVE course_tree AS (
      SELECT id, 1 AS depth FROM course WHERE id = ${courseId} AND user_id = ${userId}
      UNION ALL
      SELECT c.id, ct.depth + 1 FROM course c
      JOIN course_tree ct ON c.parent_id = ct.id
      WHERE ct.depth < 10
    )
    SELECT DISTINCT cd.deck_id
    FROM course_deck cd
    JOIN course_tree ct ON cd.course_id = ct.id
  `);
  return result.map(r => r.deck_id);
}

/**
 * Get all descendant course IDs (deepest first for bottom-up deletion).
 */
export function getDescendantCourseIds(
  db: AppDatabase,
  courseId: number,
  userId: number
): number[] {
  const result = db.all<{ id: number; depth: number }>(sql`
    WITH RECURSIVE course_tree AS (
      SELECT id, 1 AS depth FROM course WHERE id = ${courseId} AND user_id = ${userId}
      UNION ALL
      SELECT c.id, ct.depth + 1 FROM course c
      JOIN course_tree ct ON c.parent_id = ct.id
      WHERE ct.depth < 10
    )
    SELECT id, depth FROM course_tree ORDER BY depth DESC
  `);
  return result.map(r => r.id);
}

/**
 * Get breadcrumb trail from root to given course.
 * Returns array of { id, name } from root to the course itself.
 */
export function getCourseBreadcrumbs(
  db: AppDatabase,
  courseId: number,
  userId: number
): { id: number; name: string }[] {
  const result = db.all<{ id: number; name: string; depth: number }>(sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, name, parent_id, 1 AS depth FROM course WHERE id = ${courseId} AND user_id = ${userId}
      UNION ALL
      SELECT c.id, c.name, c.parent_id, a.depth + 1 FROM course c
      JOIN ancestors a ON c.id = a.parent_id
      WHERE a.depth < 11
    )
    SELECT id, name, depth FROM ancestors ORDER BY depth DESC
  `);
  return result.map(r => ({ id: r.id, name: r.name }));
}

/**
 * Dashboard stats: total decks, due cards, and active-descendant flag per top-level course.
 * The hasActiveDescendant flag uses MAX(is_active) to bubble up: a root course
 * is "effectively active" if it or any descendant has is_active = 1.
 */
export function getDashboardCourseStats(
  db: AppDatabase,
  userId: number
): { rootId: number; totalDecks: number; dueCards: number; hasActiveDescendant: boolean }[] {
  return db.all<{ rootId: number; totalDecks: number; dueCards: number; hasActiveDescendant: number }>(sql`
    WITH RECURSIVE course_tree AS (
      SELECT id, id AS root_id, is_active, 1 AS depth FROM course WHERE parent_id IS NULL AND user_id = ${userId}
      UNION ALL
      SELECT c.id, ct.root_id, c.is_active, ct.depth + 1 FROM course c
      JOIN course_tree ct ON c.parent_id = ct.id
      WHERE ct.depth < 10
    ),
    root_decks AS (
      SELECT DISTINCT ct.root_id, cd.deck_id
      FROM course_tree ct
      JOIN course_deck cd ON cd.course_id = ct.id
    ),
    active_flags AS (
      SELECT root_id, MAX(is_active) AS has_active
      FROM course_tree
      GROUP BY root_id
    )
    SELECT
      rd.root_id AS rootId,
      COUNT(rd.deck_id) AS totalDecks,
      COUNT(CASE WHEN f.next_review_at <= unixepoch() THEN 1 END) AS dueCards,
      COALESCE(af.has_active, 0) AS hasActiveDescendant
    FROM root_decks rd
    LEFT JOIN flashcard f ON f.deck_id = rd.deck_id
    LEFT JOIN active_flags af ON af.root_id = rd.root_id
    GROUP BY rd.root_id
  `).map(row => ({
    rootId: row.rootId,
    totalDecks: row.totalDecks,
    dueCards: row.dueCards,
    hasActiveDescendant: !!row.hasActiveDescendant,
  }));
}

/**
 * Get next position for a new sibling under given parentId.
 */
export function getNextPosition(
  db: AppDatabase,
  parentId: number | null,
  userId: number
): number {
  const condition = parentId === null
    ? sql`parent_id IS NULL AND user_id = ${userId}`
    : sql`parent_id = ${parentId} AND user_id = ${userId}`;
  const result = db.all<{ maxPos: number | null }>(
    sql`SELECT MAX(position) AS maxPos FROM course WHERE ${condition}`
  );
  return (result[0]?.maxPos ?? -1) + 1;
}

/**
 * Get next position for a deck within a course.
 */
export function getNextDeckPosition(
  db: AppDatabase,
  courseId: number
): number {
  const result = db.all<{ maxPos: number | null }>(
    sql`SELECT MAX(position) AS maxPos FROM course_deck WHERE course_id = ${courseId}`
  );
  return (result[0]?.maxPos ?? -1) + 1;
}

/**
 * Count due flashcards across all explicitly active courses and their descendants.
 * Uses a single recursive CTE seeded with is_active = 1 courses.
 * Deduplicates decks via an intermediate CTE to avoid double-counting when
 * a deck belongs to multiple courses in the active tree.
 */
export function getActiveCoursesDueCount(
  db: AppDatabase,
  userId: number
): number {
  const result = db.all<{ dueCards: number }>(sql`
    WITH RECURSIVE active_tree AS (
      SELECT id, 1 AS depth FROM course WHERE is_active = 1 AND user_id = ${userId}
      UNION ALL
      SELECT c.id, at.depth + 1 FROM course c
      JOIN active_tree at ON c.parent_id = at.id
      WHERE at.depth < 10
    ),
    active_decks AS (
      SELECT DISTINCT cd.deck_id FROM course_deck cd
      JOIN active_tree at ON cd.course_id = at.id
    )
    SELECT COUNT(*) AS dueCards
    FROM flashcard f
    JOIN active_decks ad ON f.deck_id = ad.deck_id
    WHERE f.next_review_at <= unixepoch()
  `);
  return result[0]?.dueCards ?? 0;
}

/**
 * Get next position for a step within a course.
 */
export function getNextStepPosition(
  db: AppDatabase,
  courseId: number
): number {
  const result = db.all<{ maxPos: number | null }>(
    sql`SELECT MAX(position) AS maxPos FROM course_step WHERE course_id = ${courseId}`
  );
  return (result[0]?.maxPos ?? -1) + 1;
}

/**
 * Collect all quiz IDs from a course and all its descendants via course_step.
 * Uses UNION ALL with depth limit (cycles prevented at write time).
 */
export function getDescendantQuizIds(
  db: AppDatabase,
  courseId: number,
  userId: number
): number[] {
  const result = db.all<{ quiz_id: number }>(sql`
    WITH RECURSIVE course_tree AS (
      SELECT id, 1 AS depth FROM course WHERE id = ${courseId} AND user_id = ${userId}
      UNION ALL
      SELECT c.id, ct.depth + 1 FROM course c
      JOIN course_tree ct ON c.parent_id = ct.id
      WHERE ct.depth < 10
    )
    SELECT DISTINCT cs.quiz_id
    FROM course_step cs
    JOIN course_tree ct ON cs.course_id = ct.id
    WHERE cs.quiz_id IS NOT NULL
  `);
  return result.map(r => r.quiz_id);
}
