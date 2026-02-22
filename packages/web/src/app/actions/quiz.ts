"use server";

import { getDb, writeTransaction } from "@flashcards/database";
import { quizQuestions, questionOptions, quizResults, decks, studySessions } from "@flashcards/database/schema";
import { createQuizQuestionSchema } from "@flashcards/database/validation";
import { and, eq, sql } from "drizzle-orm";
import { getDescendantDeckIds } from "@flashcards/database/courses";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";

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

export async function getQuizQuestions(deckId: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  const deck = db.select({ id: decks.id }).from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId))).get();
  if (!deck) return [];

  return db.query.quizQuestions.findMany({
    where: eq(quizQuestions.deckId, deckId),
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

  // Verify question belongs to user's deck
  const question = db.select({ id: quizQuestions.id }).from(quizQuestions)
    .innerJoin(decks, eq(quizQuestions.deckId, decks.id))
    .where(and(eq(quizQuestions.id, questionId), eq(decks.userId, userId))).get();
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

export async function getNewQuizQuestions(deckId: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  const deck = db.select({ id: decks.id }).from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId))).get();
  if (!deck) return [];

  return db.query.quizQuestions.findMany({
    where: sql`${quizQuestions.deckId} = ${deckId} AND ${quizQuestions.id} NOT IN (SELECT DISTINCT question_id FROM quiz_result)`,
    with: { options: true, learningMaterials: true },
  });
}

export async function getRevisionQuizQuestions(deckId: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  const deck = db.select({ id: decks.id }).from(decks)
    .where(and(eq(decks.id, deckId), eq(decks.userId, userId))).get();
  if (!deck) return [];

  const questionsWithRates = db.all<{ id: number; error_rate: number }>(sql`
    SELECT q.id,
      CAST(SUM(CASE WHEN qr.correct = 0 THEN 1 ELSE 0 END) AS REAL) /
      COUNT(qr.id) AS error_rate
    FROM quiz_question q
    INNER JOIN quiz_result qr ON qr.question_id = q.id
    WHERE q.deck_id = ${deckId}
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
  const deckIds = getDescendantDeckIds(db, courseId, userId);
  if (deckIds.length === 0) return [];

  if (subMode === "random") {
    // Fetch all using Drizzle query builder, shuffle in app code
    return db.query.quizQuestions.findMany({
      where: sql`deck_id IN (${sql.raw(deckIds.join(","))})`,
      with: { options: true, learningMaterials: true },
    });
  }

  if (subMode === "sequential") {
    // Fetch with deck position ordering
    return db.query.quizQuestions.findMany({
      where: sql`deck_id IN (${sql.raw(deckIds.join(","))})`,
      with: { options: true, learningMaterials: true },
      orderBy: (q, { asc }) => [asc(q.deckId), asc(q.id)],
    });
  }

  if (subMode === "weakest_first") {
    // Get questions with error rates, then fetch options
    const questionsWithRates = db.all<{ id: number; error_rate: number }>(sql`
      SELECT q.id,
        COALESCE(
          CAST(SUM(CASE WHEN qr.correct = 0 THEN 1 ELSE 0 END) AS REAL) /
          NULLIF(COUNT(qr.id), 0),
          0.5
        ) AS error_rate
      FROM quiz_question q
      LEFT JOIN quiz_result qr ON qr.question_id = q.id
      WHERE q.deck_id IN (${sql.raw(deckIds.join(","))})
      GROUP BY q.id
      ORDER BY error_rate DESC
    `);

    if (questionsWithRates.length === 0) return [];

    const orderedIds = questionsWithRates.map(q => q.id);
    const questions = db.query.quizQuestions.findMany({
      where: sql`id IN (${sql.raw(orderedIds.join(","))})`,
      with: { options: true, learningMaterials: true },
    }).sync();

    // Re-sort by original error_rate ordering
    const idOrder = new Map(orderedIds.map((id, i) => [id, i]));
    return questions.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
  }

  return [];
}
