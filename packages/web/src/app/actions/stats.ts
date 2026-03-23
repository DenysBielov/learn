"use server";

import { getDb } from "@flashcards/database";
import { studySessions, flashcardResults, quizResults, flashcards, decks, quizQuestions, quizzes } from "@flashcards/database/schema";
import { and, eq, sql, gte, count, isNull, or } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";

export async function getStudyStats() {
  const { userId } = await requireAuth();
  const db = getDb();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  // Total sessions (exclude discarded)
  const totalSessions = db.select({ count: count() }).from(studySessions)
    .where(and(eq(studySessions.userId, userId), isNull(studySessions.discardedAt))).get();

  // Sessions today (exclude discarded)
  const todaySessions = db.select({ count: count() }).from(studySessions)
    .where(and(
      gte(studySessions.startedAt, todayStart),
      eq(studySessions.userId, userId),
      isNull(studySessions.discardedAt),
    )).get();

  // Flashcard results stats — use LEFT JOIN to include sessionless results, exclude discarded session results
  const flashcardStats = db.select({
    total: count(),
    correct: sql<number>`SUM(CASE WHEN ${flashcardResults.correct} = 1 THEN 1 ELSE 0 END)`,
  }).from(flashcardResults)
    .leftJoin(studySessions, eq(flashcardResults.sessionId, studySessions.id))
    .innerJoin(flashcards, eq(flashcardResults.flashcardId, flashcards.id))
    .innerJoin(decks, eq(flashcards.deckId, decks.id))
    .where(and(
      eq(decks.userId, userId),
      or(isNull(studySessions.discardedAt), isNull(flashcardResults.sessionId)),
    )).get();

  // Quiz results stats — route through decks, exclude discarded session results
  const quizStats = db.select({
    total: count(),
    correct: sql<number>`SUM(CASE WHEN ${quizResults.correct} = 1 THEN 1 ELSE 0 END)`,
  }).from(quizResults)
    .leftJoin(studySessions, eq(quizResults.sessionId, studySessions.id))
    .innerJoin(quizQuestions, eq(quizResults.questionId, quizQuestions.id))
    .innerJoin(quizzes, eq(quizQuestions.quizId, quizzes.id))
    .where(and(
      eq(quizzes.userId, userId),
      or(isNull(studySessions.discardedAt), isNull(quizResults.sessionId)),
    )).get();

  // Card mastery breakdown
  const allCards = db.select().from(flashcards)
    .innerJoin(decks, eq(flashcards.deckId, decks.id))
    .where(eq(decks.userId, userId)).all();
  const newCards = allCards.filter(c => c.flashcard.repetitions === 0).length;
  const learningCards = allCards.filter(c => c.flashcard.repetitions > 0 && c.flashcard.interval < 21).length;
  const masteredCards = allCards.filter(c => c.flashcard.interval >= 21).length;

  // Total due now
  const dueNow = db.select({ count: count() }).from(flashcards)
    .innerJoin(decks, eq(flashcards.deckId, decks.id))
    .where(sql`${flashcards.nextReviewAt} <= ${Math.floor(now.getTime() / 1000)} AND ${decks.userId} = ${userId}`).get();

  // Study streak: count consecutive days with at least one non-discarded session
  const recentSessions = db.select({
    date: sql<string>`date(started_at, 'unixepoch')`,
  }).from(studySessions)
    .where(and(eq(studySessions.userId, userId), isNull(studySessions.discardedAt)))
    .groupBy(sql`date(started_at, 'unixepoch')`)
    .orderBy(sql`date(started_at, 'unixepoch') DESC`)
    .all();

  let streak = 0;
  const today = now.toISOString().split('T')[0];
  const expectedDate = new Date(now);
  for (const session of recentSessions) {
    const expected = expectedDate.toISOString().split('T')[0];
    if (session.date === expected) {
      streak++;
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    totalSessions: totalSessions?.count ?? 0,
    todaySessions: todaySessions?.count ?? 0,
    flashcardAccuracy: flashcardStats?.total ? Math.round(((flashcardStats.correct ?? 0) / flashcardStats.total) * 100) : 0,
    quizAccuracy: quizStats?.total ? Math.round(((quizStats.correct ?? 0) / quizStats.total) * 100) : 0,
    totalCardsReviewed: flashcardStats?.total ?? 0,
    totalQuizAnswers: quizStats?.total ?? 0,
    newCards,
    learningCards,
    masteredCards,
    totalCards: allCards.length,
    dueNow: dueNow?.count ?? 0,
    streak,
  };
}
