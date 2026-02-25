"use server";

import { getDb, writeTransaction } from "@flashcards/database";
import { materials, courseSteps, courses, stepProgress, materialDecks, materialQuizzes, materialResources, decks, quizzes } from "@flashcards/database/schema";
import { createMaterialSchema, updateMaterialSchema } from "@flashcards/database/validation";
import { getNextStepPosition } from "@flashcards/database/courses";
import { cleanupDependenciesForMaterial } from "@flashcards/database/dependencies";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { sanitizeMarkdownImageUrls } from "@flashcards/shared";

function validateUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("URL must use https or http protocol");
  }
}

export async function createMaterial(courseId: number, data: {
  title: string;
  content?: string;
  externalUrl?: string;
}) {
  const { userId } = await requireAuth();
  const parsed = createMaterialSchema.parse(data);
  const db = getDb();

  const material = writeTransaction(db, () => {
    const course = db.select({ id: courses.id }).from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.userId, userId))).get();
    if (!course) throw new Error("Course not found");

    if (parsed.externalUrl) validateUrl(parsed.externalUrl);

    const content = parsed.content ? sanitizeMarkdownImageUrls(parsed.content) : undefined;

    const [created] = db.insert(materials).values({
      title: parsed.title,
      content: content ?? null,
      externalUrl: parsed.externalUrl ?? null,
      userId,
    }).returning().all();

    const position = getNextStepPosition(db, courseId);
    db.insert(courseSteps).values({
      courseId,
      position,
      stepType: "material",
      materialId: created.id,
    }).run();

    return created;
  });

  revalidatePath(`/courses/${courseId}`);
  return material;
}

export async function updateMaterial(id: number, data: {
  title?: string;
  content?: string;
  externalUrl?: string;
}) {
  const { userId } = await requireAuth();
  const parsed = updateMaterialSchema.parse(data);
  const db = getDb();

  writeTransaction(db, () => {
    const existing = db.select({ id: materials.id }).from(materials)
      .where(and(eq(materials.id, id), eq(materials.userId, userId))).get();
    if (!existing) throw new Error("Material not found");

    if (parsed.externalUrl) validateUrl(parsed.externalUrl);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.title !== undefined) updates.title = parsed.title;
    if (parsed.content !== undefined) updates.content = sanitizeMarkdownImageUrls(parsed.content);
    if (parsed.externalUrl !== undefined) updates.externalUrl = parsed.externalUrl;

    db.update(materials).set(updates)
      .where(and(eq(materials.id, id), eq(materials.userId, userId))).run();
  });

  revalidatePath("/");
}

export async function deleteMaterial(id: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  writeTransaction(db, () => {
    const existing = db.select({ id: materials.id }).from(materials)
      .where(and(eq(materials.id, id), eq(materials.userId, userId))).get();
    if (!existing) throw new Error("Material not found");

    // Clean up dependencies referencing this material before deleting
    cleanupDependenciesForMaterial(db, id);

    db.delete(materials).where(eq(materials.id, id)).run();
  });

  revalidatePath("/");
}

export async function updateMaterialNotes(materialId: number, notes: string) {
  const { userId } = await requireAuth();
  const db = getDb();

  writeTransaction(db, () =>
    db.update(materials)
      .set({ notes, updatedAt: new Date() })
      .where(and(eq(materials.id, materialId), eq(materials.userId, userId)))
      .run()
  );
}

export async function getMaterial(id: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  const material = db.select().from(materials)
    .where(and(eq(materials.id, id), eq(materials.userId, userId))).get();
  if (!material) return null;

  // Get course context via course_step
  const step = db.select({
    stepId: courseSteps.id,
    courseId: courseSteps.courseId,
    position: courseSteps.position,
    courseName: courses.name,
    courseColor: courses.color,
  })
    .from(courseSteps)
    .innerJoin(courses, eq(courseSteps.courseId, courses.id))
    .where(eq(courseSteps.materialId, id))
    .get();

  // Get completion state
  let isCompleted = false;
  if (step) {
    const progress = db.select({ isCompleted: stepProgress.isCompleted })
      .from(stepProgress)
      .where(and(
        eq(stepProgress.courseStepId, step.stepId),
        eq(stepProgress.userId, userId),
      )).get();
    isCompleted = progress?.isCompleted ?? false;
  }

  // Get adjacent steps for navigation
  let prevStep: { id: number; stepType: string; materialId: number | null; quizId: number | null } | undefined;
  let nextStep: { id: number; stepType: string; materialId: number | null; quizId: number | null } | undefined;

  if (step) {
    const allSteps = db.select({
      id: courseSteps.id,
      position: courseSteps.position,
      stepType: courseSteps.stepType,
      materialId: courseSteps.materialId,
      quizId: courseSteps.quizId,
    })
      .from(courseSteps)
      .where(eq(courseSteps.courseId, step.courseId))
      .orderBy(courseSteps.position)
      .all();

    const currentIdx = allSteps.findIndex(s => s.id === step.stepId);
    if (currentIdx > 0) prevStep = allSteps[currentIdx - 1];
    if (currentIdx < allSteps.length - 1) nextStep = allSteps[currentIdx + 1];
  }

  // Linked decks
  const linkedDecks = db.select({
    id: decks.id,
    name: decks.name,
    flashcardCount: sql<number>`(SELECT COUNT(*) FROM flashcard WHERE flashcard.deck_id = ${decks.id})`,
  }).from(materialDecks)
    .innerJoin(decks, eq(materialDecks.deckId, decks.id))
    .where(eq(materialDecks.materialId, id))
    .all();

  // Linked quizzes
  const linkedQuizzes = db.select({
    id: quizzes.id,
    title: quizzes.title,
  }).from(materialQuizzes)
    .innerJoin(quizzes, eq(materialQuizzes.quizId, quizzes.id))
    .where(eq(materialQuizzes.materialId, id))
    .all();

  // Resources
  const resources = db.select({
    id: materialResources.id,
    url: materialResources.url,
    title: materialResources.title,
    type: materialResources.type,
  }).from(materialResources)
    .where(eq(materialResources.materialId, id))
    .orderBy(materialResources.createdAt)
    .all();

  return {
    ...material,
    step: step ? {
      id: step.stepId,
      courseId: step.courseId,
      position: step.position,
      courseName: step.courseName,
      courseColor: step.courseColor,
      isCompleted,
    } : null,
    prevStep: prevStep ?? null,
    nextStep: nextStep ?? null,
    linkedDecks,
    linkedQuizzes,
    resources,
  };
}

export async function getMaterialForPanel(materialId: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  const material = db.select({
    id: materials.id,
    title: materials.title,
    content: materials.content,
    externalUrl: materials.externalUrl,
  }).from(materials)
    .where(and(eq(materials.id, materialId), eq(materials.userId, userId)))
    .get();

  if (!material) return null;

  // Get step completion state (if this material is in a course)
  const step = db.select({
    id: courseSteps.id,
    isCompleted: stepProgress.isCompleted,
  }).from(courseSteps)
    .leftJoin(stepProgress, and(
      eq(stepProgress.courseStepId, courseSteps.id),
      eq(stepProgress.userId, userId)
    ))
    .where(eq(courseSteps.materialId, materialId))
    .get();

  // Linked decks
  const linkedDecks = db.select({
    id: decks.id,
    name: decks.name,
    flashcardCount: sql<number>`(SELECT COUNT(*) FROM flashcard WHERE deck_id = ${decks.id})`,
  }).from(materialDecks)
    .innerJoin(decks, eq(decks.id, materialDecks.deckId))
    .where(eq(materialDecks.materialId, materialId))
    .all();

  // Linked quizzes
  const linkedQuizzes = db.select({
    id: quizzes.id,
    title: quizzes.title,
  }).from(materialQuizzes)
    .innerJoin(quizzes, eq(quizzes.id, materialQuizzes.quizId))
    .where(eq(materialQuizzes.materialId, materialId))
    .all();

  return {
    ...material,
    step: step ? { id: step.id, isCompleted: !!step.isCompleted } : null,
    linkedDecks,
    linkedQuizzes,
  };
}
