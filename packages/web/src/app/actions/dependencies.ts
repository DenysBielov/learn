"use server";

import { getDb, writeTransaction } from "@flashcards/database";
import { learningDependencies, courses, materials } from "@flashcards/database/schema";
import {
  verifySiblingConstraint,
  wouldCreateCycle,
  getDependenciesForCourse,
} from "@flashcards/database/dependencies";
import { requireAuth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createDependency(data: {
  courseItemId?: number;
  materialItemId?: number;
  dependsOnCourseId?: number;
  dependsOnMaterialId?: number;
}) {
  const { userId } = await requireAuth();
  const db = getDb();

  const item = {
    courseId: data.courseItemId,
    materialId: data.materialItemId,
  };
  const dependsOn = {
    courseId: data.dependsOnCourseId,
    materialId: data.dependsOnMaterialId,
  };

  // Validate exactly one on each side
  if (
    (!item.courseId && !item.materialId) ||
    (item.courseId && item.materialId)
  ) {
    throw new Error("Exactly one of courseItemId or materialItemId required");
  }
  if (
    (!dependsOn.courseId && !dependsOn.materialId) ||
    (dependsOn.courseId && dependsOn.materialId)
  ) {
    throw new Error(
      "Exactly one of dependsOnCourseId or dependsOnMaterialId required"
    );
  }

  const parentId = verifySiblingConstraint(db, item, dependsOn, userId);

  if (wouldCreateCycle(db, item, dependsOn)) {
    throw new Error("Adding this dependency would create a cycle");
  }

  const [dep] = writeTransaction(db, () =>
    db
      .insert(learningDependencies)
      .values({
        courseItemId: data.courseItemId ?? null,
        materialItemId: data.materialItemId ?? null,
        dependsOnCourseId: data.dependsOnCourseId ?? null,
        dependsOnMaterialId: data.dependsOnMaterialId ?? null,
      })
      .returning()
      .all()
  );

  revalidatePath(`/courses/${parentId}`);
  return dep;
}

export async function deleteDependency(dependencyId: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  const dep = db
    .select()
    .from(learningDependencies)
    .where(eq(learningDependencies.id, dependencyId))
    .get();
  if (!dep) throw new Error("Dependency not found");

  // Verify ownership through FK chain
  let authorized = false;

  if (dep.courseItemId) {
    const course = db
      .select({ id: courses.id })
      .from(courses)
      .where(
        and(eq(courses.id, dep.courseItemId), eq(courses.userId, userId))
      )
      .get();
    if (course) authorized = true;
  }

  if (!authorized && dep.materialItemId) {
    const material = db
      .select({ id: materials.id })
      .from(materials)
      .where(
        and(
          eq(materials.id, dep.materialItemId),
          eq(materials.userId, userId)
        )
      )
      .get();
    if (material) authorized = true;
  }

  if (!authorized) throw new Error("Not authorized");

  writeTransaction(db, () =>
    db
      .delete(learningDependencies)
      .where(eq(learningDependencies.id, dependencyId))
      .run()
  );

  revalidatePath("/courses");
}

export async function getCourseDependencies(courseId: number) {
  const { userId } = await requireAuth();
  const db = getDb();
  return getDependenciesForCourse(db, courseId, userId);
}
