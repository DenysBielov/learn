"use server";

import { getDb, writeTransaction } from "@flashcards/database";
import { quizzes, quizQuestions, questionOptions, courseSteps, courses, stepProgress, studySessions } from "@flashcards/database/schema";
import { createQuizSchema, updateQuizSchema } from "@flashcards/database/validation";
import { getNextStepPosition } from "@flashcards/database/courses";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, getAuthUser } from "@/lib/auth";
import { isPublicQuiz } from "@flashcards/database/access";

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
  const user = await getAuthUser();
  const db = getDb();
  let isPublicView = false;

  let quiz = user
    ? db.select().from(quizzes).where(and(eq(quizzes.id, id), eq(quizzes.userId, user.userId))).get()
    : null;

  if (!quiz) {
    const courseCtx = isPublicQuiz(db, id);
    if (!courseCtx) return null;
    quiz = db.select().from(quizzes).where(eq(quizzes.id, id)).get();
    if (!quiz) return null;
    isPublicView = true;
  }

  const questions = db.query.quizQuestions.findMany({
    where: eq(quizQuestions.quizId, id),
    with: { options: true },
  }).sync();

  const step = db.select({
    stepId: courseSteps.id,
    courseId: courseSteps.courseId,
    position: courseSteps.position,
    courseName: courses.name,
    courseColor: courses.color,
    coursePublicId: courses.publicId,
  })
    .from(courseSteps)
    .innerJoin(courses, eq(courseSteps.courseId, courses.id))
    .where(eq(courseSteps.quizId, id))
    .get();

  let isCompleted = false;
  if (step && user && !isPublicView) {
    const progress = db.select({ isCompleted: stepProgress.isCompleted })
      .from(stepProgress)
      .where(and(
        eq(stepProgress.courseStepId, step.stepId),
        eq(stepProgress.userId, user.userId),
      )).get();
    isCompleted = progress?.isCompleted ?? false;
  }

  const pastScores = !isPublicView && user ? db.all<{
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
    INNER JOIN session_activity sa ON sa.session_id = s.id AND sa.quiz_id = ${id}
    LEFT JOIN quiz_result qr ON qr.activity_id = sa.id
    WHERE s.user_id = ${user.userId} AND s.completed_at IS NOT NULL
    GROUP BY s.id
    ORDER BY s.started_at DESC
    LIMIT 5
  `) : [];

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
    isPublicView,
    questions,
    step: step ? {
      id: step.stepId,
      courseId: step.courseId,
      coursePublicId: step.coursePublicId,
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
