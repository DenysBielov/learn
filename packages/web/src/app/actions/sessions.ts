"use server";

import { getDb } from "@flashcards/database";
import { studySessions, flashcardResults, quizResults, courses, decks } from "@flashcards/database/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, desc, count } from "drizzle-orm";

export async function getSessions() {
  const { userId } = await requireAuth();
  const db = getDb();

  const sessions = db.select().from(studySessions)
    .where(eq(studySessions.userId, userId))
    .orderBy(desc(studySessions.startedAt))
    .all();

  return sessions.map(session => {
    const course = session.courseId
      ? db.select().from(courses).where(eq(courses.id, session.courseId)).get()
      : null;
    const deck = session.deckId
      ? db.select().from(decks).where(eq(decks.id, session.deckId)).get()
      : null;

    const cardStats = db.select({
      reviewed: count(),
    }).from(flashcardResults)
      .where(eq(flashcardResults.sessionId, session.id))
      .get();

    const quizStats = db.select({
      answered: count(),
    }).from(quizResults)
      .where(eq(quizResults.sessionId, session.id))
      .get();

    return {
      ...session,
      courseName: course?.name ?? null,
      deckName: deck?.name ?? null,
      cardsReviewed: cardStats?.reviewed ?? 0,
      questionsAnswered: quizStats?.answered ?? 0,
    };
  });
}

export async function getSessionStats() {
  const { userId } = await requireAuth();
  const db = getDb();

  const allSessions = db.select().from(studySessions)
    .where(eq(studySessions.userId, userId))
    .all();

  const totalSessions = allSessions.length;
  const totalMinutes = allSessions.reduce((acc, s) => {
    if (s.startedAt && s.completedAt) {
      return acc + (new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()) / 60000;
    }
    return acc;
  }, 0);

  const todaySessions = allSessions.filter(s => {
    const d = new Date(s.startedAt);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  return {
    totalSessions,
    totalMinutes: Math.round(totalMinutes),
    avgMinutes: totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0,
    todaySessions,
  };
}

export async function getSession(id: number) {
  const { userId } = await requireAuth();
  const db = getDb();

  const session = db.select().from(studySessions)
    .where(and(eq(studySessions.id, id), eq(studySessions.userId, userId)))
    .get();

  if (!session) return null;

  const course = session.courseId
    ? db.select().from(courses).where(eq(courses.id, session.courseId)).get()
    : null;
  const deck = session.deckId
    ? db.select().from(decks).where(eq(decks.id, session.deckId)).get()
    : null;

  const cardReviews = db.select().from(flashcardResults)
    .where(eq(flashcardResults.sessionId, session.id))
    .all();

  const quizAnswersList = db.select().from(quizResults)
    .where(eq(quizResults.sessionId, session.id))
    .all();

  // Related sessions (same course or deck)
  const relatedSessions = session.courseId
    ? db.select().from(studySessions)
        .where(and(
          eq(studySessions.userId, userId),
          eq(studySessions.courseId, session.courseId),
        ))
        .orderBy(desc(studySessions.startedAt))
        .limit(5)
        .all()
        .filter(s => s.id !== session.id)
    : [];

  return {
    ...session,
    courseName: course?.name ?? null,
    deckName: deck?.name ?? null,
    cardReviews,
    quizAnswers: quizAnswersList,
    relatedSessions: relatedSessions.map(s => ({
      ...s,
      courseName: course?.name ?? null,
    })),
  };
}
