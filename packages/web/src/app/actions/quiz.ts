"use server";

import { z } from "zod";
import { getDb, writeTransaction } from "@flashcards/database";
import { quizQuestions, quizResults, studySessions, sessionActivities, quizzes, questionOptions } from "@flashcards/database/schema";
import { and, eq, sql } from "drizzle-orm";
import { getDescendantQuizIds } from "@flashcards/database/courses";
import { requireAuth, getAuthUser } from "@/lib/auth";
import { isPublicQuiz } from "@flashcards/database/access";

const confidenceSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).nullable().optional();

export async function submitQuizAnswer(
  sessionId: number | null,
  activityId: number | null,
  questionId: number,
  correct: boolean,
  userAnswer: string,
  timeSpentMs: number,
  selectedOptionId: number | null = null,
  confidence: 1 | 2 | 3 | 4 | 5 | null = null,
  note: string | null = null,
): Promise<{ id: number } | undefined> {
  if (sessionId !== null) z.number().int().positive().parse(sessionId);
  if (activityId !== null) z.number().int().positive().parse(activityId);
  if (selectedOptionId !== null) z.number().int().positive().parse(selectedOptionId);
  confidenceSchema.parse(confidence);

  const user = await getAuthUser();
  if (!user) return; // Public view — don't save progress
  const userId = user.userId;
  const db = getDb();

  const question = db.select({ id: quizQuestions.id }).from(quizQuestions)
    .innerJoin(quizzes, eq(quizQuestions.quizId, quizzes.id))
    .where(and(eq(quizQuestions.id, questionId), eq(quizzes.userId, userId))).get();
  if (!question) throw new Error("Question not found");

  if (selectedOptionId !== null) {
    const opt = db.select({ id: questionOptions.id }).from(questionOptions)
      .where(and(eq(questionOptions.id, selectedOptionId), eq(questionOptions.questionId, questionId)))
      .get();
    if (!opt) throw new Error("Selected option does not belong to the question");
  }

  if (sessionId !== null) {
    const session = db.select({ id: studySessions.id, discardedAt: studySessions.discardedAt }).from(studySessions)
      .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId))).get();
    if (!session) throw new Error("Session not found");
    if (session.discardedAt) throw new Error("Session is discarded");
  }

  if (activityId !== null) {
    const activity = db.select({ id: sessionActivities.id, sessionId: sessionActivities.sessionId })
      .from(sessionActivities)
      .innerJoin(studySessions, eq(sessionActivities.sessionId, studySessions.id))
      .where(and(
        eq(sessionActivities.id, activityId),
        eq(studySessions.userId, userId),
      ))
      .get();
    if (!activity) throw new Error("Activity not found");
    if (sessionId !== null && activity.sessionId !== sessionId) {
      throw new Error("Activity does not belong to the specified session");
    }
  }

  const inserted = writeTransaction(db, () =>
    db.insert(quizResults).values({
      sessionId: sessionId ?? null,
      activityId: activityId ?? null,
      questionId,
      selectedOptionId,
      correct,
      userAnswer: userAnswer.slice(0, 10000),
      timeSpentMs,
      confidence: confidence ?? null,
      note: note === null || note.length === 0 ? null : note.slice(0, 10000),
    }).returning({ id: quizResults.id }).get()
  );

  return { id: inserted.id };
}

export async function getQuizQuestionsForQuiz(quizId: number) {
  const user = await getAuthUser();
  const db = getDb();

  // Owner check
  let hasAccess = false;
  if (user) {
    const quiz = db.select({ id: quizzes.id }).from(quizzes)
      .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, user.userId))).get();
    if (quiz) hasAccess = true;
  }

  // Public fallback
  if (!hasAccess) {
    const courseCtx = isPublicQuiz(db, quizId);
    if (!courseCtx) return [];
  }

  return db.query.quizQuestions.findMany({
    where: eq(quizQuestions.quizId, quizId),
    with: { options: true },
  });
}

export async function getNewQuizQuestionsForQuiz(quizId: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  const quiz = db.select({ id: quizzes.id }).from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId))).get();
  if (!quiz) return [];

  return db.query.quizQuestions.findMany({
    where: sql`${quizQuestions.quizId} = ${quizId} AND ${quizQuestions.id} NOT IN (SELECT DISTINCT question_id FROM quiz_result)`,
    with: { options: true },
  });
}

export async function getRevisionQuizQuestionsForQuiz(quizId: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  const quiz = db.select({ id: quizzes.id }).from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId))).get();
  if (!quiz) return [];

  const questionsWithRates = db.all<{ id: number; error_rate: number }>(sql`
    SELECT q.id,
      CAST(SUM(CASE WHEN qr.correct = 0 THEN 1 ELSE 0 END) AS REAL) /
      COUNT(qr.id) AS error_rate
    FROM quiz_question q
    INNER JOIN quiz_result qr ON qr.question_id = q.id
    WHERE q.quiz_id = ${quizId}
    GROUP BY q.id
    HAVING error_rate > 0
    ORDER BY error_rate DESC
  `);

  if (questionsWithRates.length === 0) return [];

  const orderedIds = questionsWithRates.map(q => q.id);
  const questions = db.query.quizQuestions.findMany({
    where: sql`id IN (${sql.raw(orderedIds.join(","))})`,
    with: { options: true, learningMaterials: true },
  }).sync();

  const idOrder = new Map(orderedIds.map((id, i) => [id, i]));
  return questions.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
}

export async function deleteQuizQuestion(id: number) {
  const { userId } = await requireAuth();
  const db = getDb();
  const question = db.select({ id: quizQuestions.id }).from(quizQuestions)
    .innerJoin(quizzes, eq(quizQuestions.quizId, quizzes.id))
    .where(and(eq(quizQuestions.id, id), eq(quizzes.userId, userId))).get();
  if (!question) throw new Error("Question not found");

  writeTransaction(db, () =>
    db.delete(quizQuestions).where(eq(quizQuestions.id, id)).run()
  );
}

export async function getCourseQuizQuestions(
  courseId: number,
  subMode: "sequential" | "random" | "weakest_first"
) {
  const { userId } = await requireAuth();
  const db = getDb();

  const quizIds = getDescendantQuizIds(db, courseId, userId);

  if (quizIds.length === 0) return [];

  const whereRaw = `quiz_id IN (${quizIds.join(",")})`;

  if (subMode === "random") {
    return db.query.quizQuestions.findMany({
      where: sql.raw(whereRaw),
      with: { options: true, learningMaterials: true },
    });
  }

  if (subMode === "sequential") {
    return db.query.quizQuestions.findMany({
      where: sql.raw(whereRaw),
      with: { options: true, learningMaterials: true },
      orderBy: (q, { asc }) => [asc(q.id)],
    });
  }

  if (subMode === "weakest_first") {
    const questionsWithRates = db.all<{ id: number; error_rate: number }>(sql`
      SELECT q.id,
        COALESCE(
          CAST(SUM(CASE WHEN qr.correct = 0 THEN 1 ELSE 0 END) AS REAL) /
          NULLIF(COUNT(qr.id), 0),
          0.5
        ) AS error_rate
      FROM quiz_question q
      LEFT JOIN quiz_result qr ON qr.question_id = q.id
      WHERE ${sql.raw(whereRaw)}
      GROUP BY q.id
      ORDER BY error_rate DESC
    `);

    if (questionsWithRates.length === 0) return [];

    const orderedIds = questionsWithRates.map(q => q.id);
    const questions = db.query.quizQuestions.findMany({
      where: sql`id IN (${sql.raw(orderedIds.join(","))})`,
      with: { options: true, learningMaterials: true },
    }).sync();

    const idOrder = new Map(orderedIds.map((id, i) => [id, i]));
    return questions.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
  }

  return [];
}

export async function updateQuizAnswer(
  answerId: number,
  patch: { note?: string | null; confidence?: 1 | 2 | 3 | 4 | 5 | null },
): Promise<void> {
  z.number().int().positive().parse(answerId);
  confidenceSchema.parse(patch.confidence);

  const { userId } = await requireAuth();
  const db = getDb();

  const owned = db.select({ id: quizResults.id })
    .from(quizResults)
    .innerJoin(quizQuestions, eq(quizResults.questionId, quizQuestions.id))
    .innerJoin(quizzes, eq(quizQuestions.quizId, quizzes.id))
    .where(and(eq(quizResults.id, answerId), eq(quizzes.userId, userId)))
    .get();
  if (!owned) throw new Error("Answer not found");

  const updates: Record<string, unknown> = {};
  if (patch.note !== undefined) {
    updates.note = patch.note === null || patch.note.length === 0 ? null : patch.note.slice(0, 10000);
  }
  if (patch.confidence !== undefined) {
    updates.confidence = patch.confidence ?? null;
  }
  if (Object.keys(updates).length === 0) {
    throw new Error("Nothing to update");
  }

  writeTransaction(db, () =>
    db.update(quizResults).set(updates).where(eq(quizResults.id, answerId)).run()
  );
}

export async function getActivityResults(activityId: number) {
  z.number().int().positive().parse(activityId);
  const { userId } = await requireAuth();
  const db = getDb();
  const rows = db.all<{
    id: number; question_id: number; selected_option_id: number | null;
    correct: number; user_answer: string; confidence: number | null;
    note: string | null; question_text: string;
    selected_option_text: string | null; correct_option_text: string | null;
  }>(sql`
    SELECT qr.id, qr.question_id, qr.selected_option_id, qr.correct, qr.user_answer,
           qr.confidence, qr.note, qq.question AS question_text,
           (SELECT option_text FROM question_option WHERE id = qr.selected_option_id) AS selected_option_text,
           (SELECT option_text FROM question_option WHERE question_id = qq.id AND is_correct = 1 LIMIT 1) AS correct_option_text
    FROM quiz_result qr
    INNER JOIN quiz_question qq ON qq.id = qr.question_id
    INNER JOIN quiz q ON q.id = qq.quiz_id
    WHERE qr.activity_id = ${activityId} AND q.user_id = ${userId}
    ORDER BY qr.id ASC
  `);
  return rows.map(r => ({
    id: r.id,
    questionId: r.question_id,
    selectedOptionId: r.selected_option_id,
    correct: !!r.correct,
    userAnswer: r.user_answer ?? "",
    confidence: (r.confidence as 1|2|3|4|5|null) ?? null,
    note: r.note,
    questionText: r.question_text,
    selectedOptionText: r.selected_option_text,
    correctOptionText: r.correct_option_text,
    skipped: r.user_answer === "[skipped]" || (r.selected_option_id === null && (r.user_answer ?? "") === ""),
  }));
}
