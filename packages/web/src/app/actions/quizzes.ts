"use server";

import { getDb, writeTransaction } from "@flashcards/database";
import { quizzes, quizQuestions, questionOptions, courseSteps, courses, stepProgress, studySessions } from "@flashcards/database/schema";
import { createQuizSchema, updateQuizSchema } from "@flashcards/database/validation";
import { getNextStepPosition } from "@flashcards/database/courses";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

export async function createQuiz(courseId: number, data: {
  title: string;
  description?: string;
}) {
  const { userId } = await requireAuth();
  const parsed = createQuizSchema.parse(data);
  const db = getDb();

  const quiz = writeTransaction(db, () => {
    const course = db.select({ id: courses.id }).from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.userId, userId))).get();
    if (!course) throw new Error("Course not found");

    const [created] = db.insert(quizzes).values({
      title: parsed.title,
      description: parsed.description,
      userId,
    }).returning().all();

    const position = getNextStepPosition(db, courseId);
    db.insert(courseSteps).values({
      courseId,
      position,
      stepType: "quiz",
      quizId: created.id,
    }).run();

    return created;
  });

  revalidatePath(`/courses/${courseId}`);
  return quiz;
}

export async function updateQuiz(id: number, data: {
  title?: string;
  description?: string;
}) {
  const { userId } = await requireAuth();
  const parsed = updateQuizSchema.parse(data);
  const db = getDb();

  writeTransaction(db, () => {
    const existing = db.select({ id: quizzes.id }).from(quizzes)
      .where(and(eq(quizzes.id, id), eq(quizzes.userId, userId))).get();
    if (!existing) throw new Error("Quiz not found");

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.title !== undefined) updates.title = parsed.title;
    if (parsed.description !== undefined) updates.description = parsed.description;

    db.update(quizzes).set(updates)
      .where(and(eq(quizzes.id, id), eq(quizzes.userId, userId))).run();
  });

  revalidatePath("/");
}

export async function deleteQuiz(id: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  writeTransaction(db, () => {
    const existing = db.select({ id: quizzes.id }).from(quizzes)
      .where(and(eq(quizzes.id, id), eq(quizzes.userId, userId))).get();
    if (!existing) throw new Error("Quiz not found");

    db.delete(quizzes).where(eq(quizzes.id, id)).run();
  });

  revalidatePath("/");
}

export async function getQuiz(id: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  const quiz = db.select().from(quizzes)
    .where(and(eq(quizzes.id, id), eq(quizzes.userId, userId))).get();
  if (!quiz) return null;

  // Get questions with options
  const questions = db.query.quizQuestions.findMany({
    where: eq(quizQuestions.quizId, id),
    with: { options: true },
  }).sync();

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
    .where(eq(courseSteps.quizId, id))
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

  // Get past scores
  const pastScores = db.all<{
    id: number;
    started_at: number;
    completed_at: number | null;
    correct_count: number;
    total_count: number;
  }>(sql`
    SELECT
      s.id,
      s.started_at,
      s.completed_at,
      COALESCE(SUM(qr.correct), 0) AS correct_count,
      COUNT(qr.id) AS total_count
    FROM study_session s
    LEFT JOIN quiz_result qr ON qr.session_id = s.id
    WHERE s.quiz_id = ${id} AND s.user_id = ${userId} AND s.completed_at IS NOT NULL
    GROUP BY s.id
    ORDER BY s.started_at DESC
    LIMIT 5
  `);

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

  return {
    ...quiz,
    questions,
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
    pastScores: pastScores.map(s => ({
      id: s.id,
      startedAt: new Date(s.started_at * 1000),
      completedAt: s.completed_at ? new Date(s.completed_at * 1000) : null,
      correctCount: s.correct_count,
      totalCount: s.total_count,
    })),
  };
}
