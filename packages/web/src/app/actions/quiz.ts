"use server";

import { z } from "zod";
import { getDb, writeTransaction } from "@flashcards/database";
import { quizQuestions, questionOptions, quizResults, decks, studySessions, quizzes, courseSteps } from "@flashcards/database/schema";
import { createQuizQuestionSchema } from "@flashcards/database/validation";
import { and, eq, sql } from "drizzle-orm";
import { getDescendantDeckIds, getDescendantQuizIds } from "@flashcards/database/courses";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

const tagIdsSchema = z.array(z.number().int().positive()).max(50).optional();

export async function createQuizQuestion(data: unknown) {
  const { userId } = await requireAuth();
  const parsed = createQuizQuestionSchema.parse(data);
  const db = getDb();

  const deck = db.select({ id: decks.id }).from(decks)
    .where(and(eq(decks.id, parsed.deckId), eq(decks.userId, userId))).get();
  if (!deck) throw new Error("Deck not found");

  writeTransaction(db, () => {
    const correctAnswerJson = "correctAnswer" in parsed
      ? JSON.stringify(parsed.correctAnswer)
      : null;

    const [question] = db.insert(quizQuestions).values({
      deckId: parsed.deckId,
      type: parsed.type,
      question: parsed.question,
      explanation: parsed.explanation ?? "",
      correctAnswer: correctAnswerJson,
    }).returning().all();

    if ("options" in parsed && parsed.options) {
      db.insert(questionOptions).values(
        parsed.options.map(o => ({
          questionId: question.id,
          optionText: o.optionText,
          isCorrect: o.isCorrect,
        }))
      ).run();
    }
  });

  revalidatePath(`/decks/${parsed.deckId}`);
}

export async function getQuizQuestions(deckId: number, tagIds?: number[]) {
  const { userId } = await requireAuth();
  const validTagIds = tagIdsSchema.parse(tagIds);
  const db = getDb();

  const deck = db.select({ id: decks.id }).from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId))).get();
  if (!deck) return [];

  const tagFilter = validTagIds?.length ? sql` AND ${quizQuestions.id} IN (
    SELECT qt.question_id FROM question_tag qt
    JOIN tag t ON qt.tag_id = t.id
    WHERE t.id IN (${sql.join(validTagIds.map(id => sql`${id}`), sql`,`)})
      AND t.user_id = ${userId}
    GROUP BY qt.question_id
    HAVING COUNT(DISTINCT qt.tag_id) = ${validTagIds.length}
  )` : sql``;

  return db.query.quizQuestions.findMany({
    where: sql`${quizQuestions.deckId} = ${deckId}${tagFilter}`,
    with: { options: true, learningMaterials: true },
  });
}

export async function submitQuizAnswer(
  sessionId: number,
  questionId: number,
  correct: boolean,
  userAnswer: string,
  timeSpentMs: number
) {
  const { userId } = await requireAuth();
  const db = getDb();

  // Try authorization via quiz first, then via deck
  let question = db.select({ id: quizQuestions.id }).from(quizQuestions)
    .innerJoin(quizzes, eq(quizQuestions.quizId, quizzes.id))
    .where(and(eq(quizQuestions.id, questionId), eq(quizzes.userId, userId))).get();
  if (!question) {
    question = db.select({ id: quizQuestions.id }).from(quizQuestions)
      .innerJoin(decks, eq(quizQuestions.deckId, decks.id))
      .where(and(eq(quizQuestions.id, questionId), eq(decks.userId, userId))).get();
  }
  if (!question) throw new Error("Question not found");

  // Verify session belongs to user
  const session = db.select({ id: studySessions.id }).from(studySessions)
    .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId))).get();
  if (!session) throw new Error("Session not found");

  writeTransaction(db, () =>
    db.insert(quizResults).values({
      sessionId,
      questionId,
      correct,
      userAnswer: userAnswer.slice(0, 10000),
      timeSpentMs,
    }).run()
  );
}

export async function getNewQuizQuestions(deckId: number, tagIds?: number[]) {
  const { userId } = await requireAuth();
  const validTagIds = tagIdsSchema.parse(tagIds);
  const db = getDb();

  const deck = db.select({ id: decks.id }).from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId))).get();
  if (!deck) return [];

  const tagFilter = validTagIds?.length ? sql` AND ${quizQuestions.id} IN (
    SELECT qt.question_id FROM question_tag qt
    JOIN tag t ON qt.tag_id = t.id
    WHERE t.id IN (${sql.join(validTagIds.map(id => sql`${id}`), sql`,`)})
      AND t.user_id = ${userId}
    Group BY qt.question_id
    HAVING COUNT(DISTINCT qt.tag_id) = ${validTagIds.length}
  )` : sql``;

  return db.query.quizQuestions.findMany({
    where: sql`${quizQuestions.deckId} = ${deckId} AND ${quizQuestions.id} NOT IN (SELECT DISTINCT question_id FROM quiz_result)${tagFilter}`,
    with: { options: true, learningMaterials: true },
  });
}

export async function getRevisionQuizQuestions(deckId: number, tagIds?: number[]) {
  const { userId } = await requireAuth();
  const validTagIds = tagIdsSchema.parse(tagIds);
  const db = getDb();

  const deck = db.select({ id: decks.id }).from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId))).get();
  if (!deck) return [];

  const tagFilterRaw = validTagIds?.length ? sql`
    AND q.id IN (
      SELECT qt.question_id FROM question_tag qt
      JOIN tag t ON qt.tag_id = t.id
      WHERE t.id IN (${sql.join(validTagIds.map(id => sql`${id}`), sql`,`)})
        AND t.user_id = ${userId}
      GROUP BY qt.question_id
      HAVING COUNT(DISTINCT qt.tag_id) = ${validTagIds.length}
    )` : sql``;

  const questionsWithRates = db.all<{ id: number; error_rate: number }>(sql`
    SELECT q.id,
      CAST(SUM(CASE WHEN qr.correct = 0 THEN 1 ELSE 0 END) AS REAL) /
      COUNT(qr.id) AS error_rate
    FROM quiz_question q
    INNER JOIN quiz_result qr ON qr.question_id = q.id
    WHERE q.deck_id = ${deckId}
    ${tagFilterRaw}
    GROUP BY q.id
    HAVING error_rate > 0
    ORDER BY error_rate DESC
  `);

  if (questionsWithRates.length === 0) return [];

  const orderedIds = questionsWithRates.map(q => q.id);
  const questions = db.query.quizQuestions.findMany({
    where: sql`id IN (${sql.raw(orderedIds.join(","))})`,
    with: { options: true },
  }).sync();

  const idOrder = new Map(orderedIds.map((id, i) => [id, i]));
  return questions.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
}

export async function getQuizQuestionsForQuiz(quizId: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  const quiz = db.select({ id: quizzes.id }).from(quizzes)
    .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, userId))).get();
  if (!quiz) return [];

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

export async function deleteQuizQuestion(id: number, deckId: number) {
  const { userId } = await requireAuth();
  const db = getDb();
  const question = db.select({ id: quizQuestions.id }).from(quizQuestions)
    .innerJoin(decks, eq(quizQuestions.deckId, decks.id))
    .where(and(eq(quizQuestions.id, id), eq(decks.userId, userId))).get();
  if (!question) throw new Error("Question not found");

  writeTransaction(db, () =>
    db.delete(quizQuestions).where(eq(quizQuestions.id, id)).run()
  );
  revalidatePath(`/decks/${deckId}`);
}

export async function getCourseQuizQuestions(
  courseId: number,
  subMode: "sequential" | "random" | "weakest_first"
) {
  const { userId } = await requireAuth();
  const db = getDb();

  // Get questions from both deck path and quiz path
  const deckIds = getDescendantDeckIds(db, courseId, userId);
  const quizIds = getDescendantQuizIds(db, courseId, userId);

  if (deckIds.length === 0 && quizIds.length === 0) return [];

  // Build combined WHERE clause
  const conditions: string[] = [];
  if (deckIds.length > 0) conditions.push(`deck_id IN (${deckIds.join(",")})`);
  if (quizIds.length > 0) conditions.push(`quiz_id IN (${quizIds.join(",")})`);
  const whereRaw = conditions.join(" OR ");

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
