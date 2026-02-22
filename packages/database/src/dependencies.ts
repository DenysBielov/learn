import { eq, and, or, sql, isNotNull } from "drizzle-orm";
import { type AppDatabase } from "./index.js";
import { learningDependencies, courses, courseSteps, materials } from "./schema.js";

/**
 * Verify both sides of a dependency share the same parent course.
 * Returns the shared parentId or throws if invalid.
 */
export function verifySiblingConstraint(
  db: AppDatabase,
  item: { courseId?: number; materialId?: number },
  dependsOn: { courseId?: number; materialId?: number },
  userId: number
): number {
  // Resolve parent course for the "item" side
  const itemParentId = item.courseId
    ? db.select({ parentId: courses.parentId })
        .from(courses)
        .where(and(eq(courses.id, item.courseId), eq(courses.userId, userId)))
        .get()?.parentId
    : db.select({ courseId: courseSteps.courseId })
        .from(courseSteps)
        .innerJoin(materials, eq(courseSteps.materialId, materials.id))
        .where(and(eq(materials.id, item.materialId!), eq(materials.userId, userId)))
        .get()?.courseId;

  // Resolve parent course for the "dependsOn" side
  const depParentId = dependsOn.courseId
    ? db.select({ parentId: courses.parentId })
        .from(courses)
        .where(and(eq(courses.id, dependsOn.courseId), eq(courses.userId, userId)))
        .get()?.parentId
    : db.select({ courseId: courseSteps.courseId })
        .from(courseSteps)
        .innerJoin(materials, eq(courseSteps.materialId, materials.id))
        .where(and(eq(materials.id, dependsOn.materialId!), eq(materials.userId, userId)))
        .get()?.courseId;

  if (itemParentId == null || depParentId == null) {
    throw new Error("One or both items not found or not owned by user");
  }
  if (itemParentId !== depParentId) {
    throw new Error("Dependencies must be between siblings in the same parent course");
  }
  return itemParentId;
}

/**
 * Detect cycles in the dependency graph using recursive CTE.
 * Returns true if adding this dependency would create a cycle.
 */
export function wouldCreateCycle(
  db: AppDatabase,
  item: { courseId?: number; materialId?: number },
  dependsOn: { courseId?: number; materialId?: number }
): boolean {
  const result = db.all(sql`
    WITH RECURSIVE dep_chain(node_type, node_id, depth) AS (
      SELECT
        CASE WHEN ${dependsOn.courseId ?? null} IS NOT NULL THEN 'course' ELSE 'material' END,
        COALESCE(${dependsOn.courseId ?? null}, ${dependsOn.materialId ?? null}),
        1
      UNION ALL
      SELECT
        CASE WHEN ld.depends_on_course_id IS NOT NULL THEN 'course' ELSE 'material' END,
        COALESCE(ld.depends_on_course_id, ld.depends_on_material_id),
        dc.depth + 1
      FROM learning_dependency ld
      JOIN dep_chain dc ON
        (dc.node_type = 'course' AND ld.course_item_id = dc.node_id)
        OR (dc.node_type = 'material' AND ld.material_item_id = dc.node_id)
      WHERE dc.depth < 10
    )
    SELECT 1 FROM dep_chain
    WHERE (node_type = 'course' AND node_id = ${item.courseId ?? null})
       OR (node_type = 'material' AND node_id = ${item.materialId ?? null})
    LIMIT 1
  `);
  return result.length > 0;
}

/**
 * Get all dependencies for items within a course (both sub-courses and materials).
 */
export function getDependenciesForCourse(
  db: AppDatabase,
  courseId: number,
  userId: number
) {
  // Verify course ownership
  const course = db.select({ id: courses.id })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
    .get();
  if (!course) throw new Error("Course not found");

  return db.select()
    .from(learningDependencies)
    .where(
      or(
        // Dependencies where item is a child course of this course
        and(
          isNotNull(learningDependencies.courseItemId),
          sql`${learningDependencies.courseItemId} IN (
            SELECT id FROM course WHERE parent_id = ${courseId}
          )`
        ),
        // Dependencies where item is a material in this course (via courseSteps)
        and(
          isNotNull(learningDependencies.materialItemId),
          sql`${learningDependencies.materialItemId} IN (
            SELECT material_id FROM course_step WHERE course_id = ${courseId} AND material_id IS NOT NULL
          )`
        )
      )
    )
    .all();
}

/**
 * Clean up dependencies when a course is re-parented.
 * Must be called within the same writeTransaction as the parentId update.
 */
export function cleanupDependenciesForCourse(db: AppDatabase, courseId: number) {
  db.delete(learningDependencies)
    .where(
      or(
        eq(learningDependencies.courseItemId, courseId),
        eq(learningDependencies.dependsOnCourseId, courseId)
      )
    )
    .run();
}

/**
 * Clean up dependencies when a material is removed from a course (courseStep deleted).
 * Must be called within the same writeTransaction as the courseStep deletion.
 */
export function cleanupDependenciesForMaterial(db: AppDatabase, materialId: number) {
  db.delete(learningDependencies)
    .where(
      or(
        eq(learningDependencies.materialItemId, materialId),
        eq(learningDependencies.dependsOnMaterialId, materialId)
      )
    )
    .run();
}
