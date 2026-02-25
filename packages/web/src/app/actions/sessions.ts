"use server";

import { getDb } from "@flashcards/database";
import { studySessions, flashcardResults, quizResults, courses, decks } from "@flashcards/database/schema";
import { requireAuth } from "@/lib/auth";
import { eq, and, desc, count, gte, gt, lt, asc, isNull, isNotNull } from "drizzle-orm";

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

  // Compute streak: consecutive days with sessions, counting backwards from today
  const sessionDates = new Set(
    allSessions.map(s => {
      const d = new Date(s.startedAt);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })
  );

  let streak = 0;
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Start from today if there's a session today, otherwise from yesterday
  let checkDate = new Date(now);
  if (!sessionDates.has(todayKey)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, "0")}-${String(checkDate.getDate()).padStart(2, "0")}`;
    if (sessionDates.has(key)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    totalSessions,
    totalMinutes: Math.round(totalMinutes),
    avgMinutes: totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0,
    todaySessions,
    streak,
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

export async function getHeatmapData() {
  const { userId } = await requireAuth();
  const db = getDb();

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const sessions = db.select({
    startedAt: studySessions.startedAt,
    completedAt: studySessions.completedAt,
    courseId: studySessions.courseId,
  }).from(studySessions)
    .where(and(
      eq(studySessions.userId, userId),
      gte(studySessions.startedAt, oneYearAgo),
    ))
    .all();

  const userCourses = db.select({
    id: courses.id,
    name: courses.name,
    color: courses.color,
  }).from(courses)
    .where(eq(courses.userId, userId))
    .all();

  const courseMap = new Map(userCourses.map(c => [c.id, c]));

  const dayMap: Record<string, {
    totalMinutes: number;
    courses: Record<number, { name: string; color: string; minutes: number }>;
  }> = {};

  function addMinutesToDay(dateKey: string, minutes: number, courseId: number | null) {
    if (!dayMap[dateKey]) {
      dayMap[dateKey] = { totalMinutes: 0, courses: {} };
    }
    dayMap[dateKey].totalMinutes += minutes;
    if (courseId) {
      const course = courseMap.get(courseId);
      if (course) {
        if (dayMap[dateKey].courses[courseId]) {
          dayMap[dateKey].courses[courseId].minutes += minutes;
        } else {
          dayMap[dateKey].courses[courseId] = { name: course.name, color: course.color, minutes };
        }
      }
    }
  }

  function toDateKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  for (const session of sessions) {
    const start = new Date(session.startedAt);
    const end = session.completedAt ? new Date(session.completedAt) : null;

    if (!end) {
      // Active session: default 30min on start day
      addMinutesToDay(toDateKey(start), 30, session.courseId);
      continue;
    }

    // Split across days if session spans midnight
    let cursor = new Date(start);
    while (cursor < end) {
      const dayEnd = new Date(cursor);
      dayEnd.setHours(23, 59, 59, 999);
      const segmentEnd = dayEnd < end ? new Date(dayEnd.getTime() + 1) : end;
      const minutes = (segmentEnd.getTime() - cursor.getTime()) / 60000;
      addMinutesToDay(toDateKey(cursor), minutes, session.courseId);
      cursor = new Date(dayEnd.getTime() + 1); // start of next day
    }
  }

  return { dayMap, courses: userCourses };
}

export type SessionFilters = {
  query?: string;
  mode?: "flashcard" | "quiz" | "reading";
  courseId?: number;
  dateRange?: "today" | "week" | "month" | "year";
  status?: "active" | "completed";
  sortBy?: "date" | "duration";
  sortOrder?: "asc" | "desc";
  cursor?: number;
  limit?: number;
};

export async function getFilteredSessions(filters: SessionFilters) {
  const { userId } = await requireAuth();
  const db = getDb();
  const limit = filters.limit ?? 20;

  // Build WHERE conditions
  const conditions = [eq(studySessions.userId, userId)];

  if (filters.mode) {
    conditions.push(eq(studySessions.mode, filters.mode));
  }

  if (filters.courseId) {
    conditions.push(eq(studySessions.courseId, filters.courseId));
  }

  if (filters.dateRange) {
    const now = new Date();
    let rangeStart: Date;
    switch (filters.dateRange) {
      case "today":
        rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        rangeStart = new Date(now);
        rangeStart.setDate(rangeStart.getDate() - 7);
        break;
      case "month":
        rangeStart = new Date(now);
        rangeStart.setMonth(rangeStart.getMonth() - 1);
        break;
      case "year":
        rangeStart = new Date(now);
        rangeStart.setFullYear(rangeStart.getFullYear() - 1);
        break;
    }
    conditions.push(gte(studySessions.startedAt, rangeStart));
  }

  if (filters.status === "active") {
    conditions.push(isNull(studySessions.completedAt));
  } else if (filters.status === "completed") {
    conditions.push(isNotNull(studySessions.completedAt));
  }

  // Cursor-based pagination
  if (filters.cursor) {
    const cursorSession = db.select({ startedAt: studySessions.startedAt })
      .from(studySessions)
      .where(eq(studySessions.id, filters.cursor))
      .get();

    if (cursorSession) {
      const sortOrder = filters.sortOrder ?? "desc";
      if (sortOrder === "desc") {
        conditions.push(lt(studySessions.startedAt, cursorSession.startedAt));
      } else {
        conditions.push(gt(studySessions.startedAt, cursorSession.startedAt));
      }
    }
  }

  const orderDir = filters.sortOrder === "asc" ? asc : desc;

  // For duration sorting we need to sort client-side after enrichment,
  // so always fetch by date for the DB query
  const sessions = db.select().from(studySessions)
    .where(and(...conditions))
    .orderBy(orderDir(studySessions.startedAt))
    .limit(limit + 1)
    .all();

  const hasMore = sessions.length > limit;
  const sliced = hasMore ? sessions.slice(0, limit) : sessions;

  // Enrich sessions
  const enriched = sliced.map(session => {
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

    const duration = session.startedAt && session.completedAt
      ? (new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 60000
      : null;

    return {
      ...session,
      courseName: course?.name ?? null,
      courseColor: course?.color ?? null,
      deckName: deck?.name ?? null,
      cardsReviewed: cardStats?.reviewed ?? 0,
      questionsAnswered: quizStats?.answered ?? 0,
      duration,
    };
  });

  // Apply text search filter (post-query)
  let filtered = enriched;
  if (filters.query) {
    const q = filters.query.toLowerCase();
    filtered = enriched.filter(s =>
      (s.summary && s.summary.toLowerCase().includes(q)) ||
      (s.courseName && s.courseName.toLowerCase().includes(q)) ||
      (s.deckName && s.deckName.toLowerCase().includes(q)) ||
      (s.notes && s.notes.toLowerCase().includes(q))
    );
  }

  // Duration sorting (client-side since it's computed)
  if (filters.sortBy === "duration") {
    filtered.sort((a, b) => {
      const aDur = a.duration ?? 0;
      const bDur = b.duration ?? 0;
      return filters.sortOrder === "asc" ? aDur - bDur : bDur - aDur;
    });
  }

  const nextCursor = hasMore && sliced.length > 0
    ? sliced[sliced.length - 1].id
    : null;

  return { sessions: filtered, nextCursor };
}

export async function getUserCourses() {
  const { userId } = await requireAuth();
  const db = getDb();

  return db.select({
    id: courses.id,
    name: courses.name,
    color: courses.color,
  }).from(courses)
    .where(eq(courses.userId, userId))
    .all();
}
